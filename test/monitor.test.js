// -----------------------------------------------------------------------------
// The monitor against the recorded IMGW-PIB answer of 24/10/2026: what is
// discovered and published, the internal timer, stale readings, the scene
// triggers, failures, restarts and the configuration paths.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_STATIONS } from '../src/config.js';
import { alertOf, trendOf } from '../src/monitor.js';
import {
  GDANSK,
  HOUSE,
  KRUBICE,
  SROMOWCE,
  START,
  TRESTNO,
  WARSZAWA,
  WIGRY,
  ZUKOWO,
  create,
  createApi,
  createWorld,
  cycle,
  discovered,
  featureId,
} from './helpers/world.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const lastValue = (world, externalId) => world.fake.lastState(externalId);
const keyOf = (feature) => feature.external_id.split(':').pop();

async function followed(t, ids, config = {}) {
  const world = await createWorld({ config: { stations: ids.join(','), ...config } });
  t.after(() => world.app.stop());
  const devices = [];
  for (const id of ids) {
    devices.push(await create(world, id));
  }
  return { world, devices };
}

test('Warszawa-Bulwary: water level in cm, flow, alert level, last reading', async (t) => {
  const { world, devices } = await followed(t, [WARSZAWA]);
  const [device] = devices;
  assert.equal(device.name, 'Warszawa-Bulwary / Wisła');
  assert.equal(device.model, 'IMGW-PIB');
  assert.equal(device.should_poll, false);
  assert.deepEqual(
    device.params.map((p) => [p.name, p.value]),
    [
      ['STATION_ID', WARSZAWA],
      ['STATION_NAME', 'Warszawa-Bulwary'],
      ['RIVER', 'Wisła'],
      ['PROVINCE', 'mazowieckie'],
    ],
  );
  assert.deepEqual(
    device.features.map((f) => [keyOf(f), f.name, f.unit]),
    [
      ['height', "Hauteur d'eau", 'cm'],
      ['flow', 'Débit (m³/s)', undefined],
      ['alert_level', "Niveau d'alerte (0 à 2)", undefined],
      ['last_reading', 'Dernière mesure', undefined],
    ],
  );
  assert.equal(lastValue(world, featureId(device, 'height')), 108);
  assert.equal(lastValue(world, featureId(device, 'flow')), 160);
  assert.equal(lastValue(world, featureId(device, 'alert_level')), 0, 'below 700 cm');
  // 03:50 UTC is 05:50 in Warsaw (summer time until 25/10).
  assert.equal(lastValue(world, featureId(device, 'last_reading')), '24/10 05:50');
});

test('Gdańsk, a sea gauge: no river, daily water temperature; Żukowo: no thresholds', async (t) => {
  const { world, devices } = await followed(t, [GDANSK, ZUKOWO, TRESTNO], { language: 'de' });
  const [gdansk, zukowo, trestno] = devices;
  assert.equal(gdansk.name, 'Gdańsk');
  assert.deepEqual(
    gdansk.features.map((f) => f.name),
    ['Wasserstand', 'Wassertemperatur', 'Alarmstufe (0 bis 2)', 'Letzte Messung'],
  );
  // Read on 23/10 at 06:00 UTC, 22 hours before: still the current one.
  assert.equal(lastValue(world, featureId(gdansk, 'water_temperature')), 13.5);
  assert.equal(zukowo.name, 'Żukowo / Jezioro Drużno');
  assert.deepEqual(zukowo.features.map(keyOf), ['height', 'water_temperature', 'last_reading']);
  assert.deepEqual(trestno.features.map(keyOf), ['height', 'alert_level', 'last_reading']);
  assert.equal(lastValue(world, featureId(trestno, 'height')), 316);
});

test('Wigry: a lake that only sends its temperature, silent since 30/09', async (t) => {
  const { world, devices } = await followed(t, [WIGRY]);
  const [device] = devices;
  assert.deepEqual(device.features.map(keyOf), ['water_temperature', 'last_reading']);
  assert.equal(lastValue(world, featureId(device, 'water_temperature')), undefined, 'stale');
  assert.equal(
    lastValue(world, featureId(device, 'last_reading')),
    'Pas de nouvelle mesure depuis le 30/09 08:00',
  );
});

