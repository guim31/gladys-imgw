// -----------------------------------------------------------------------------
// Texts sent from the container (feature values, connection status, action
// messages, scene variables), in the four languages of the Gladys interface.
// Entries are strings or functions of one parameter object. German says "du",
// Spanish "usted".
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

// The thresholds of a station, as IMGW-PIB names them (stan ostrzegawczy,
// stan alarmowy).
export const THRESHOLD_NAMES = {
  en: { warning: 'warning level', alarm: 'alarm level' },
  fr: { warning: 'niveau de vigilance', alarm: "niveau d'alarme" },
  de: { warning: 'Warnstand', alarm: 'Alarmstand' },
  es: { warning: 'nivel de aviso', alarm: 'nivel de alarma' },
};

// The alert state of a station: below the warning level, above it, above the alarm level.
export const ALERT_NAMES = {
  en: { normal: 'Normal', warning: 'Warning level', alarm: 'Alarm level' },
  fr: { normal: 'Normal', warning: 'Vigilance', alarm: 'Alarme' },
  de: { normal: 'Normal', warning: 'Warnstand', alarm: 'Alarmstand' },
  es: { normal: 'Normal', warning: 'Aviso', alarm: 'Alarma' },
};

export const TREND_NAMES = {
  en: { rising: 'rising', steady: 'steady', falling: 'falling' },
  fr: { rising: 'monte', steady: 'stable', falling: 'baisse' },
  de: { rising: 'steigt', steady: 'gleichbleibend', falling: 'fällt' },
  es: { rising: 'sube', steady: 'estable', falling: 'baja' },
};

// Values of the "Last reading" feature.
export const READINGS = {
  en: { staleSince: ({ date }) => `No new reading since ${date}` },
  fr: { staleSince: ({ date }) => `Pas de nouvelle mesure depuis le ${date}` },
  de: { staleSince: ({ date }) => `Keine neue Messung seit ${date}` },
  es: { staleSince: ({ date }) => `Sin nueva medición desde el ${date}` },
};

// Connection status of the Configuration screen.
export const STATUS = {
  en: {
    initFailed: 'Initialization failed, check the integration logs.',
    down: 'IMGW-PIB does not answer: the readings will come back with it.',
    ambiguous: ({ names }) =>
      `Several stations are named ${names}: give the id, or the river (Krosno Wisłok).`,
    unknown: ({ names }) => `Unknown station: ${names}. Use "Find stations".`,
    homeFailed:
      'Around my house: the nearest stations cannot be chosen yet, tried again at the next refresh.',
    noHouse: 'Around my house: give your house a location in Gladys (Settings, Houses).',
    tooMany: ({ max }) => `Only the first ${max} stations are followed.`,
    none: 'No station yet: fill in the configuration, or use "Find stations".',
  },
  fr: {
    initFailed: "L'initialisation a échoué, consultez les logs de l'intégration.",
    down: 'IMGW-PIB ne répond pas : les mesures reviendront avec lui.',
    ambiguous: ({ names }) =>
      `Plusieurs stations s'appellent ${names} : donnez l'identifiant, ou le cours d'eau (Krosno Wisłok).`,
    unknown: ({ names }) => `Station inconnue : ${names}. Utilisez « Chercher des stations ».`,
    homeFailed:
      'Autour de ma maison : les stations les plus proches ne peuvent pas encore être choisies, nouvel essai à la prochaine mise à jour.',
    noHouse:
      'Autour de ma maison : indiquez la position de votre maison dans Gladys (Paramètres, Maisons).',
    tooMany: ({ max }) => `Seules les ${max} premières stations sont suivies.`,
    none: 'Aucune station : remplissez la configuration, ou utilisez « Chercher des stations ».',
  },
  de: {
    initFailed: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
    down: 'IMGW-PIB antwortet nicht: Die Messwerte kommen mit ihm zurück.',
    ambiguous: ({ names }) =>
      `Mehrere Stationen heißen ${names}: Gib die ID an oder das Gewässer (Krosno Wisłok).`,
    unknown: ({ names }) => `Unbekannte Station: ${names}. Nutze „Stationen suchen“.`,
    homeFailed:
      'Rund um mein Haus: Die nächsten Stationen können noch nicht gewählt werden, neuer Versuch bei der nächsten Aktualisierung.',
    noHouse: 'Rund um mein Haus: Gib deinem Haus in Gladys einen Standort (Einstellungen, Häuser).',
    tooMany: ({ max }) => `Nur die ersten ${max} Stationen werden verfolgt.`,
    none: 'Noch keine Station: Fülle die Konfiguration aus oder nutze „Stationen suchen“.',
  },
  es: {
    initFailed: 'La inicialización ha fallado, consulte los registros de la integración.',
    down: 'IMGW-PIB no responde: las mediciones volverán con él.',
    ambiguous: ({ names }) =>
      `Varias estaciones se llaman ${names}: indique el identificador o el río (Krosno Wisłok).`,
    unknown: ({ names }) => `Estación desconocida: ${names}. Use «Buscar estaciones».`,
    homeFailed:
      'Alrededor de mi casa: aún no se pueden elegir las estaciones más cercanas, nuevo intento en la próxima actualización.',
    noHouse: 'Alrededor de mi casa: indique la ubicación de su casa en Gladys (Ajustes, Casas).',
    tooMany: ({ max }) => `Solo se siguen las ${max} primeras estaciones.`,
    none: 'Aún no hay estaciones: rellene la configuración o use «Buscar estaciones».',
  },
};

