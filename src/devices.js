// -----------------------------------------------------------------------------
// One Gladys device per IMGW-PIB hydrological station.
//
// Features (couples checked against the Gladys front, v5.2, see
// test/gladys-rules.test.js), each only when the station has it:
//   - height             level-sensor/liquid-depth: the water level, in cm
//                        above the gauge zero, as IMGW-PIB gives it;
//   - flow               water-valve/flow, in m³/s. Gladys has no m³/s unit
//                        (only m³/h): no unit, the name says it, the value
//                        reads like on the IMGW-PIB map;
//   - water_temperature  temperature-sensor/decimal, °C (about a hundred
//                        stations, read once a day);
//   - alert_level        risk/integer, 0 to 2: 0 below the warning level
//                        (stan ostrzegawczy), 1 at or above it, 2 at or above
//                        the alarm level (stan alarmowy), for the stations
//                        IMGW-PIB gives both levels of;
//   - last_reading       text/text: the date of the last water level, or "no
//                        new reading since…" once the station is silent.
//
// Published with should_poll: false: the refresh runs in the container
// (src/monitor.js). The platform id is the IMGW-PIB station id (id_stacji,
// nine digits, 152210170 for Warszawa-Bulwary), the one of the Home Assistant
// integration "imgw_pib".
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

export const DEVICE_TYPE = 'station';
export const FEATURE_KEYS = {
  HEIGHT: 'height',
  FLOW: 'flow',
  WATER_TEMPERATURE: 'water_temperature',
  ALERT_LEVEL: 'alert_level',
  LAST_READING: 'last_reading',
};

// Values of the alert_level feature.
export const ALERT_LEVEL = { normal: 0, warning: 1, alarm: 2 };

// Display bounds (history chart, gauge). Polish gauges stay under 10 m (in cm)
// in normal times; the 1997 flood peaked about 12 m on the Odra.
export const HEIGHT_BOUNDS = [-500, 2000];
export const FLOW_BOUND_M3S = 20000;
// See capabilities.
export const SERIES_ALIVE_MS = 7 * 24 * 60 * 60 * 1000;

// Feature names, frozen at creation in Gladys (language of the configuration).
export const NAMES = {
  en: {
    height: 'Water level',
    flow: 'Flow (m³/s)',
    water_temperature: 'Water temperature',
    alert_level: 'Alert level (0 to 2)',
    last_reading: 'Last reading',
  },
  fr: {
    height: "Hauteur d'eau",
    flow: 'Débit (m³/s)',
    water_temperature: "Température de l'eau",
    alert_level: "Niveau d'alerte (0 à 2)",
    last_reading: 'Dernière mesure',
  },
  de: {
    height: 'Wasserstand',
    flow: 'Abfluss (m³/s)',
    water_temperature: 'Wassertemperatur',
    alert_level: 'Alarmstufe (0 bis 2)',
    last_reading: 'Letzte Messung',
  },
  es: {
    height: 'Nivel del agua',
    flow: 'Caudal (m³/s)',
    water_temperature: 'Temperatura del agua',
    alert_level: 'Nivel de alerta (0 a 2)',
    last_reading: 'Última medición',
  },
};

/** External ids of a station device and of its features. */
export function stationIds(gladys, id) {
  const ids = gladys.externalIds(DEVICE_TYPE, id);
  return {
    device: ids.device,
    ...Object.fromEntries(Object.values(FEATURE_KEYS).map((key) => [key, ids.feature(key)])),
  };
}

/** The station id of a device or feature external id (null if not ours). */
export function stationIdOfId(gladys, externalId) {
  const prefix = gladys.externalIds(DEVICE_TYPE, '').device;
  if (typeof externalId !== 'string' || !externalId.startsWith(prefix)) {
    return null;
  }
  return externalId.slice(prefix.length).split(':')[0] || null;
}

/**
 * What a station offers, from what IMGW-PIB gives of it (see src/imgw.js
 * parseStation); a station rebuilt from a Gladys device carries `has`.
 */
