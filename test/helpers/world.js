// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake IMGW-PIB serving the
// recorded answer of test/fixtures, a manual clock, a temporary /data, and the
// integration wired on top through registerHandlers. Nothing touches the
// network.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { API_URL } from '../../src/imgw.js';
import { Store } from '../../src/store.js';

process.env.LOG_LEVEL ??= 'silent';
process.env.TZ = 'Europe/Warsaw';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));

export const FIXTURE = 'imgw/hydro-2026-10-24.json';

// The recorded water levels are of 03:50 UTC on 24/10/2026, downloaded at
// 04:14 UTC: the clock starts there.
export const START = Date.parse('2026-10-24T04:15:00Z');

// A house in central Warsaw (public coordinates of the Palace of Culture).
export const HOUSE = {
  id: 'house-1',
  name: 'Dom',
  selector: 'dom',
  latitude: 52.2318,
  longitude: 21.0059,
};

// Wisła in Warsaw: level and flow, warning 700 cm, alarm 750 cm.
export const WARSZAWA = '152210170';
// Odra in Wrocław: level only, warning 380 cm, alarm 450 cm.
export const TRESTNO = '151170030';
// Utrata: 212 cm, 8 cm below its warning level (220 cm), alarm 280 cm.
export const KRUBICE = '152200090';
// A sea gauge (river "-"): level, water temperature, thresholds.
export const GDANSK = '154180140';
// Jezioro Drużno: level and water temperature, no thresholds.
export const ZUKOWO = '154190080';
// Lake Wigry: a water temperature only, no water level.
export const WIGRY = '154230020';
// Dunajec: last water level on 26/07/2025.
export const SROMOWCE = '149200140';

/** "2026-10-24 03:50:00", in UTC as IMGW-PIB writes it. */
export const apiDate = (time) => new Date(time).toISOString().slice(0, 19).replace('T', ' ');

/** Fake IMGW-PIB. `api.down`: 'network' (connection refused), a status (503) or false. */
export function createApi() {
  const stations = structuredClone(fixture(FIXTURE));
  const find = (id) => stations.find((s) => s.id_stacji === id);

  const api = {
    stations,
    down: false,
    requests: [],
    // A station kept sending fresh levels (set with `clock`): the service is
    // alive, so a silent followed station is the station's own silence.
    pulse: null,
    clock: null,

    /** A new water level (and optionally flow) of a station. */
    setLevel(id, time, value, { flow } = {}) {
      const station = find(id);
      station.stan_wody = String(value);
      station.stan_wody_data_pomiaru = apiDate(time);
      if (flow !== undefined) {
        station.przeplyw = String(flow);
        station.przeplyw_data = apiDate(time);
      }
    },

    /** A new water temperature of a station. */
    setTemperature(id, time, value) {
      const station = find(id);
      station.temperatura_wody = String(value);
      station.temperatura_wody_data_pomiaru = apiDate(time);
    },

    /** The warning and alarm levels of a station, as numbers. */
    thresholds(id) {
      const station = find(id);
      return { warning: Number(station.stan_ostrzegawczy), alarm: Number(station.stan_alarmowy) };
    },

    async fetch(input) {
      const url = new URL(input);
      api.requests.push(url);
      if (api.down === 'network') {
        throw new TypeError('fetch failed');
      }
      if (api.down) {
        return { status: api.down, text: async () => 'Service Unavailable' };
      }
      if (url.href !== API_URL) {
        return { status: 404, text: async () => '<html>404</html>' };
      }
      if (api.pulse && api.clock) {
        api.setLevel(api.pulse, api.clock.now() - 10 * 60 * 1000, 300);
      }
      return { status: 200, text: async () => JSON.stringify(stations) };
    },
  };
  return api;
}

/** A manual clock. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {Array} [options.houses] houses of Gladys
 * @param {object} [options.api] from createApi
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers] true: the monitor's own timer runs (mock it)
 */
export async function createWorld({
  config = {},
  devices = [],
  houses = [HOUSE],
  api = createApi(),
  connect = true,
  timers = false,
  clock = createClock(),
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-imgw-')),
} = {}) {
  api.clock ??= clock;
  const gladys = createFakeGladys({ config, devices, houses });
  const store = new Store(dataDir);
  const app = registerHandlers(gladys, {
    store,
    fetch: api.fetch,
    timers,
    now: clock.now,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.monitor.running;
  }
  return { gladys, fake: gladys.fake, app, monitor: app.monitor, api, clock, store, dataDir };
}

/** The device published for a station id, from the last discovery list. */
export const discovered = (world, id) =>
  world.fake.discoveredDevices.find((device) =>
    device.params.some((p) => p.name === 'STATION_ID' && p.value === id),
  );

/** Create the device of a station in Gladys, as the user would. */
export async function create(world, id) {
  const device = discovered(world, id);
  if (!device) {
    throw new Error(`${id} is not in the discovered devices`);
  }
  await world.fake.deviceCreated(device);
  return device;
}

/** External id of one feature of a device. */
export const featureId = (device, key) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${key}`))?.external_id;

/** Run one refresh cycle, `minutes` later. */
export async function cycle(world, minutes = 30) {
  world.clock.advance(minutes * 60 * 1000);
  await world.monitor.runCycle();
}

/**
 * Capture the integration's log lines at `level` and above (LOG_LEVEL is read
 * at every call). Returns the lines as `{ level, text }`.
 */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
