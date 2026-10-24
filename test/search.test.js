// -----------------------------------------------------------------------------
// The "Find stations" action, on the recorded station list.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOUSE, WARSZAWA, captureLogs, createWorld } from './helpers/world.js';

async function search(t, fields, options = {}) {
  const world = await createWorld(options);
  t.after(() => world.app.stop());
  const ack = await world.fake.action('search_stations', fields);
  assert.equal(ack.success, true);
  return { message: ack.data.message, world };
}

test('empty: the stations around the house, nearest first, with their level', async (t) => {
  const { message } = await search(t, {}, {});
  const lines = message.de.split('\n');
  assert.equal(lines[0], '4 Station(en). Kopiere die IDs in „Stationen“ und speichere:');
  assert.equal(lines[1], '152210170 — Warszawa-Bulwary (Wisła), 2 km, 108 cm');
  assert.equal(lines[2], '152210040 — Warszawa - Nadwilanówka (Wisła), 8,6 km, 37 cm');
});

test('a larger radius', async (t) => {
  const { message } = await search(t, { radius: '50' });
  assert.equal(message.en.split('\n')[0], '9 station(s). Copy the ids into "Stations", then save:');
});

test('a river, then a river and a name, a province; case and Polish letters ignored', async (t) => {
  const { message } = await search(t, { query: 'odra' }, { houses: [] });
  assert.match(message.fr, /^3 station\(s\)\./);
  assert.match(message.fr, /\n152140020 — Gozdowice \(Odra\), 191 cm/);
  const both = await search(t, { query: 'Wisla warszawa' }, { houses: [] });
  assert.equal(both.message.en.split('\n').length, 3);
  const province = await search(t, { query: 'dolnoslaskie' }, { houses: [] });
  assert.match(province.message.en, /151170030 — Trestno \(Odra\), 316 cm/);
});

test('a station id and a map address; the alert level when reached', async (t) => {
  const { message } = await search(t, { query: WARSZAWA });
  assert.match(
    message.en,
    /^1 station\(s\)[^\n]*\n152210170 — Warszawa-Bulwary \(Wisła\), 2 km, 108 cm$/,
  );
  const world = await createWorld({ houses: [] });
  t.after(() => world.app.stop());
  world.api.setLevel('152200090', world.clock.now(), 290);
  const ack = await world.fake.action('search_stations', {
    query: 'https://hydro.imgw.pl/station/hydro/152200090',
  });
  assert.match(ack.data.message.fr, /152200090 — Krubice \(Utrata\), 290 cm \(Alarme\)/);
});

test('a stale station says so', async (t) => {
  const { message } = await search(t, { query: 'Sromowce' }, { houses: [] });
  assert.match(message.en, /149200140 — Sromowce Wyżne \(Dunajec\), no recent reading/);
});

test('nothing found, no located house, IMGW-PIB unavailable', async (t) => {
  assert.equal((await search(t, { query: 'Seine' })).message.en, 'No station found.');
  assert.match((await search(t, {}, { houses: [] })).message.fr, /^Votre maison n'a pas/);
  const world = await createWorld();
  t.after(() => world.app.stop());
  world.api.down = 'network';
  const ack = await world.fake.action('search_stations', { query: 'Wisła' });
  assert.match(ack.data.message.en, /IMGW-PIB does not answer/);
});

test('the list of the last cycle serves the searches for ten minutes', async (t) => {
  const world = await createWorld({ config: { stations: WARSZAWA } });
  t.after(() => world.app.stop());
  const requests = world.api.requests.length;
  await world.fake.action('search_stations', { query: 'Odra' });
  assert.equal(world.api.requests.length, requests);
  world.clock.advance(11 * 60 * 1000);
  await world.fake.action('search_stations', { query: 'Odra' });
  assert.equal(world.api.requests.length, requests + 1);
});

test('one info line per search, without the house coordinates', async (t) => {
  const lines = captureLogs(t, 'debug');
  await search(t, { radius: '50' });
  const info = lines.filter((line) => line.level === 'info').map((line) => line.text);
  assert.ok(info.some((text) => /Station search: 9 station\(s\) found/.test(text)));
  const all = lines.map((line) => line.text).join('\n');
  assert.doesNotMatch(all, new RegExp(String(HOUSE.latitude).replace('.', '\\.')));
});
