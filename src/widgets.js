// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `stations`.
//
// Without setting, one status line per followed station (10 at most): the
// water level and its trend, coloured by its alert state (closed palette of
// the widgets: alarm level danger, warning level warning, below them success;
// neutral without thresholds or without a recent reading). A heading names the
// stations at or above their warning level.
//
// With a station chosen in the settings: its live water level, flow and water
// temperature tiles (bound to the device features), then its alert state, its
// warning and alarm levels, trend and last reading.
//
// Both end with the source and its date and a link to the IMGW-PIB map.
// Budget: 2 texts, 1 status, 3 tiles, 1 button.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { displayName, stationIdOfId, stationIds } from './devices.js';
import { SITE_URL } from './imgw.js';
import { ALERT_NAMES, TREND_NAMES, formatDate, formatHeight } from './messages.js';
import { WIDGET_KEY } from './monitor.js';

export const MAX_STATUS_ITEMS = 10;
export const TTL_SECONDS = 300;
const MAX_STATUS_TEXT = 40;

export const TEXT = {
  empty: {
    en: 'No station yet: fill in the configuration of the IMGW-PIB integration, then create the devices in the Discover tab.',
    fr: "Aucune station pour l'instant : remplissez la configuration de l'intégration IMGW-PIB, puis créez les appareils dans l'onglet Découverte.",
    de: 'Noch keine Station: Fülle die Konfiguration der Integration IMGW-PIB aus und lege dann die Geräte im Tab „Entdecken“ an.',
    es: 'Aún no hay estaciones: rellene la configuración de la integración IMGW-PIB y, después, cree los dispositivos en la pestaña Descubrir.',
  },
  gone: {
    en: 'This station is no longer followed.',
    fr: "Cette station n'est plus suivie.",
    de: 'Diese Station wird nicht mehr verfolgt.',
    es: 'Esta estación ya no se sigue.',
  },
  alert: {
    en: 'Warning level reached: ',
    fr: 'Niveau de vigilance atteint : ',
    de: 'Warnstufe erreicht: ',
    es: 'Nivel de aviso alcanzado: ',
  },
  height: { en: 'Water level', fr: "Hauteur d'eau", de: 'Wasserstand', es: 'Nivel del agua' },
  flow: { en: 'Flow', fr: 'Débit', de: 'Abfluss', es: 'Caudal' },
  waterTemperature: { en: 'Water', fr: 'Eau', de: 'Wasser', es: 'Agua' },
  state: { en: 'State', fr: 'État', de: 'Lage', es: 'Estado' },
  warningLevel: {
    en: 'Warning level',
    fr: 'Niveau de vigilance',
    de: 'Warnstufe',
    es: 'Nivel de aviso',
  },
  alarmLevel: { en: 'Alarm level', fr: "Niveau d'alarme", de: 'Alarmstufe', es: 'Nivel de alarma' },
  noThresholds: {
    en: 'No alert levels',
    fr: "Pas de niveaux d'alerte",
    de: 'Keine Alarmstufen',
    es: 'Sin niveles de alerta',
  },
  trend: { en: 'Trend', fr: 'Tendance', de: 'Tendenz', es: 'Tendencia' },
  lastReading: {
    en: 'Last reading',
    fr: 'Dernière mesure',
    de: 'Letzte Messung',
    es: 'Última medición',
  },
  silent: {
    en: 'Silent since ',
    fr: 'Muette depuis le ',
    de: 'Still seit ',
    es: 'Sin datos desde ',
  },
  waiting: { en: 'Waiting', fr: 'En attente', de: 'Wartet', es: 'En espera' },
  unknown: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },
  source: {
    en: 'Source: IMGW-PIB',
    fr: 'Source : IMGW-PIB',
    de: 'Quelle: IMGW-PIB',
    es: 'Fuente: IMGW-PIB',
  },
  site: { en: 'IMGW-PIB map', fr: 'Carte IMGW-PIB', de: 'IMGW-PIB-Karte', es: 'Mapa IMGW-PIB' },
};

const t = (text, language) => text[language] ?? text.en;
const clip = (text, max = MAX_STATUS_TEXT) =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

const TREND_ICONS = { rising: 'trending-up', falling: 'trending-down', steady: 'minus' };
const ALERT_COLORS = {
  normal: WIDGET_COLORS.SUCCESS,
  warning: WIDGET_COLORS.WARNING,
  alarm: WIDGET_COLORS.DANGER,
};

/** Colour of a station line: its alert state, when the reading is recent. */
const colorOf = (view) =>
  view.height === null
    ? WIDGET_COLORS.NEUTRAL
    : (ALERT_COLORS[view.alert] ?? WIDGET_COLORS.NEUTRAL);

