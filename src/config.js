// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// Select values are strings in the manifest (stored by Gladys as typed); the
// normalized config holds numbers.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Kilometres around the house where the nearest stations are followed; '0' = off.
export const HOME_RADII = ['0', '10', '20', '50'];

// Minutes between two readings. Stations send a water level every 10 minutes
// to an hour, and IMGW-PIB publishes them with a delay of about half an hour:
// faster would only download the same ~550 kB again.
export const REFRESH_INTERVALS = ['20', '30', '60'];

// Stations followed "around my house": the nearest ones that send readings.
export const HOME_STATIONS = 3;

// Upper bound of the stations taken from the configuration: one IMGW-PIB
// request covers them all, and the states stay far below the 300 per minute of
// the core.
export const MAX_STATIONS = 20;

export const DEFAULT_CONFIG = {
  stations: '',
  around_home: '0',
  refresh_interval: '30',
  language: 'fr',
};

// Station id (id_stacji): nine digits, e.g. 152210170 for Warszawa-Bulwary.
const ID = /^\d{9}$/;
// An address holding a station id, e.g. …/station/hydro/152210170.
const ID_IN_URL = /\/hydro\/(\d{9})\b/;

/**
 * What one token of the "Stations" field designates: a station id, or a name.
 * Names may hold spaces ("Warszawa-Bulwary", "Krosno Wisłok"): tokens are only
 * separated by commas, semicolons and line breaks.
 */
export function parseToken(token) {
  const text = String(token ?? '').trim();
  const inUrl = ID_IN_URL.exec(text);
  if (inUrl) {
    return { kind: 'id', value: inUrl[1], text };
  }
  if (ID.test(text)) {
    return { kind: 'id', value: text, text };
  }
  return { kind: 'name', value: text, text };
}

/** The tokens of the "Stations" field, duplicates removed. */
export function parseStations(text) {
  const seen = new Set();
  const tokens = [];
  for (const raw of String(text ?? '').split(/[,;\n]+/)) {
    if (!raw.trim()) {
      continue;
    }
    const token = parseToken(raw);
    const key = `${token.kind}:${normalizeName(token.value)}`;
    if (!seen.has(key)) {
      seen.add(key);
      tokens.push(token);
    }
  }
  return tokens;
}

/**
 * A name reduced for comparison: case, Polish letters and punctuation ignored,
 * so "Wrocław", "wroclaw" and "WROCLAW" match. "ł" has no decomposition in
 * Unicode: it is replaced by hand.
 */
export function normalizeName(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const pick = (value, allowed, fallback) =>
  allowed.includes(String(value)) ? Number(value) : Number(fallback);

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    stations: parseStations(source.stations),
    homeRadiusKm: pick(source.around_home, HOME_RADII, DEFAULT_CONFIG.around_home),
    refreshMinutes: pick(
      source.refresh_interval,
      REFRESH_INTERVALS,
      DEFAULT_CONFIG.refresh_interval,
    ),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