export function capabilities(station, now = Date.now()) {
  if (station.has) {
    return station.has;
  }
  // A flow or a temperature older than this is a series the station stopped
  // (44 flows were months old on 24/10/2026): no feature that never gets a value.
  const recent = (reading) => Boolean(reading) && now - reading.t <= SERIES_ALIVE_MS;
  return {
    // A station without any water level yet still gets the feature: it is
    // the reason to follow it (a few lake stations only send a temperature).
    height: Boolean(station.level) || !station.temperature,
    flow: recent(station.flow),
    // Kept for the lake stations that have nothing else (Wigry), even old.
    water_temperature:
      recent(station.temperature) || (Boolean(station.temperature) && !station.level),
    alert_level: Boolean(station.thresholds),
  };
}

/**
 * Features never disappear: a field missing from one answer must not make
 * Gladys offer an "Update" that would drop the feature and its history.
 */
export function mergeCapabilities(current, previous) {
  if (!previous) {
    return current;
  }
  return Object.fromEntries(
    Object.keys(current).map((key) => [key, Boolean(current[key] || previous[key])]),
  );
}

/** "Warszawa-Bulwary / Wisła", as IMGW-PIB lists them. */
export const displayName = (station) =>
  station.river ? `${station.name} / ${station.river}` : station.name;

const sensor = (name, externalId, category, type, extra) => ({
  name,
  external_id: externalId,
  category,
  type,
  read_only: true,
  has_feedback: false,
  ...extra,
});

/**
 * The discovery payload of a station.
 * @param {object} gladys
 * @param {object} station see src/imgw.js parseStation
 * @param {string} language language of the feature names
 */
export function buildDevice(gladys, station, language = 'fr') {
  const ids = stationIds(gladys, station.id);
  const names = NAMES[language] ?? NAMES.fr;
  const has = capabilities(station);
  const C = DEVICE_FEATURE_CATEGORIES;
  const features = [];
  if (has.height) {
    features.push(
      sensor(names.height, ids.height, C.LEVEL_SENSOR, TYPES.LEVEL_SENSOR.LIQUID_DEPTH, {
        unit: DEVICE_FEATURE_UNITS.CM,
        keep_history: true,
        min: HEIGHT_BOUNDS[0],
        max: HEIGHT_BOUNDS[1],
      }),
    );
  }
  if (has.flow) {
    features.push(
      sensor(names.flow, ids.flow, C.WATER_VALVE, TYPES.WATER_VALVE.FLOW, {
        keep_history: true,
        min: 0,
        max: FLOW_BOUND_M3S,
      }),
    );
  }
  if (has.water_temperature) {
    features.push(
      sensor(
        names.water_temperature,
        ids.water_temperature,
        C.TEMPERATURE_SENSOR,
        TYPES.SENSOR.DECIMAL,
        { unit: DEVICE_FEATURE_UNITS.CELSIUS, keep_history: true, min: -5, max: 40 },
      ),
    );
  }
  if (has.alert_level) {
    features.push(
      sensor(names.alert_level, ids.alert_level, C.RISK, TYPES.RISK.INTEGER, {
        keep_history: true,
        min: 0,
        max: ALERT_LEVEL.alarm,
      }),
    );
  }
  features.push(
    sensor(names.last_reading, ids.last_reading, C.TEXT, TYPES.TEXT.TEXT, {
      keep_history: false,
      min: 0,
      max: 0,
    }),
  );
  const params = [
    { name: 'STATION_ID', value: station.id },
    { name: 'STATION_NAME', value: station.name },
  ];
  if (station.river) {
    params.push({ name: 'RIVER', value: station.river });
  }
  if (station.province) {
    params.push({ name: 'PROVINCE', value: station.province });
  }
  return {
    name: displayName(station),
    external_id: ids.device,
    model: 'IMGW-PIB',
    should_poll: false,
    params,
    features,
  };
}
