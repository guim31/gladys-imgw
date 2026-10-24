// -----------------------------------------------------------------------------
// The monitor: which stations are followed, their readings, the states
// published to Gladys and the scene triggers. Everything the SDK handlers, the
// action and the widget need goes through it (src/app.js wires it).
//
// Followed stations: the "Stations" field and "around my house" of the
// configuration (MAX_STATIONS at most), plus every station whose device the
// user created (deleting the device stops following it).
//
// Scheduling: the devices are published with should_poll: false (the core does
// not poll external devices reliably, GladysAssistant/Gladys#3198). The monitor
// runs a cycle at the configured interval: ONE IMGW-PIB request, which returns
// every station with its readings and thresholds. The same answer resolves the
// names of the configuration and finds the stations around the house.
//
// States: `publishChangedStates` sends only what changed, plus a heartbeat every
// 12 hours. A reading older than its validity (6 hours for the water level,
// 30 hours for the flow and the daily water temperature) is never sent again as
// if it were fresh: the values stop, the "Last reading" feature says since when.
//
// Logs: at info, only the lifecycle (start, stations followed, a station going
// silent or coming back, a threshold crossed). A failure that repeats at every
// cycle is logged once, then at debug until it recovers, with one line at
// recovery. LOG_LEVEL=debug shows every cycle. The coordinates of the house
// are never logged nor sent: the stations around it are chosen locally.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { HOME_STATIONS, MAX_STATIONS, normalizeName } from './config.js';
import {
  ALERT_LEVEL,
  buildDevice,
  capabilities,
  displayName,
  mergeCapabilities,
  stationIdOfId,
  stationIds,
} from './devices.js';
import { distanceKm } from './geo.js';
import { READINGS, STATUS, THRESHOLD_NAMES, formatDate, join, render } from './messages.js';
import { Imgw, SERIES, THRESHOLDS } from './imgw.js';

const logger = createLogger({ name: 'imgw' });