test('one IMGW-PIB request per cycle for every station, by the internal timer', async (t) => {
  const timers = t.mock.timers;
  timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const world = await createWorld({
    config: { stations: [WARSZAWA, TRESTNO, 'Krubice'].join(',') },
    timers: true,
  });
  t.after(() => world.app.stop());
  await create(world, WARSZAWA);
  world.api.requests.length = 0;
  world.clock.advance(30 * MINUTE);
  world.api.setLevel(WARSZAWA, world.clock.now(), 112);
  timers.tick(30 * MINUTE);
  await world.monitor.running;
  assert.equal(world.api.requests.length, 1, 'one request, names included');
  assert.deepEqual(world.monitor.followed(), [WARSZAWA, TRESTNO, KRUBICE]);
  assert.equal(lastValue(world, featureId(discovered(world, WARSZAWA), 'height')), 112);
});

test('only the changes are published, and a stable value again after 12 hours', async (t) => {
  // The SDK dates its memory of the published states with Date.now().
  t.mock.timers.enable({ apis: ['Date'], now: START });
  const { world, devices } = await followed(t, [WARSZAWA]);
  const height = featureId(devices[0], 'height');
  const count = () =>
    world.fake.states.filter((s) => s.device_feature_external_id === height).length;
  const before = count();
  for (let i = 0; i < 23; i += 1) {
    t.mock.timers.tick(30 * MINUTE);
    world.api.setLevel(WARSZAWA, world.clock.now() + 30 * MINUTE, 108);
    await cycle(world, 30);
  }
  assert.equal(count(), before, 'same value at a new time: nothing sent before 12 hours');
  t.mock.timers.tick(30 * MINUTE);
  world.api.setLevel(WARSZAWA, world.clock.now() + 30 * MINUTE, 108);
  await cycle(world, 30);
  assert.equal(count(), before + 1, 'heartbeat');
  world.api.setLevel(WARSZAWA, world.clock.now(), 109);
  await cycle(world, 1);
  assert.equal(count(), before + 2, 'a change');
});

test('a silent station is not published as fresh, and says since when', async (t) => {
  const { world, devices } = await followed(t, [SROMOWCE]);
  const [device] = devices;
  assert.equal(lastValue(world, featureId(device, 'height')), undefined);
  assert.equal(lastValue(world, featureId(device, 'alert_level')), undefined);
  assert.equal(
    lastValue(world, featureId(device, 'last_reading')),
    'Pas de nouvelle mesure depuis le 26/07 09:20',
  );
});

test('a reading growing old: the values stop, "Last reading" says since when', async (t) => {
  const { world, devices } = await followed(t, [WARSZAWA]);
  for (let i = 0; i < 13; i += 1) {
    await cycle(world, 30);
  }
  assert.equal(
    lastValue(world, featureId(devices[0], 'last_reading')),
    'Pas de nouvelle mesure depuis le 24/10 05:50',
  );
});

test('the trend compares the level with the one of about an hour before', () => {
  const at = (minutes, v) => ({ t: minutes * MINUTE, v });
  assert.equal(trendOf([at(60, 110), at(45, 105), at(0, 100)]), 'rising');
  assert.equal(trendOf([at(60, 90), at(0, 100)]), 'falling');
  assert.equal(trendOf([at(60, 100.5), at(0, 100)]), 'steady');
  assert.equal(trendOf([at(60, 100), at(30, 100)]), null, 'too short');
  assert.equal(trendOf([at(300, 100), at(0, 100)]), null, 'too old');
  assert.equal(trendOf([]), null);
});

test('the alert level: at the warning level, at the alarm level', () => {
  const thresholds = { warning: 220, alarm: 280 };
  assert.equal(alertOf(219, thresholds), 'normal');
  assert.equal(alertOf(220, thresholds), 'warning');
  assert.equal(alertOf(279, thresholds), 'warning');
  assert.equal(alertOf(280, thresholds), 'alarm');
  assert.equal(alertOf(300, null), null);
  assert.equal(alertOf(null, thresholds), null);
});

