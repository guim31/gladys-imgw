// -----------------------------------------------------------------------------
// IMGW-PIB public data API (Instytut Meteorologii i Gospodarki Wodnej, the
// Polish institute of meteorology and water management): keyless, no account.
//
//   https://danepubliczne.imgw.pl/api/data/hydro/   every hydrological station
//                                                   (~900, ~550 kB) with its
//                                                   location, its warning and
//                                                   alarm levels and its latest
//                                                   readings, in ONE request
//
// The same answer serves as the station list (names, rivers, coordinates) and
// as the readings: one request per cycle, whatever the number of stations.
//
// Everything is turned into plain objects here, so the rest of the code never
// reads the Polish field names. Kept: water level (stan_wody, cm), flow
// (przeplyw, m³/s), water temperature (temperatura_wody, °C), the warning and
// alarm levels (stan_ostrzegawczy, stan_alarmowy, cm), each reading with its
// own date.
//
// Dates are written "2026-10-24 03:50:00" without a zone: they are UTC (checked
// on 24/10/2026, a reading of 04:00 was served at 04:15 UTC; the water
// temperature is read at 06:00, the synoptic hour). The Python library of Home
// Assistant reads them as Warsaw time, two hours off in summer.
// -----------------------------------------------------------------------------

import { getJson } from './http.js';

export const API_URL = 'https://danepubliczne.imgw.pl/api/data/hydro/';
// The hydrological map of IMGW-PIB. Its station pages (/station/hydro/<id>)
// answer 404 when opened directly (24/10/2026): only the map is linked.
export const SITE_URL = 'https://hydro.imgw.pl/';

// The readings of a station, by key, with their own date.
export const SERIES = ['level', 'flow', 'temperature'];

// The thresholds a scene can wait for (manifest `threshold_crossed`), lowest first.
export const THRESHOLDS = ['warning', 'alarm'];

const DATE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/;

/** "2026-10-24 03:50:00" (UTC) → ms, or null. */
export function parseDate(text) {
  const match = DATE.exec(String(text ?? '').trim());
  if (!match) {
    return null;
  }
  const time = Date.parse(`${match[1]}T${match[2]}Z`);
  return Number.isFinite(time) ? time : null;
}

/** A number of the API (given as a string, "246" or "0.64"), or null. */
export function parseNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

/**
 * The river of a station: "-" (sea gauges) is no river, and the abbreviations
 * of lakes and reservoirs are written out ("Jez. Drużno" → "Jezioro Drużno",
 * "Zb. Dębe" → "Zbiornik Dębe"), as the Home Assistant library does.
 */
export function riverName(text) {
  const value = String(text ?? '').trim();
  if (!value || value === '-') {
    return null;
  }
  return value
    .replace(/\b[Jj]ez\.\s*/g, 'Jezioro ')
    .replace(/\b[Zz]b\.?\s+/g, 'Zbiornik ')
    .replace(/\s+/g, ' ');
}

const reading = (value, date) => {
  const v = parseNumber(value);
  const t = parseDate(date);
  return v !== null && t !== null ? { t, v } : null;
};

/** A station of the API, reduced and renamed. */
export function parseStation(raw) {
  const warning = parseNumber(raw.stan_ostrzegawczy);
  const alarm = parseNumber(raw.stan_alarmowy);
  let latitude = parseNumber(raw.lat);
  let longitude = parseNumber(raw.lon);
  // A few stations are placed at 0, 0 (Wigry, 24/10/2026): no location.
  if (!latitude && !longitude) {
    latitude = null;
    longitude = null;
  }
  return {
    id: String(raw.id_stacji).trim(),
    name: String(raw.stacja ?? '')
      .trim()
      .replace(/\s+/g, ' '),
    river: riverName(raw.rzeka),
    province: raw.wojewodztwo ? String(raw.wojewodztwo) : null,
    latitude,
    longitude,
    km: parseNumber(raw.kilometr_biegu_rzeki),
    // Both or none: a station is rated against its two thresholds together.
    thresholds: warning !== null && alarm !== null ? { warning, alarm } : null,
    level: reading(raw.stan_wody, raw.stan_wody_data_pomiaru),
    flow: reading(raw.przeplyw, raw.przeplyw_data),
    temperature: reading(raw.temperatura_wody, raw.temperatura_wody_data_pomiaru),
  };
}

export class Imgw {
  /**
   * @param {object} [options]
   * @param {Function} [options.fetch]
   */
  constructor({ fetch: fetchImpl } = {}) {
    this.fetch = fetchImpl ?? globalThis.fetch;
  }

  /** Every station with its latest readings, by id. */
  async stations() {
    const body = await getJson(this.fetch, API_URL);
    if (!Array.isArray(body)) {
      throw new Error('IMGW-PIB: unexpected answer for the stations');
    }
    const stations = new Map();
    for (const raw of body) {
      if (raw && raw.id_stacji) {
        const station = parseStation(raw);
        stations.set(station.id, station);
      }
    }
    return stations;
  }
}