/** The status value of a station, e.g. "387 cm, steigt" (40 characters at most). */
export function stationValue(view, language) {
  if (view.lastReadingAt === null) {
    return t(TEXT.waiting, language);
  }
  if (view.height === null) {
    return clip(`${t(TEXT.silent, language)}${formatDate(view.lastReadingAt, language)}`);
  }
  const height = formatHeight(view.height, language);
  return clip(view.trend ? `${height}, ${TREND_NAMES[language][view.trend]}` : height);
}

function footer(monitor, ids, language, link) {
  const updated = monitor.updatedAt(ids);
  const source = t(TEXT.source, language);
  return [
    {
      type: 'text',
      variant: 'caption',
      text: updated === null ? source : `${source} · ${formatDate(updated, language)}`,
    },
    { type: 'button', label: t(TEXT.site, language), icon: 'external-link', link: { url: link } },
  ];
}

function overview(monitor, ids, language) {
  const views = ids.slice(0, MAX_STATUS_ITEMS).map((id) => monitor.view(id));
  const components = [];
  const high = views.filter((view) => view.alert === 'warning' || view.alert === 'alarm');
  if (high.length > 0) {
    components.push({
      type: 'text',
      variant: 'heading',
      text: clip(`${t(TEXT.alert, language)}${high.map((view) => view.name).join(', ')}`, 100),
    });
  }
  components.push({
    type: 'status',
    items: views.map((view) => ({
      label: clip(displayName(view)),
      value: stationValue(view, language),
      color: colorOf(view),
      icon: view.trend ? TREND_ICONS[view.trend] : 'clock',
    })),
  });
  return [...components, ...footer(monitor, ids, language, SITE_URL)];
}

function detail(monitor, id, language) {
  const view = monitor.view(id);
  const ids = stationIds(monitor.gladys, id);
  const components = [];
  if (view.has.height) {
    components.push({ type: 'value', label: t(TEXT.height, language), device_feature: ids.height });
  }
  if (view.has.flow) {
    components.push({ type: 'value', label: t(TEXT.flow, language), device_feature: ids.flow });
  }
  if (view.has.water_temperature) {
    components.push({
      type: 'value',
      label: t(TEXT.waterTemperature, language),
      device_feature: ids.water_temperature,
    });
  }
  const items = [];
  if (view.has.alert_level || view.thresholds) {
    items.push({
      label: t(TEXT.state, language),
      value: view.alert ? ALERT_NAMES[language][view.alert] : t(TEXT.unknown, language),
      color: view.alert ? ALERT_COLORS[view.alert] : WIDGET_COLORS.NEUTRAL,
    });
  }
  if (view.thresholds) {
    items.push(
      {
        label: t(TEXT.warningLevel, language),
        value: formatHeight(view.thresholds.warning, language),
        color: WIDGET_COLORS.NEUTRAL,
      },
      {
        label: t(TEXT.alarmLevel, language),
        value: formatHeight(view.thresholds.alarm, language),
        color: WIDGET_COLORS.NEUTRAL,
      },
    );
  } else if (!view.has.alert_level) {
    items.push({
      label: t(TEXT.state, language),
      value: t(TEXT.noThresholds, language),
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  if (view.has.height) {
    items.push({
      label: t(TEXT.trend, language),
      value: view.trend ? TREND_NAMES[language][view.trend] : t(TEXT.unknown, language),
      icon: view.trend ? TREND_ICONS[view.trend] : 'minus',
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  items.push({
    label: t(TEXT.lastReading, language),
    value:
      view.lastReadingAt === null
        ? t(TEXT.waiting, language)
        : formatDate(view.lastReadingAt, language),
    color: view.fresh ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.WARNING,
    icon: 'clock',
  });
  components.push({ type: 'status', items });
  return [...components, ...footer(monitor, [id], language, SITE_URL)];
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    async get(monitor, { settings, language = 'en' }) {
      const lang = ALERT_NAMES[language] ? language : 'en';
      const created = monitor.created();
      const chosen = typeof settings?.station === 'string' ? settings.station : null;
      if (chosen) {
        const id = stationIdOfId(monitor.gladys, chosen);
        const components =
          id && created.includes(id)
            ? detail(monitor, id, lang)
            : [{ type: 'text', variant: 'body', text: t(TEXT.gone, lang) }];
        return { ttl_seconds: TTL_SECONDS, components };
      }
      if (created.length === 0) {
        return {
          ttl_seconds: TTL_SECONDS,
          components: [{ type: 'text', variant: 'body', text: t(TEXT.empty, lang) }],
        };
      }
      return { ttl_seconds: TTL_SECONDS, components: overview(monitor, created, lang) };
    },
  },
};