test('Krubice rises past its warning then alarm levels: one event per crossing', async (t) => {
  const { world, devices } = await followed(t, [KRUBICE], { language: 'de' });
  const [device] = devices;
  const { warning, alarm } = world.api.thresholds(KRUBICE);
  assert.deepEqual([warning, alarm], [220, 280]);
  const now = () => world.clock.now();
  const level = async (value) => {
    world.api.setLevel(KRUBICE, now(), value);
    await cycle(world, 30);
  };
  await level(warning);
  assert.equal(lastValue(world, featureId(device, 'alert_level')), 1);
  // Wobbling around the warning level: no new crossing until it really falls below.
  await level(warning - 1);
  await level(warning + 1);
  await level(alarm + 5);
  assert.equal(lastValue(world, featureId(device, 'alert_level')), 2);
  await level(alarm - 1);
  // 2 cm below the levels: the falls count, the alarm level first.
  await level(warning - 2);
  assert.equal(lastValue(world, featureId(device, 'alert_level')), 0);
  const events = world.fake.sceneEvents.map((event) => [
    event.key,
    event.data.threshold,
    event.data.direction,
  ]);
  assert.deepEqual(events, [
    ['threshold_crossed', 'warning', 'rising'],
    ['threshold_crossed', 'alarm', 'rising'],
    ['threshold_crossed', 'alarm', 'falling'],
    ['threshold_crossed', 'warning', 'falling'],
  ]);
  assert.deepEqual(world.fake.sceneEvents[1].data, {
    station: device.external_id,
    station_name: 'Krubice',
    river: 'Utrata',
    height: alarm + 5,
    threshold: 'alarm',
    threshold_name: 'Alarmstufe',
    threshold_value: alarm,
    direction: 'rising',
  });
});

test('no trigger without a created device, nor for a stale reading or the first one', async (t) => {
  const world = await createWorld({ config: { stations: KRUBICE } });
  t.after(() => world.app.stop());
  world.api.setLevel(KRUBICE, world.clock.now(), 300);
  await cycle(world, 30);
  assert.deepEqual(world.fake.sceneEvents, [], 'no device');
  await create(world, KRUBICE);
  world.api.setLevel(KRUBICE, world.clock.now() - 7 * HOUR, 100);
  await cycle(world, 30);
  assert.deepEqual(world.fake.sceneEvents, [], 'stale');
});

test('readings stopped, then resumed: one event each', async (t) => {
  const { world, devices } = await followed(t, [WARSZAWA], { language: 'en' });
  for (let i = 0; i < 13; i += 1) {
    await cycle(world, 30);
  }
  world.api.setLevel(WARSZAWA, world.clock.now(), 110);
  await cycle(world, 30);
  await cycle(world, 30);
  assert.deepEqual(
    world.fake.sceneEvents.map((event) => event.key),
    ['readings_stopped', 'readings_resumed'],
  );
  assert.deepEqual(world.fake.sceneEvents[0].data, {
    station: devices[0].external_id,
    station_name: 'Warszawa-Bulwary',
    river: 'Wisła',
    last_reading: '24/10, 05:50',
  });
});

test('the sides remembered survive a restart; a day-old memory fires nothing', async (t) => {
  const api = createApi();
  const first = await createWorld({ api, config: { stations: KRUBICE } });
  const device = await create(first, KRUBICE);
  await first.app.stop();
  const second = await createWorld({
    api,
    config: { stations: KRUBICE },
    devices: [device],
    dataDir: first.dataDir,
    clock: first.clock,
  });
  t.after(() => second.app.stop());
  api.setLevel(KRUBICE, second.clock.now(), 230);
  await cycle(second, 30);
  assert.ok(second.fake.sceneEvents.some((event) => event.key === 'threshold_crossed'));

  const third = await createWorld({
    api,
    config: { stations: KRUBICE },
    devices: [device],
    dataDir: first.dataDir,
    clock: first.clock,
  });
  t.after(() => third.app.stop());
  third.clock.advance(2 * 24 * HOUR);
  api.setLevel(KRUBICE, third.clock.now(), 100);
  await cycle(third, 1);
  assert.deepEqual(
    third.fake.sceneEvents.filter((event) => event.key === 'threshold_crossed'),
    [],
  );
});

test('a threshold changed by IMGW-PIB is taken without firing', async (t) => {
  const { world } = await followed(t, [KRUBICE]);
  const raw = world.api.stations.find((s) => s.id_stacji === KRUBICE);
  raw.stan_ostrzegawczy = '200';
  world.api.setLevel(KRUBICE, world.clock.now(), 212);
  await cycle(world, 30);
  assert.deepEqual(world.fake.sceneEvents, []);
});

