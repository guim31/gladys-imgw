// -----------------------------------------------------------------------------
// The configuration: tokens of the "Stations" field, name comparison, defaults.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, normalizeName, parseStations } from '../src/config.js';

test('station tokens: ids, map addresses and names with spaces', () => {
  const tokens = parseStations(
    '152210170, Krosno Wisłok; Warszawa - Nadwilanówka\n' +
      'https://hydro.imgw.pl/station/hydro/151170030, 152210170, ,1234',
  );
  assert.deepEqual(
    tokens.map(({ kind, value }) => [kind, value]),
    [
      ['id', '152210170'],
      ['name', 'Krosno Wisłok'],
      ['name', 'Warszawa - Nadwilanówka'],
      ['id', '151170030'],
      ['name', '1234'],
    ],
  );
});

test('names compare without case, Polish letters nor punctuation', () => {
  assert.equal(normalizeName('Wrocław'), 'wroclaw');
  assert.equal(normalizeName('ŁÓDŹ'), normalizeName('lodz'));
  assert.equal(normalizeName('Żukowo'), 'zukowo');
  assert.equal(normalizeName('Warszawa - Nadwilanówka'), normalizeName('warszawa-nadwilanowka'));
});

test('defaults, and unknown values fall back to them', () => {
  assert.deepEqual(normalizeConfig({}), {
    stations: [],
    homeRadiusKm: 0,
    refreshMinutes: 30,
    language: DEFAULT_CONFIG.language,
  });
  const config = normalizeConfig({ around_home: '7', refresh_interval: '1', language: 'it' });
  assert.deepEqual([config.homeRadiusKm, config.refreshMinutes, config.language], [0, 30, 'fr']);
  assert.equal(normalizeConfig({ around_home: '50', refresh_interval: '60' }).refreshMinutes, 60);
  assert.deepEqual(normalizeConfig(null).stations, []);
});
