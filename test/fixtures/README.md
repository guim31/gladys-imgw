# Test fixtures

- `gladys-feature-table.json`: the category/type couples, units and poll frequencies the Gladys
  core and front know (extracted from the Gladys code), used by `test/gladys-rules.test.js`.
- `imgw/hydro-2026-10-24.json`: a real answer of `https://danepubliczne.imgw.pl/api/data/hydro/`,
  recorded on 24/10/2026 at 04:14 UTC and kept as is (public data of public stations, „Źródłem
  pochodzenia danych jest Instytut Meteorologii i Gospodarki Wodnej – Państwowy Instytut
  Badawczy”), reduced to 27 of the 913 stations: the stations within 35 km of Warsaw and 20 km of
  Wrocław, Gdańsk (a sea gauge, river "-"), lake stations (Żukowo on Jezioro Drużno, Borucino,
  Wigry with a temperature only and coordinates 0, 0), the two Krosno (a name shared by two
  stations), Krubice 8 cm below its warning level, Gozdowice and Słubice on the Odra, Sromowce
  Wyżne silent since 26/07/2025, Fordon silent since 14/09, Zielonka without thresholds. No
  station was above a threshold that day: the tests raise the levels.

`test/helpers/world.js` serves it as the API would and lets the tests set new levels and
temperatures.
