// -----------------------------------------------------------------------------
// The IMGW-PIB client and the HTTP helper, on the recorded answer.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, USER_AGENT, getJson } from '../src/http.js';
import { API_URL, Imgw, parseDate, parseStation, riverName } from '../src/imgw.js';
import {
  FIXTURE,
  GDANSK,
  SROMOWCE,
  WARSZAWA,
  WIGRY,
  ZUKOWO,
  createApi,
  fixture,
} from './helpers/world.js';

const raw = (id) => fixture(FIXTURE).find((s) => s.id_stacji === id);

test('a station: names, river, coordinates, thresholds, readings with their own date', () => {
  assert.deepEqual(parseStation(raw(WARSZAWA)), {
    id: WARSZAWA,
    name: 'Warszawa-Bulwary',
    river: 'Wisła',
    province: 'mazowieckie',
    latitude: 52.2472,
    longitude: 21.0208,
    km: 421.68,
    thresholds: { warning: 700, alarm: 750 },
    level: { t: Date.parse('2026-10-24T03:50:00Z'), v: 108 },
    flow: { t: Date.parse('2026-10-24T03:50:00Z'), v: 160 },
    temperature: null,
  });
});

test('dates are UTC; rivers "-" and abbreviations of lakes and reservoirs', () => {
  assert.equal(parseDate('2026-10-24 03:50:00'), Date.parse('2026-10-24T03:50:00Z'));
  assert.equal(parseDate(null), null);
  assert.equal(parseDate('yesterday'), null);
  assert.equal(riverName('-'), null);
  assert.equal(riverName('Jez. Drużno'), 'Jezioro Drużno');
  assert.equal(riverName('Zb. Dębe'), 'Zbiornik Dębe');
  assert.equal(riverName('Zb Siemianówka'), 'Zbiornik Siemianówka');
  assert.equal(parseStation(raw(GDANSK)).river, null);
  assert.equal(parseStation(raw(ZUKOWO)).river, 'Jezioro Drużno');
});

test('missing values: no thresholds, no water level, an old level', () => {
  const zukowo = parseStation(raw(ZUKOWO));
  assert.equal(zukowo.thresholds, null);
  assert.deepEqual(zukowo.temperature, { t: Date.parse('2026-10-23T06:00:00Z'), v: 11.7 });
  const wigry = parseStation(raw(WIGRY));
  assert.equal(wigry.level, null);
  assert.equal(wigry.temperature.v, 16);
  assert.deepEqual([wigry.latitude, wigry.longitude], [null, null], 'placed at 0, 0');
  assert.equal(parseStation(raw(SROMOWCE)).level.t, Date.parse('2025-07-26T07:20:00Z'));
  assert.equal(parseStation({ ...raw(WARSZAWA), stan_alarmowy: null }).thresholds, null);
  assert.equal(parseStation({ ...raw(WARSZAWA), przeplyw: '0.64' }).flow.v, 0.64);
});

test('one request for every station', async () => {
  const api = createApi();
  const stations = await new Imgw({ fetch: api.fetch }).stations();
  assert.equal(stations.size, 27);
  assert.equal(stations.get(WARSZAWA).name, 'Warszawa-Bulwary');
  assert.equal(api.requests.length, 1);
  assert.equal(api.requests[0].href, API_URL);
});

test('HTTP failures become an HttpError: status, network, timeout, not JSON', async () => {
  const answer = (status, text) => async () => ({ status, text: async () => text });
  await assert.rejects(getJson(answer(503, ''), 'https://x.test/a'), {
    name: 'HttpError',
    message: 'x.test: HTTP 503',
    status: 503,
  });
  await assert.rejects(getJson(answer(200, '<html>'), 'https://x.test/a'), {
    message: 'x.test: the answer is not JSON',
  });
  await assert.rejects(
    getJson(async () => {
      throw new TypeError('fetch failed');
    }, 'https://x.test/a'),
    { message: 'x.test: fetch failed' },
  );
  await assert.rejects(
    getJson(
      async () => {
        throw Object.assign(new Error('aborted'), { name: 'TimeoutError' });
      },
      'https://x.test/a',
      { timeoutMs: 5000 },
    ),
    (err) => err instanceof HttpError && err.message === 'x.test: no answer in 5 s',
  );
  await assert.rejects(new Imgw({ fetch: answer(200, '{}') }).stations(), /unexpected/);
});

test('every request names the integration and asks for JSON', async () => {
  let headers;
  await getJson(async (url, options) => {
    headers = options.headers;
    return { status: 200, text: async () => '[]' };
  }, 'https://x.test/a');
  assert.equal(headers['User-Agent'], USER_AGENT);
  assert.equal(headers.Accept, 'application/json');
});
