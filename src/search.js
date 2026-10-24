// -----------------------------------------------------------------------------
// The "Find stations" configuration action: lists stations with their river,
// distance from the house and current water level, so the user can copy their
// ids into the configuration.
//
// What can be typed:
//   - nothing: the stations around the house (its location in Gladys);
//   - a station id (152210170);
//   - words: matched against the station, river and province names
//     ("Głogów", "Wisła", "Odra Słubice", "mazowieckie"), case and Polish
//     letters ignored. The matches are listed nearest to the house first, else
//     by river and name.
//
// The search is made on the list of IMGW-PIB (the answer of the last cycle, or
// a new download): the house coordinates never leave Gladys and the container.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { parseToken } from './config.js';
import { distanceKm } from './geo.js';
import { ALERT_NAMES, SEARCH, formatHeight, formatNumber, render } from './messages.js';
import { Monitor, alertOf } from './monitor.js';

const logger = createLogger({ name: 'imgw-search' });

export const SEARCH_RADII = ['10', '20', '50', '100'];
const DEFAULT_RADIUS_KM = 20;
const MAX_RESULTS = 10;

/** Distance from the house to a station in km, null when one has no location. */
const distanceTo = (house, station) =>
  house && station.latitude !== null && station.longitude !== null
    ? distanceKm(house.latitude, house.longitude, station.latitude, station.longitude)
    : null;

/** The stations of a query with their distance, nearest first, else by river and name. */
async function candidates(monitor, text, radiusKm, stations) {
  const house = await monitor.house();
  const query = text.trim();
  if (!query) {
    return house ? { list: Monitor.around(stations, house, radiusKm) } : { error: 'noHouse' };
  }
  const token = parseToken(query);
  let found;
  if (token.kind === 'id') {
    found = stations.has(token.value) ? [stations.get(token.value)] : [];
  } else {
    const words = query.split(/\s+/).filter(Boolean);
    found = [...stations.values()].filter((station) => Monitor.matches(station, words));
  }
  const list = found.map((station) => ({ station, km: distanceTo(house, station) }));
  // Nearest first; stations without coordinates after, by river and name.
  const byName = (a, b) =>
    (a.station.river ?? '').localeCompare(b.station.river ?? '', 'pl') ||
    a.station.name.localeCompare(b.station.name, 'pl');
  list.sort((a, b) => {
    if (a.km !== null && b.km !== null) {
      return a.km - b.km;
    }
    if (a.km !== null || b.km !== null) {
      return a.km === null ? 1 : -1;
    }
    return byName(a, b);
  });
  return { list };
}

/**
 * Handler of the `search_stations` action.
 * @param {Monitor} monitor
 * @param {{ query?: string, radius?: string }} fields
 */
export async function searchStations(monitor, fields = {}) {
  const radiusKm = SEARCH_RADII.includes(String(fields.radius))
    ? Number(fields.radius)
    : DEFAULT_RADIUS_KM;
  try {
    const stations = await monitor.stationList();
    const found = await candidates(monitor, String(fields.query ?? ''), radiusKm, stations);
    if (found.error) {
      return render(SEARCH, found.error);
    }
    const total = found.list.length;
    const listed = found.list.slice(0, MAX_RESULTS);
    logger.info(`Station search: ${total} station(s) found`);
    if (listed.length === 0) {
      return render(SEARCH, 'none');
    }
    return Object.fromEntries(
      Object.keys(SEARCH).map((language) => {
        const texts = SEARCH[language];
        const lines = listed.map(({ station, km }) => {
          let head = `${station.id} — ${station.name}`;
          if (station.river) {
            head += ` (${station.river})`;
          }
          const parts = [head];
          if (km !== null) {
            parts.push(`${formatNumber(km, language, 1)} km`);
          }
          if (station.level && monitor.isFresh(station.level.t)) {
            const alert = alertOf(station.level.v, station.thresholds);
            parts.push(
              formatHeight(station.level.v, language) +
                (alert && alert !== 'normal' ? ` (${ALERT_NAMES[language][alert]})` : ''),
            );
          } else {
            parts.push(texts.noRecent);
          }
          return parts.join(', ');
        });
        return [language, `${texts.found({ count: listed.length, total })}\n${lines.join('\n')}`];
      }),
    );
  } catch (err) {
    logger.warn(`Station search failed: ${err.message}`);
    return render(SEARCH, 'unavailable');
  }
}
