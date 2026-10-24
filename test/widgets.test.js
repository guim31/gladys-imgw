// -----------------------------------------------------------------------------
// The `stations` dashboard widget: the content fits the core vocabulary and
// budget (validateWidgetContent, empty array = rendered as sent), every bound
// feature exists on a published device, and the colours follow the alert level.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIDGET_COLORS, validateWidgetContent } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from '../src/config.js';
import { WIDGET_KEY } from '../src/monitor.js';
import { stationValue } from '../src/widgets.js';
import {
  GDANSK,
  KRUBICE,
  SROMOWCE,
  WARSZAWA,
  WIGRY,
  ZUKOWO,
  create,
  createWorld,
  cycle,
} from './helpers/world.js';

async function worldWith(t, ids) {
  const world = await createWorld({ config: { stations: ids.join(',') } });
  t.after(() => world.app.stop());
  const devices = [];
  for (const id of ids) {
    devices.push(await create(world, id));
  }
  return { world, devices };
}

async function content(world, settings = {}, language = 'fr') {
  const ack = await world.fake.widgetGet(WIDGET_KEY, { settings, language, units: 'metric' });
  assert.equal(ack.success, true);
  return ack.data.content;
}

const features = (devices) =>
  new Set(devices.flatMap((device) => device.features.map((feature) => feature.external_id)));

test('the overview: one line per station, valid in every language', async (t) => {
  const { world } = await worldWith(t, [WARSZAWA, ZUKOWO, SROMOWCE, WIGRY]);
  for (const language of LANGUAGES) {
    const widget = await content(world, {}, language);
    assert.deepEqual(validateWidgetContent(widget), [], language);
    assert.equal(widget.components.find((c) => c.type === 'status').items.length, 4);
  }
  const widget = await content(world, {}, 'de');
  const [warszawa, zukowo, sromowce, wigry] = widget.components.find(
    (c) => c.type === 'status',
  ).items;
  assert.deepEqual(warszawa, {
    label: 'Warszawa-Bulwary / Wisła',
    value: '108 cm',
    color: WIDGET_COLORS.SUCCESS,
    icon: 'clock',
  });
  assert.deepEqual([zukowo.value, zukowo.color], ['555 cm', WIDGET_COLORS.NEUTRAL]);
  assert.deepEqual(
    [sromowce.value, sromowce.color],
    ['Still seit 26.07., 09:20', WIDGET_COLORS.NEUTRAL],
  );
  assert.equal(wigry.value, 'Still seit 30.09., 08:00');
  assert.match(widget.components.find((c) => c.type === 'text').text, /^Quelle: IMGW-PIB · /);
  assert.deepEqual(widget.components.at(-1).link, { url: 'https://hydro.imgw.pl/' });
});

test('a warning level reached adds a heading and colours the station; the trend shows', async (t) => {
  const { world } = await worldWith(t, [KRUBICE, WARSZAWA]);
  for (const level of [214, 218, 222, 226]) {
    world.api.setLevel(KRUBICE, world.clock.now(), level);
    await cycle(world, 30);
  }
  const widget = await content(world, {}, 'en');
  assert.deepEqual(validateWidgetContent(widget), []);
  assert.deepEqual(widget.components[0], {
    type: 'text',
    variant: 'heading',
    text: 'Warning level reached: Krubice',
  });
  const [krubice] = widget.components.find((c) => c.type === 'status').items;
  assert.deepEqual(krubice, {
    label: 'Krubice / Utrata',
    value: '226 cm, rising',
    color: WIDGET_COLORS.WARNING,
    icon: 'trending-up',
  });
  world.api.setLevel(KRUBICE, world.clock.now(), 290);
  await cycle(world, 30);
  const alarm = await content(world, {}, 'en');
  assert.equal(
    alarm.components.find((c) => c.type === 'status').items[0].color,
    WIDGET_COLORS.DANGER,
  );
});

test('the detail of a station: bound tiles, alert state, levels, trend, last reading', async (t) => {
  const { world, devices } = await worldWith(t, [WARSZAWA, GDANSK, ZUKOWO, WIGRY]);
  for (const language of LANGUAGES) {
    for (const device of devices) {
      const widget = await content(world, { station: device.external_id }, language);
      assert.deepEqual(validateWidgetContent(widget), [], `${language} ${device.name}`);
      for (const tile of widget.components.filter((c) => c.device_feature)) {
        assert.ok(features(devices).has(tile.device_feature), tile.device_feature);
      }
    }
  }
  const widget = await content(world, { station: devices[0].external_id }, 'fr');
  assert.deepEqual(
    widget.components.filter((c) => c.type === 'value').map((c) => c.label),
    ["Hauteur d'eau", 'Débit'],
  );
  assert.deepEqual(
    widget.components.find((c) => c.type === 'status').items.map((i) => [i.label, i.value]),
    [
      ['État', 'Normal'],
      ['Niveau de vigilance', '700 cm'],
      ["Niveau d'alarme", '750 cm'],
      ['Tendance', 'Inconnu'],
      ['Dernière mesure', '24/10 05:50'],
    ],
  );
  assert.deepEqual(widget.components.at(-1).link, { url: 'https://hydro.imgw.pl/' });
  const gdansk = await content(world, { station: devices[1].external_id }, 'es');
  assert.deepEqual(
    gdansk.components.filter((c) => c.type === 'value').map((c) => c.label),
    ['Nivel del agua', 'Agua'],
  );
  const zukowo = await content(world, { station: devices[2].external_id }, 'en');
  assert.deepEqual(zukowo.components.find((c) => c.type === 'status').items[0], {
    label: 'State',
    value: 'No alert levels',
    color: WIDGET_COLORS.NEUTRAL,
  });
});

test('no station yet, and a station no longer followed', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const empty = await content(world, {}, 'de');
  assert.match(empty.components[0].text, /^Noch keine Station/);
  const gone = await content(world, { station: 'imgw:station:nope' }, 'en');
  assert.equal(gone.components[0].text, 'This station is no longer followed.');
});

test('a status value never exceeds 40 characters', () => {
  const view = { lastReadingAt: Date.parse('2026-10-23T13:00:00Z'), height: null };
  for (const language of LANGUAGES) {
    assert.ok(stationValue(view, language).length <= 40);
  }
  assert.equal(stationValue({ lastReadingAt: null }, 'fr'), 'En attente');
});
