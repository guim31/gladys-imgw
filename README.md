# IMGW-PIB for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that brings the
**water levels of Polish rivers and lakes** (Wisła, Odra, Warta, Bug, the lakes, the coast:
about 900 stations) into Gladys, with their **warning and alarm levels**, from the public data
of [IMGW-PIB](https://danepubliczne.imgw.pl), the Polish Institute of Meteorology and Water
Management. Public data, no account, no key.

> **Raw values, not a flood warning service.** Data can be late, missing or wrong. In a flood,
> follow the official warnings. Not affiliated with IMGW-PIB.

The Polish counterpart of [gladys-pegelonline](https://github.com/guim31/gladys-pegelonline)
(German federal waterways), [gladys-lhp](https://github.com/guim31/gladys-lhp) (German states)
and [gladys-ea-flood](https://github.com/guim31/gladys-ea-flood) (England).

## Features

- **One device per station**: water level (cm, as on the IMGW-PIB map), flow (m³/s) and water
  temperature when the station provides them, the **alert level** (0 below the warning level
  "stan ostrzegawczy", 1 at or above it, 2 at or above the alarm level "stan alarmowy") for the
  ~600 stations IMGW-PIB gives thresholds for, and the date of the last reading. A station that
  stops sending says so ("No new reading since…") instead of showing an old value as a fresh
  one.
- **Stations by id, by name or around your house** (the 3 nearest stations that send readings,
  chosen inside the container from the location of your house in Gladys).
- **"Find stations"** in the Configuration screen: around your house, by name, by river or
  lake, by province or by id, with the distance and the current level.
- **Scene triggers**: _Warning or alarm level crossed_ (reached, or falling back below with a
  2 cm hysteresis), _Station stopped sending readings_ (6 hours without a water level) and
  _Station sends readings again_. A threshold of your own stays a Gladys device condition on
  the water level.
- **Dashboard widget**: the followed stations with their level, trend and alert level, or the
  detail of one station with live tiles and its warning and alarm levels.
- Texts in English, French, German and Spanish.

## Requirements

- Gladys Assistant **5.1.0** or later (widgets and scene triggers).
- Internet access from Gladys to `danepubliczne.imgw.pl`.
- For "around my house": the location of your house in Gladys. The integration declares
  `location: true`, shown on the install screen.

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-imgw` (or install it from the catalog once it is listed).
   The install screen shows the **location** access it asks for.
2. In **Configuration**, press **Find stations**, copy the ids you want into **Stations** (or
   choose **Around my house**), then save.
3. Open the **Discover** tab and press **Add to Gladys** on the stations you want.

The user guide is in [`docs/en.md`](docs/en.md) ([français](docs/fr.md), [Deutsch](docs/de.md),
[español](docs/es.md)); Gladys links it from the Configuration screen.

## How it works

```
Integration container ──HTTPS──▶ danepubliczne.imgw.pl/api/data/hydro/
      │                            every station, its thresholds and readings,
      │                            one request (~550 kB) per refresh
      │ SDK (WebSocket + host API)
      ▼
Gladys core ── devices, states, scene events, widget
```

- Devices are published with `should_poll: false` (the core does not poll external devices
  reliably, GladysAssistant/Gladys#3198): the integration refreshes itself every 20, 30 or 60
  minutes with **one** request that returns every station. The same answer resolves the names
  and finds the stations around the house: the house coordinates never leave the container.
- The dates of the API are UTC (checked against the live service on 24/10/2026).
- Only the changes are published, plus a heartbeat every 12 hours. After 6 hours without a new
  water level (30 hours for the flow and the daily water temperature) the values are no longer
  sent: Gladys shows their real age.
- `/data/imgw.json` keeps the followed stations, the last readings (a few hours of levels for
  the trend) and the side of each threshold (so a crossing during a short restart still fires
  its trigger). Never the house coordinates.

## Limitations

- **Not a flood warning service.** No guarantee of delay or availability.
- **Not yet tested in a real Gladys installation: feedback welcome.** No hardware involved;
  tested against the live service and a recorded answer of IMGW-PIB (24/10/2026).
- Water levels are gauge readings above each gauge zero: not comparable between stations, not
  depths.
- No hydrological warnings of IMGW-PIB (issued by catchment area, not by station), no
  forecasts, no ice phenomena.
- About 30 stations have no coordinates in the data: they can be followed by id, not "around my
  house".
- 20 stations at most from the configuration (plus the ones whose device you created).

## Development

Node.js 22+, ESM, no build step. The only runtime dependency is
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

```bash
npm install
npm test              # node --test, against the SDK's fake Gladys and a recorded API answer
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store --skip-image-check .   # store validator
```

```
index.js              SDK wiring (src/app.js registers the handlers)
src/app.js            handlers → monitor, configuration action, widget
src/monitor.js        followed stations, refresh cycles, states, scene triggers
src/imgw.js           IMGW-PIB client and parsing
src/http.js           GET JSON with timeout and User-Agent
src/search.js         "Find stations" action
src/devices.js        Gladys device of a station (features, names)
src/widgets.js        dashboard widget
src/messages.js       texts sent from the container, four languages
src/geo.js            distances
src/store.js          /data persistence
src/config.js         configuration defaults and normalization
test/fixtures/        recorded IMGW-PIB answer (see its README)
```

Versions are bumped by the **Release** workflow (Actions → Release), never by hand.

## Credits

- „Źródłem pochodzenia danych jest Instytut Meteorologii i Gospodarki Wodnej – Państwowy
  Instytut Badawczy”. „Dane Instytutu Meteorologii i Gospodarki Wodnej – Państwowego Instytutu
  Badawczego zostały przetworzone” (alert level and trend computed by the integration). Terms:
  [regulamin udostępniania danych](https://danepubliczne.imgw.pl/docs/regulamin_udostepniania_danych.pdf).
- The Home Assistant [`imgw_pib`](https://www.home-assistant.io/integrations/imgw_pib/)
  integration and its library [bieniu/imgw-pib](https://github.com/bieniu/imgw-pib) (both
  Apache-2.0), read for the API usage; no code copied.
- The cover shows the official IMGW-PIB logo, as served by the institute's websites
  (`shared.imgw.pl/web-components/top/assets/images/logo/imgw-pib.svg`; also on
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Logo_IMGW.png), public domain),
  enlarged on the navy blue of the institute.

Not affiliated with IMGW-PIB.

## License

Apache-2.0, see [LICENSE](LICENSE).