test('names (case, Polish letters, with the river) and map addresses resolve', async (t) => {
  const world = await createWorld({
    config: {
      stations:
        'trestno; KRUBICE, warszawa-bulwary\nhttps://hydro.imgw.pl/station/hydro/154180140, Krosno Wisłok, Nowhere, 999999999',
    },
  });
  t.after(() => world.app.stop());
  assert.deepEqual(world.monitor.followed(), [TRESTNO, KRUBICE, WARSZAWA, GDANSK, '149210110']);
  const status = world.fake.connectionStatus;
  assert.equal(status.connected, true);
  assert.match(status.message.fr, /Station inconnue : Nowhere, 999999999/);
});

test('a name shared by several stations asks for its river', async (t) => {
  const world = await createWorld({ config: { stations: 'Krosno' } });
  t.after(() => world.app.stop());
  assert.deepEqual(world.monitor.followed(), []);
  assert.match(
    world.fake.connectionStatus.message.en,
    /Several stations are named Krosno: give the river too/,
  );
});

test('IMGW-PIB unavailable: disconnected status, then back when it answers', async (t) => {
  const { world, devices } = await followed(t, [WARSZAWA]);
  world.api.down = 503;
  await cycle(world, 30);
  let status = world.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.match(status.message.de, /IMGW-PIB antwortet nicht/);
  assert.deepEqual(world.monitor.followed(), [WARSZAWA], 'still followed');
  assert.ok(discovered(world, WARSZAWA));
  world.api.down = false;
  world.api.setLevel(WARSZAWA, world.clock.now(), 111);
  await cycle(world, 30);
  status = world.fake.connectionStatus;
  assert.equal(status.connected, true);
  assert.equal(status.message, undefined);
  assert.equal(lastValue(world, featureId(devices[0], 'height')), 111);
});

test('"around my house" adds the 3 nearest stations that send readings', async (t) => {
  const world = await createWorld({ config: { around_home: '20' } });
  t.after(() => world.app.stop());
  assert.deepEqual(world.monitor.followed(), [WARSZAWA, '152210040', '152219996']);
  assert.ok(
    world.api.requests.every((url) => !url.href.includes(String(HOUSE.latitude))),
    'the house location is never sent',
  );
  assert.equal(JSON.stringify(world.monitor.data).includes(String(HOUSE.latitude)), false);
});

test('"around my house" without a located house is reported', async (t) => {
  const world = await createWorld({ config: { around_home: '20' }, houses: [] });
  t.after(() => world.app.stop());
  assert.match(world.fake.connectionStatus.message.fr, /Autour de ma maison/);
});

test('an empty configuration says what to do', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.match(world.fake.connectionStatus.message.en, /No station yet/);
  assert.deepEqual(world.api.requests, [], 'nothing to ask');
});

test(`the configuration follows ${MAX_STATIONS} stations at most`, async (t) => {
  const ids = createApi().stations.map((s) => s.id_stacji);
  const world = await createWorld({ config: { stations: ids.join(',') } });
  t.after(() => world.app.stop());
  assert.equal(world.monitor.followed().length, MAX_STATIONS);
  assert.match(world.fake.connectionStatus.message.en, /first 20 stations/);
});

test('a created device stays followed once removed from the configuration', async (t) => {
  const { world } = await followed(t, [WARSZAWA]);
  await world.fake.configUpdated({ stations: '' });
  await world.monitor.running;
  assert.deepEqual(world.monitor.followed(), [WARSZAWA]);
  assert.ok(discovered(world, WARSZAWA));
  await cycle(world, 30);
  assert.ok(world.api.requests.length > 0, 'still read');
});

test('a created device gets all its states at once, and the widget is refreshed', async (t) => {
  const world = await createWorld({ config: { stations: WARSZAWA } });
  t.after(() => world.app.stop());
  const refreshes = world.fake.widgetRefreshes.length;
  world.clock.advance(MINUTE);
  const device = await create(world, WARSZAWA);
  assert.equal(lastValue(world, featureId(device, 'height')), 108);
  assert.equal(lastValue(world, featureId(device, 'alert_level')), 0);
  assert.ok(world.fake.widgetRefreshes.length > refreshes);
});

test('a reconnection publishes the devices and every state again', async (t) => {
  const { world, devices } = await followed(t, [WARSZAWA]);
  const before = world.fake.states.length;
  await world.gladys.disconnect();
  await world.gladys.connect();
  assert.equal(world.fake.states.length, before * 2);
  assert.equal(world.fake.discoveredDevices[0].external_id, devices[0].external_id);
});