export const WIDGET_KEY = 'stations';
export const TRIGGERS = {
  THRESHOLD_CROSSED: 'threshold_crossed',
  READINGS_STOPPED: 'readings_stopped',
  READINGS_RESUMED: 'readings_resumed',
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const DEFAULT_TIMINGS = {
  // Without a newer reading, a value is not published again as a fresh one.
  // Water levels come every 10 to 60 minutes; flows are computed later at some
  // stations, and the water temperature is read once a day at 06:00 UTC.
  staleAfterMs: { level: 6 * HOUR, flow: 30 * HOUR, temperature: 30 * HOUR },
  // The search action reuses the last download for this long.
  listMaxAgeMs: 10 * MINUTE,
  // The stations around the house are chosen again once a day.
  homeMaxAgeMs: DAY,
  // A state remembered for longer fires no trigger when it changes (restart).
  memoryMs: DAY,
  // Water levels kept for the trend.
  historyMs: 3 * HOUR,
  heartbeatMs: 12 * HOUR,
  // requestWidgetRefresh is rate-limited to one call every 10 s by the core.
  widgetRefreshMs: 10000,
};

// Below this rise per hour, a level is steady.
const STEADY_CM_PER_HOUR = 1;
// A level must go this far back below a threshold before crossing it again
// counts: readings wobbling around it fire one event, not one per cycle.
export const THRESHOLD_HYSTERESIS_CM = 2;

/**
 * Rising, steady or falling, from levels newest first (`{ t, v }`, cm); null
 * when there is no level 45 minutes to 2 hours older than the newest.
 */
export function trendOf(levels) {
  const [latest] = levels;
  if (!latest) {
    return null;
  }
  const earlier = levels.find((point) => latest.t - point.t >= 45 * MINUTE);
  if (!earlier || latest.t - earlier.t > 2 * HOUR) {
    return null;
  }
  const perHour = (latest.v - earlier.v) / ((latest.t - earlier.t) / HOUR);
  if (perHour >= STEADY_CM_PER_HOUR) {
    return 'rising';
  }
  return perHour <= -STEADY_CM_PER_HOUR ? 'falling' : 'steady';
}

/** 'normal', 'warning' or 'alarm': a level compared with the thresholds of its station. */
export function alertOf(level, thresholds) {
  if (typeof level !== 'number' || !thresholds) {
    return null;
  }
  if (level >= thresholds.alarm) {
    return 'alarm';
  }
  return level >= thresholds.warning ? 'warning' : 'normal';
}

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK fake)
   * @param {object} options.store see src/store.js
   * @param {Function} [options.fetch] fetch, for IMGW-PIB
   * @param {boolean} [options.timers] false: no background timer (tests drive the cycles)
   * @param {Function} [options.now] clock in ms
   * @param {object} [options.timings] overrides of DEFAULT_TIMINGS
   */
  constructor({ gladys, store, fetch: fetchImpl, timers = true, now, timings }) {
    this.gladys = gladys;
    this.store = store;
    this.api = new Imgw({ fetch: fetchImpl });
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.config = null;
    this.data = emptyData();
    // The last answer of IMGW-PIB, in memory only: { stations: Map, fetchedAt }.
    this.list = null;
    // Stations of the configuration, in order (field, then house).
    this.configured = [];
    this.problems = { unknown: [], ambiguous: [], noHouse: false, tooMany: false };
    this.resolved = false;
    this.lastCycleAt = -Infinity;
    this.statusMessage = undefined;
    this.cycleTimer = null;
    this.running = null;
    this.lastRefreshAt = -Infinity;
    this.refreshTimer = null;
    this.rerun = null;
    this.stopped = false;
    // Keys of the failures already logged, so a repeated one is not logged again.
    this.failing = new Set();
  }

  /** Log a failure once (warn or error), then at debug until `recovered(key)`. */
  failed(key, level, message, err) {
    const details = err ? [message, err] : [message];
    if (this.failing.has(key)) {
      logger.debug(...details);
      return;
    }
    this.failing.add(key);
    logger[level](...details);
  }

  /** One line when a failure logged by `failed(key)` is over. */
  recovered(key, message) {
    if (this.failing.delete(key)) {
      logger.info(message);
    }
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    this.config = config;
    const saved = await this.store.load();
    if (saved?.version === 1) {
      this.data = { ...emptyData(), ...saved };
    }
    // Scheduled first: a failure below must not leave the integration without cycles.
    this.schedule();
    await this.runCycle();
    await this.publishDiscovered();
    logger.info(
      `Started: ${this.followed().length} station(s) followed, refreshed every ${config.refreshMinutes} min`,
    );
  }

  /** Reconnection: Gladys may have restarted, publish everything again. */
  async resync(config) {
    this.config = config;
    if (!this.cycleTimer) {
      this.schedule();
    }
    await this.publishDiscovered();
    this.statusMessage = undefined;
    await this.updateConnectionStatus();
    this.gladys.forgetPublishedStates?.();
    await this.publishStates(this.created());
    this.requestRefresh();
  }

  async reconfigure(config) {
    const before = this.followed().join(',');
    this.config = config;
    this.data.home = null;
    this.resolved = false;
    // A cycle already running reads the old configuration: run another one after it.
    await this.runCycle({ again: true });
    await this.publishDiscovered();
    const after = this.followed();
    if (after.join(',') !== before) {
      logger.info(`Configuration saved: ${after.length} station(s) followed`);
    }
    this.schedule();
    this.requestRefresh();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.cycleTimer);
    clearTimeout(this.refreshTimer);
    this.cycleTimer = null;
    await this.running?.catch(() => {});
    await this.store.flush();
  }

  schedule() {
    if (!this.timers || this.stopped) {
      return;
    }
    clearInterval(this.cycleTimer);
    this.cycleTimer = setInterval(() => this.runCycle(), this.config.refreshMinutes * MINUTE);
    this.cycleTimer.unref?.();
  }

  save() {
    return this.store.save(this.data);
  }

  // --- Which stations ----------------------------------------------------------

  /** Station ids whose device exists in Gladys. */
  created() {
    return [
      ...new Set(
        (this.gladys.devices ?? [])
          .map((device) => stationIdOfId(this.gladys, device.external_id))
          .filter(Boolean),
      ),
    ];
  }

  isCreated(id) {
    const deviceId = stationIds(this.gladys, id).device;
    return (this.gladys.devices ?? []).some((device) => device.external_id === deviceId);
  }

  /** Every followed station: the configured ones, then the created ones. */
  followed() {
    return [...new Set([...this.configured, ...this.created()])];
  }

  /** What the integration knows of a station, a created device filling the gaps. */
  station(id) {
    const known = this.data.stations[id];
    if (known) {
      return known;
    }
    const device = (this.gladys.devices ?? []).find(
      (item) => stationIdOfId(this.gladys, item.external_id) === id,
    );
    if (!device) {
      return null;
    }
    const param = (name) => device.params?.find((p) => p.name === name)?.value;
    const features = new Set((device.features ?? []).map((f) => f.external_id.split(':').pop()));
    return {
      id,
      name: param('STATION_NAME') ?? device.name ?? id,
      river: param('RIVER') ?? null,
      province: param('PROVINCE') ?? null,
      thresholds: null,
      has: {
        height: features.has('height'),
        flow: features.has('flow'),
        water_temperature: features.has('water_temperature'),
        alert_level: features.has('alert_level'),
      },
    };
  }

  /**
   * Every station of IMGW-PIB (a Map by id): the last answer if younger than
   * `maxAgeMs`, else a new download. Throws when IMGW-PIB does not answer.
   */
  async stationList(maxAgeMs = this.timings.listMaxAgeMs) {
    if (this.list && this.now() - this.list.fetchedAt < maxAgeMs) {
      return this.list.stations;
    }
    const stations = await this.api.stations();
    this.list = { stations, fetchedAt: this.now() };
    logger.debug(`Station list: ${stations.size} stations`);
    return stations;
  }

  /**
   * The stations a name of the configuration designates: its station name,
   * or its name and river in either order ("Krosno Wisłok", "Wisła Warszawa-Bulwary").
   */
  static find(stations, token) {
    const wanted = normalizeName(token.value);
    const found = [];
    for (const station of stations.values()) {
      const name = normalizeName(station.name);
      const river = normalizeName(station.river);
      if (
        name === wanted ||
        (river && (`${name} ${river}` === wanted || `${river} ${name}` === wanted))
      ) {
        found.push(station);
      }
    }
    return found;
  }

  /**
   * Resolve the configuration into station ids, from the station list. Ids
   * are taken as they are when the list says nothing (IMGW-PIB unreachable):
   * the stations found before are then kept.
   */
  async resolve(stations) {
    const problems = { unknown: [], ambiguous: [], noHouse: false, tooMany: false };
    const ids = [];
    const add = (id) => {
      if (!ids.includes(id)) {
        ids.push(id);
      }
    };
    let complete = stations !== null;
    for (const token of this.config.stations) {
      if (!stations) {
        if (token.kind === 'id') {
          add(token.value);
        }
        continue;
      }
      if (token.kind === 'id') {
        if (stations.has(token.value)) {
          add(token.value);
        } else {
          problems.unknown.push(token.text);
        }
        continue;
      }
      const found = Monitor.find(stations, token);
      if (found.length === 1) {
        add(found[0].id);
      } else if (found.length > 1) {
        problems.ambiguous.push(token.text);
      } else {
        problems.unknown.push(token.text);
      }
    }
    if (this.config.homeRadiusKm > 0 && stations) {
      try {
        const home = await this.homeStations(stations);
        if (home === null) {
          problems.noHouse = true;
        } else {
          home.forEach(add);
        }
        this.recovered('home', 'Stations around the house chosen again');
      } catch (err) {
        complete = false;
        this.failed(
          'home',
          'warn',
          `Cannot choose the stations around the house yet: ${err.message}`,
        );
      }
    }
    if (ids.length > MAX_STATIONS) {
      problems.tooMany = true;
      ids.length = MAX_STATIONS;
    }
    // A failed resolution keeps the stations found before it.
    this.configured = complete ? ids : [...new Set([...this.configured, ...ids])];
    if (complete) {
      this.problems = problems;
    }
    this.resolved = complete;
    for (const name of problems.unknown) {
      this.failed(`unknown:${name}`, 'warn', `Unknown station: ${name}`);
    }
    for (const name of problems.ambiguous) {
      this.failed(`ambiguous:${name}`, 'warn', `Several stations are named ${name}`);
    }
  }

  /**
   * The first house of Gladys that has a location, or null. A failure to read
   * the houses throws with `strict` (the stations are chosen again later), and
   * resolves null otherwise (the search then asks for a location).
   */
  async house({ strict = false } = {}) {
    try {
      const houses = await this.gladys.getHouses();
      return (
        houses.find(
          (house) => Number.isFinite(house.latitude) && Number.isFinite(house.longitude),
        ) ?? null
      );
    } catch (err) {
      if (strict) {
        throw new Error(`cannot read the houses of Gladys: ${err.message}`, { cause: err });
      }
      this.failed('houses', 'warn', `Cannot read the houses of Gladys: ${err.message}`);
      return null;
    }
  }

  /** Stations of the list around a point, nearest first, with their distance. */
  static around(stations, origin, radiusKm) {
    return [...stations.values()]
      .filter((station) => station.latitude !== null && station.longitude !== null)
      .map((station) => ({
        station,
        km: distanceKm(origin.latitude, origin.longitude, station.latitude, station.longitude),
      }))
      .filter(({ km }) => km <= radiusKm)
      .sort((a, b) => a.km - b.km);
  }

  /**
   * The nearest stations around the house that sent a water level lately
   * (HOME_STATIONS at most), chosen again once a day; null without a located
   * house.
   */
  async homeStations(stations) {
    const radius = this.config.homeRadiusKm;
    const cached = this.data.home;
    if (
      cached &&
      cached.radiusKm === radius &&
      this.now() - cached.at < this.timings.homeMaxAgeMs
    ) {
      return cached.ids;
    }
    const house = await this.house({ strict: true });
    if (!house) {
      return null;
    }
    const ids = Monitor.around(stations, house, radius)
      .filter(({ station }) => this.isFresh(station.level?.t))
      .slice(0, HOME_STATIONS)
      .map(({ station }) => station.id);
    // The house coordinates are not stored: only the radius and the stations.
    this.data.home = { radiusKm: radius, ids, at: this.now() };
    return ids;
  }

  // --- Discovery and connection status -----------------------------------------

  discoveredDevices() {
    return this.followed()
      .map((id) => this.station(id))
      .filter(Boolean)
      .map((station) => buildDevice(this.gladys, station, this.config.language));
  }

  async publishDiscovered() {
    await this.gladys.publishDiscoveredDevices(this.discoveredDevices());
  }

  async updateConnectionStatus() {
    const { unknown, ambiguous, noHouse, tooMany } = this.problems;
    const parts = [];
    if (this.failing.has('readings')) {
      parts.push(render(STATUS, 'down'));
    }
    if (this.failing.has('home')) {
      parts.push(render(STATUS, 'homeFailed'));
    }
    if (unknown.length > 0) {
      parts.push(render(STATUS, 'unknown', { names: unknown.join(', ') }));
    }
    if (ambiguous.length > 0) {
      parts.push(render(STATUS, 'ambiguous', { names: ambiguous.join(', ') }));
    }
    if (noHouse) {
      parts.push(render(STATUS, 'noHouse'));
    }
    if (tooMany) {
      parts.push(render(STATUS, 'tooMany', { max: MAX_STATIONS }));
    }
    const named = unknown.length + ambiguous.length;
    if (this.resolved && this.followed().length === 0 && named === 0 && !noHouse) {
      parts.push(render(STATUS, 'none'));
    }
    const message = parts.length > 0 ? join(...parts) : undefined;
    const connected = !this.failing.has('readings') && this.resolved;
    const key = JSON.stringify([connected, message]);
    if (key === this.statusMessage) {
      return;
    }
    this.statusMessage = key;
    await this.gladys.setConnectionStatus(connected, message).catch(() => {});
  }

  // --- Gladys events -----------------------------------------------------------

  async onDeviceCreated(device) {
    const id = stationIdOfId(this.gladys, device.external_id);
    if (!id) {
      return;
    }
    if (!this.data.readings[id]) {
      await this.runCycle({ again: true });
    }
    // The SDK forgot the states of the device: everything is published again.
    await this.publishStates([id]);
    this.requestRefresh();
  }

  async onDeviceDeleted() {
    // A station only followed through its device is no longer followed.
    await this.publishDiscovered();
    this.requestRefresh();
  }

  /** onPoll fallback: should_poll is false, but a Gladys polling anyway gets an answer. */
  async poll(device) {
    const id = stationIdOfId(this.gladys, device.external_id);
    if (!id) {
      return;
    }
    // Read again only if the last cycle is older than half the interval.
    if (this.now() - this.lastCycleAt >= (this.config.refreshMinutes * MINUTE) / 2) {
      await this.runCycle();
    } else {
      await this.publishStates([id]);
    }
  }

  // --- Cycles ------------------------------------------------------------------

  /** Run a cycle; `again`: if one is running, run a new one once it is over. */
  runCycle({ again = false } = {}) {
    if (this.stopped) {
      return this.running;
    }
    if (this.running) {
      if (again) {
        this.rerun ??= this.running.then(() => {
          this.rerun = null;
          return this.runCycle();
        });
        return this.rerun;
      }
      return this.running;
    }
    this.running = this.cycle()
      .then(() => this.recovered('cycle', 'Refresh cycles work again'))
      .catch((err) => this.failed('cycle', 'error', 'Refresh cycle failed', err))
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }

  async cycle() {
    this.lastCycleAt = this.now();
    const before = this.discoveredKey();
    // Nothing configured nor created: nothing to ask.
    const needed =
      this.config.stations.length > 0 || this.config.homeRadiusKm > 0 || this.created().length > 0;
    let stations = needed ? null : new Map();
    if (needed) {
      try {
        // Always downloaded again: it carries the readings.
        stations = await this.stationList(0);
        this.recovered('readings', 'IMGW-PIB answers again');
      } catch (err) {
        this.failed('readings', 'warn', `IMGW-PIB unreachable: ${err.message}`);
      }
    }
    await this.resolve(stations);
    const ids = this.followed();
    let changed = false;
    if (stations) {
      for (const id of ids) {
        const station = stations.get(id);
        if (station) {
          const known = this.station(id);
          const has = mergeCapabilities(
            capabilities(station, this.now()),
            known ? capabilities(known) : null,
          );
          this.data.stations[id] = { ...station, has };
          changed = (await this.fold(id, station)) || changed;
        }
      }
      this.forget(ids);
    }
    // Silence is a station's when the service answers with fresh data for the
    // others: an outage of IMGW-PIB (or of the Internet access), or a frozen
    // answer, must not report every station as failed.
    const newest = stations
      ? Math.max(-Infinity, ...[...stations.values()].map((s) => s.level?.t ?? -Infinity))
      : null;
    if (stations && (stations.size === 0 || this.isFresh(newest))) {
      for (const id of ids) {
        changed = (await this.noteSilence(id)) || changed;
      }
    }
    if (this.discoveredKey() !== before) {
      await this.publishDiscovered();
    }
    await this.publishStates(this.created());
    await this.updateConnectionStatus();
    await this.save();
    logger.debug(`Refresh cycle: ${ids.length} station(s)`);
    if (changed) {
      this.requestRefresh();
    }
  }

  discoveredKey() {
    return JSON.stringify(this.discoveredDevices());
  }

  /** Drop what is kept of the stations no longer followed (the house ones change). */
  forget(followed) {
    for (const table of [this.data.stations, this.data.readings, this.data.memory]) {
      for (const id of Object.keys(table)) {
        if (!followed.includes(id)) {
          delete table[id];
        }
      }
    }
  }

  readingOf(id) {
    this.data.readings[id] ??= { history: [] };
    return this.data.readings[id];
  }

  /** Whether a reading of `series` taken at `time` is recent enough to be shown. */
  isFresh(time, series = 'level') {
    return typeof time === 'number' && this.now() - time <= this.timings.staleAfterMs[series];
  }

  /** Fold the readings of a station; fire the triggers of a new water level. */
  async fold(id, station) {
    const reading = this.readingOf(id);
    let changed = false;
    for (const key of SERIES) {
      const current = station[key];
      if (!current || current.t < (reading[key]?.t ?? -Infinity)) {
        continue;
      }
      const isNew = reading[key]?.t !== current.t;
      changed ||= isNew || reading[key]?.v !== current.v;
      reading[key] = { t: current.t, v: current.v };
      if (key === 'level' && isNew) {
        reading.history = [
          { t: current.t, v: current.v },
          ...reading.history.filter(
            (point) => point.t < current.t && current.t - point.t <= this.timings.historyMs,
          ),
        ];
        const trend = trendOf(reading.history);
        changed ||= trend !== reading.trend;
        reading.trend = trend;
        if (this.isFresh(current.t)) {
          await this.levelEvents(id, station, current);
        }
      }
    }
    return changed;
  }

  /** One info line (and a trigger) when a station goes silent, one when it comes back. */
  async noteSilence(id) {
    const reading = this.readingOf(id);
    const silent = !this.isFresh(this.lastReadingAt(id), this.lastReadingSeries(id));
    if (silent === reading.silent) {
      return false;
    }
    const wasKnown = reading.silent !== undefined;
    reading.silent = silent;
    if (silent) {
      reading.trend = null;
    }
    const station = this.station(id) ?? { id, name: id, river: null };
    const name = displayName(station);
    if (!wasKnown) {
      logger.debug(`${name}: ${silent ? 'no recent reading' : 'readings are fresh'}`);
      return true;
    }
    if (silent) {
      logger.info(
        `${name}: no new reading for ${this.timings.staleAfterMs[this.lastReadingSeries(id)] / HOUR} hours`,
      );
    } else {
      logger.info(`${name}: readings are back`);
    }
    if (this.isCreated(id)) {
      const last = this.lastReadingAt(id);
      await this.gladys
        .publishSceneEvent(silent ? TRIGGERS.READINGS_STOPPED : TRIGGERS.READINGS_RESUMED, {
          station: stationIds(this.gladys, id).device,
          station_name: station.name,
          river: station.river ?? null,
          last_reading: last !== null ? formatDate(last, this.config.language, this.now()) : null,
        })
        .catch((err) => logger.warn(`Readings event refused: ${err.message}`));
    }
    return true;
  }

  /**
   * The series that says whether a station is alive: its water level, or its
   * water temperature for the few stations that only send that.
   */
  lastReadingSeries(id) {
    const station = this.station(id);
    return station && !capabilities(station).height && capabilities(station).water_temperature
      ? 'temperature'
      : 'level';
  }

  /** Time of the last reading of a station (ms), or null. */
  lastReadingAt(id) {
    return this.data.readings[id]?.[this.lastReadingSeries(id)]?.t ?? null;
  }

  // --- Scene triggers ------------------------------------------------------------

  /**
   * Compare a new water level with the warning and alarm levels of its station
   * and the side of each that is remembered. A memory older than a day (a long
   * restart), or a threshold IMGW-PIB has changed, is renewed without firing.
   */
  async levelEvents(id, station, current) {
    if (!station.thresholds) {
      return;
    }
    const memory = (this.data.memory[id] ??= { thresholds: {} });
    const now = this.now();
    const recent = (entry) => entry && now - entry.at <= this.timings.memoryMs;
    const events = [];
    for (const threshold of THRESHOLDS) {
      const value = station.thresholds[threshold];
      const previous = memory.thresholds[threshold];
      let side;
      if (!recent(previous) || previous.value !== value) {
        side = current.v >= value ? 'above' : 'below';
      } else if (previous.side === 'below' && current.v >= value) {
        side = 'above';
        events.push({ threshold, value, direction: 'rising' });
      } else if (previous.side === 'above' && current.v <= value - THRESHOLD_HYSTERESIS_CM) {
        side = 'below';
        events.push({ threshold, value, direction: 'falling' });
      } else {
        side = previous.side;
      }
      memory.thresholds[threshold] = { side, value, at: now };
    }
    // A fall through both levels in one reading: the alarm level first, as it happened.
    events.sort((a, b) =>
      a.direction === b.direction && a.direction === 'falling'
        ? THRESHOLDS.indexOf(b.threshold) - THRESHOLDS.indexOf(a.threshold)
        : 0,
    );
    for (const event of events) {
      logger.info(
        `${displayName(station)}: ${event.direction === 'rising' ? 'reached' : 'back below'} the ${event.threshold} level (${event.value} cm)`,
      );
    }
    if (events.length === 0 || !this.isCreated(id)) {
      return;
    }
    const language = this.config.language;
    for (const event of events) {
      await this.gladys
        .publishSceneEvent(TRIGGERS.THRESHOLD_CROSSED, {
          station: stationIds(this.gladys, id).device,
          station_name: station.name,
          river: station.river ?? null,
          height: current.v,
          threshold: event.threshold,
          threshold_name: THRESHOLD_NAMES[language][event.threshold],
          threshold_value: event.value,
          direction: event.direction,
        })
        .catch((err) => logger.warn(`${TRIGGERS.THRESHOLD_CROSSED} event refused: ${err.message}`));
    }
  }

  // --- States ------------------------------------------------------------------

  /** The states of the given stations whose device exists. */
  statesOf(ids) {
    const states = [];
    const language = this.config.language;
    for (const id of ids) {
      const station = this.station(id);
      if (!station || !this.isCreated(id)) {
        continue;
      }
      const featureIds = stationIds(this.gladys, id);
      const has = capabilities(station);
      const reading = this.data.readings[id] ?? {};
      const fresh = (key) => reading[key] && this.isFresh(reading[key].t, key);
      const push = (featureId, state) =>
        states.push({ device_feature_external_id: featureId, state });
      if (has.height && fresh('level')) {
        push(featureIds.height, reading.level.v);
        const alert = alertOf(reading.level.v, station.thresholds);
        if (has.alert_level && alert) {
          push(featureIds.alert_level, ALERT_LEVEL[alert]);
        }
      }
      if (has.flow && fresh('flow')) {
        push(featureIds.flow, reading.flow.v);
      }
      if (has.water_temperature && fresh('temperature')) {
        push(featureIds.water_temperature, reading.temperature.v);
      }
      const last = this.lastReadingAt(id);
      if (last !== null) {
        const date = formatDate(last, language, this.now());
        states.push({
          device_feature_external_id: featureIds.last_reading,
          text: this.isFresh(last, this.lastReadingSeries(id))
            ? date
            : READINGS[language].staleSince({ date }),
        });
      }
    }
    return states;
  }

  async publishStates(ids) {
    const states = this.statesOf(ids);
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.recovered('publish', 'Publishing the states works again');
    } catch (err) {
      // Sent again at the next cycle (the SDK forgets what Gladys refused).
      this.failed('publish', 'warn', `Publishing the states failed: ${err.message}`);
    }
  }

  // --- Widget -------------------------------------------------------------------

  requestRefresh() {
    if (this.stopped) {
      return;
    }
    const now = this.now();
    const wait = this.lastRefreshAt + this.timings.widgetRefreshMs - now;
    if (wait <= 0) {
      this.lastRefreshAt = now;
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    } else if (this.timers && !this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.requestRefresh();
      }, wait);
      this.refreshTimer.unref?.();
    }
  }

  /** What the widget shows of one station. */
  view(id) {
    const station = this.station(id) ?? { id, name: id, river: null, thresholds: null };
    const has = capabilities(station);
    const reading = this.data.readings[id] ?? {};
    const last = this.lastReadingAt(id);
    const fresh = this.isFresh(last, this.lastReadingSeries(id));
    const value = (key) =>
      reading[key] && this.isFresh(reading[key].t, key) ? reading[key].v : null;
    const height = value('level');
    return {
      id,
      name: station.name,
      river: station.river ?? null,
      has,
      height,
      flow: value('flow'),
      waterTemperature: value('temperature'),
      thresholds: station.thresholds ?? null,
      alert: alertOf(height, station.thresholds),
      trend: fresh ? (reading.trend ?? null) : null,
      lastReadingAt: last,
      fresh,
      now: this.now(),
    };
  }

  /** The time of the newest reading shown, for the attribution. */
  updatedAt(ids) {
    const times = ids.map((id) => this.lastReadingAt(id)).filter((t) => t !== null);
    return times.length > 0 ? Math.max(...times) : null;
  }

  // --- Search -------------------------------------------------------------------

  /** Stations matching the words (name, river, province; case and accents ignored). */
  static matches(station, words) {
    const haystack = normalizeName(
      `${station.name} ${station.river ?? ''} ${station.province ?? ''}`,
    );
    return words.every((word) => haystack.includes(normalizeName(word)));
  }
}

function emptyData() {
  return {
    version: 1,
    stations: {},
    home: null,
    readings: {},
    memory: {},
  };
}
