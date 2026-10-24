# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- One Gladys device per IMGW-PIB hydrological station of Poland: water level (cm), flow (m³/s)
  and water temperature when the station provides them, alert level (0 normal, 1 warning level
  reached, 2 alarm level reached, from the stan ostrzegawczy and stan alarmowy of IMGW-PIB) and
  the date of the last reading. A station without a new water level for 6 hours says "No new
  reading since…" instead of showing an old value as fresh.
- Stations chosen by id, name (case and Polish letters ignored, with the river when several
  stations share a name) or map address, or the 3 nearest stations that send readings around
  the house (10, 20 or 50 km), chosen without sending the house location anywhere.
- "Find stations" in the Configuration screen: around the house, by name, by river or lake, by
  province or by id, with the distance, the current level and the alert level when reached.
- Scene triggers "Warning or alarm level crossed" (reached or falling back below, with a 2 cm
  hysteresis on the fall), "Station stopped sending readings" and "Station sends readings
  again".
- Dashboard widget "IMGW-PIB": followed stations with level, trend and alert level, or the
  detail of one station with its warning and alarm levels.
- Refresh every 20, 30 or 60 minutes by the integration itself, with one request for all the
  stations, without relying on Gladys polling.
- Texts and documentation in English, French, German and Spanish.