test('onPoll, should a Gladys call it: reads again only when the cycle is old', async (t) => {
  const { world, devices } = await followed(t, [WARSZAWA]);
  const requests = world.api.requests.length;
  await world.fake.poll(devices[0]);
  assert.equal(world.api.requests.length, requests);
  world.clock.advance(20 * MINUTE);
  await world.fake.poll(devices[0]);
  assert.equal(world.api.requests.length, requests + 1);
});

test('a device created after a restart, from its params alone, before any answer', async (t) => {
  const api = createApi();
  const first = await createWorld({ api, config: { stations: KRUBICE } });
  const device = await create(first, KRUBICE);
  await first.app.stop();
  api.down = 'network';
  const second = await createWorld({ api, config: { stations: '' }, devices: [device] });
  t.after(() => second.app.stop());
  assert.deepEqual(
    second.fake.discoveredDevices[0].features.map(keyOf),
    device.features.map(keyOf),
    'same features, rebuilt from the device',
  );
  assert.equal(second.fake.discoveredDevices[0].name, 'Krubice / Utrata');
});

test('a device update republishes the states', async (t) => {
  const { world, devices } = await followed(t, [WARSZAWA]);
  const before = world.fake.states.length;
  world.gladys.forgetPublishedStates?.();
  await world.fake.deviceUpdated(devices[0]);
  assert.ok(world.fake.states.length > before, 'states published again after "Update"');
});

test('a configuration saved during a cycle is applied right after it', async (t) => {
  const world = await createWorld({ config: { stations: WARSZAWA } });
  t.after(() => world.app.stop());
  const running = world.monitor.runCycle();
  const saved = world.fake.configUpdated({ stations: `${WARSZAWA}, ${TRESTNO}` });
  await running;
  await saved;
  await world.monitor.rerun;
  assert.deepEqual(world.monitor.followed(), [WARSZAWA, TRESTNO]);
  assert.ok(discovered(world, TRESTNO));
});

test('a failed start keeps the internal timer', async (t) => {
  const timers = t.mock.timers;
  timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const gladysFail = { fail: true };
  const world = await createWorld({ config: { stations: WARSZAWA }, timers: true, connect: false });
  t.after(() => world.app.stop());
  const publish = world.gladys.publishDiscoveredDevices.bind(world.gladys);
  t.mock.method(world.gladys, 'publishDiscoveredDevices', async (devices) => {
    if (gladysFail.fail) {
      throw new Error('HTTP 503');
    }
    return publish(devices);
  });
  await world.gladys.connect();
  await world.app.ready;
  assert.ok(world.monitor.cycleTimer, 'scheduled despite the failure');
  gladysFail.fail = false;
  const requests = world.api.requests.length;
  world.clock.advance(30 * MINUTE);
  timers.tick(30 * MINUTE);
  await world.monitor.running;
  assert.equal(world.api.requests.length, requests + 1);
});

test('the stations no longer followed are forgotten in /data', async (t) => {
  const world = await createWorld({ config: { stations: `${WARSZAWA}, ${TRESTNO}` } });
  t.after(() => world.app.stop());
  assert.ok(world.monitor.data.readings[TRESTNO]);
  await world.fake.configUpdated({ stations: WARSZAWA });
  await world.monitor.running;
  assert.equal(world.monitor.data.readings[TRESTNO], undefined);
  assert.equal(world.monitor.data.stations[TRESTNO], undefined);
  assert.ok(world.monitor.data.readings[WARSZAWA]);
});

test('the houses of Gladys unreadable: no "give your house a location", tried again', async (t) => {
  const world = await createWorld({
    config: { stations: TRESTNO, around_home: '20' },
    connect: false,
  });
  t.after(() => world.app.stop());
  const houses = t.mock.method(world.gladys, 'getHouses', async () => {
    throw new Error('HTTP 500');
  });
  await world.gladys.connect();
  await world.app.ready;
  await world.monitor.running;
  const status = world.fake.connectionStatus;
  assert.doesNotMatch(status.message.en, /give your house a location/);
  assert.match(status.message.en, /cannot be chosen yet/);
  assert.deepEqual(world.monitor.followed(), [TRESTNO]);
  houses.mock.restore();
  await cycle(world, 30);
  assert.deepEqual(world.monitor.followed(), [TRESTNO, WARSZAWA, '152210040', '152219996']);
  assert.equal(world.fake.connectionStatus.connected, true);
});