// Messages of the "Find stations" action.
export const SEARCH = {
  en: {
    noHouse:
      'Your house has no location in Gladys: type a station name, a river (Wisła, Odra…), a province or a station id.',
    none: 'No station found.',
    found: ({ count, total }) =>
      `${total > count ? `${count} of ${total}` : count} station(s). Copy the ids into "Stations", then save:`,
    unavailable: 'IMGW-PIB does not answer, try again in a few minutes.',
    noRecent: 'no recent reading',
  },
  fr: {
    noHouse:
      "Votre maison n'a pas de position dans Gladys : tapez un nom de station, un cours d'eau (Wisła, Odra…), une voïvodie ou un identifiant de station.",
    none: 'Aucune station trouvée.',
    found: ({ count, total }) =>
      `${total > count ? `${count} sur ${total}` : count} station(s). Copiez les identifiants dans « Stations », puis enregistrez :`,
    unavailable: 'IMGW-PIB ne répond pas, réessayez dans quelques minutes.',
    noRecent: 'pas de mesure récente',
  },
  de: {
    noHouse:
      'Dein Haus hat in Gladys keinen Standort: Gib einen Stationsnamen, ein Gewässer (Wisła, Odra…), eine Woiwodschaft oder eine Stations-ID ein.',
    none: 'Keine Station gefunden.',
    found: ({ count, total }) =>
      `${total > count ? `${count} von ${total}` : count} Station(en). Kopiere die IDs in „Stationen“ und speichere:`,
    unavailable: 'IMGW-PIB antwortet nicht, versuche es in ein paar Minuten erneut.',
    noRecent: 'keine aktuelle Messung',
  },
  es: {
    noHouse:
      'Su casa no tiene ubicación en Gladys: escriba el nombre de una estación, un río (Wisła, Odra…), un voivodato o un identificador de estación.',
    none: 'No se ha encontrado ninguna estación.',
    found: ({ count, total }) =>
      `${total > count ? `${count} de ${total}` : count} estación(es). Copie los identificadores en «Estaciones» y guarde:`,
    unavailable: 'IMGW-PIB no responde, inténtelo de nuevo en unos minutos.',
    noRecent: 'sin medición reciente',
  },
};

/** One entry of a message table, in every language: `{ en, fr, de, es }`. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => {
      const entry = table[language][key];
      return [language, typeof entry === 'function' ? entry(params) : entry];
    }),
  );
}

/** Several multi-language texts joined, language by language. */
export function join(...messages) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      messages
        .filter(Boolean)
        .map((message) => message[language])
        .join(' '),
    ]),
  );
}

const YEAR_SHOWN_AFTER_MS = 300 * 24 * 60 * 60 * 1000;

/**
 * A date in the user's time zone (TZ, set by the Gladys supervisor), e.g.
 * "13/10 18:35", with its year when it is far from `now` ("26/07/2025 09:20").
 */
export function formatDate(time, language, now = Date.now()) {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : language, {
    day: '2-digit',
    month: '2-digit',
    ...(Math.abs(now - time) > YEAR_SHOWN_AFTER_MS ? { year: 'numeric' } : {}),
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

/** A number in the user's language, e.g. "2,59" in French. */
export function formatNumber(value, language, digits = 2) {
  return new Intl.NumberFormat(language === 'en' ? 'en-GB' : language, {
    maximumFractionDigits: digits,
  }).format(value);
}

/** A water level, e.g. "387 cm". */
export function formatHeight(value, language) {
  return `${formatNumber(value, language, 0)} cm`;
}
