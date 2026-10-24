# IMGW-PIB

Bringt die **Wasserstände der Flüsse und Seen Polens** (Wisła, Odra, Warta, Bug, die Seen
Masurens und Pommerns, die Küste: rund 900 Stationen) mit ihren **Warn- und Alarmstufen** nach
Gladys, aus den öffentlichen Daten des **IMGW-PIB**, des polnischen Instituts für Meteorologie
und Wasserwirtschaft. Ohne Konto, ohne Schlüssel.

> **Rohdaten, kein Hochwasserwarndienst.** Die Daten können verspätet, lückenhaft oder falsch
> sein, und die Integration hängt von deinem Gladys, deinem Internetzugang und einem
> öffentlichen Dienst ab. Bei Hochwasser folge den amtlichen Warnungen (IMGW-PIB, deine
> Gemeinde, 112). Diese Integration ist nicht mit dem IMGW-PIB verbunden.

## Was du bekommst

- **Ein Gerät pro verfolgter Station**: der **Wasserstand** (in cm, wie auf der Karte des
  IMGW-PIB), der **Abfluss** in m³/s und die **Wassertemperatur**, wenn die Station sie liefert,
  die **Alarmstufe** (0 normal, 1 Warnstufe erreicht, 2 Alarmstufe erreicht), wenn das IMGW-PIB
  ihre Schwellen angibt, und das Datum der letzten Messung.
- Eine Station, die nichts mehr sendet, wird als solche angezeigt („Keine neue Messung
  seit…“): Ein alter Wert wird nie wieder als frisch gesendet.
- Drei **Szenenauslöser**: Die Warn- oder Alarmstufe wird erreicht oder verlassen, eine Station
  sendet keine Messwerte mehr, eine stille Station sendet wieder.
- Ein **Dashboard-Widget**: deine Stationen, ihr Wasserstand, seine Tendenz (steigt,
  gleichbleibend, fällt) und ihre Alarmstufe.
- Eine Schaltfläche **„Stationen suchen“**, die die Stationen rund um dein Haus, nach Name, nach
  Gewässer, nach Woiwodschaft oder nach ID mit ihrem aktuellen Wasserstand auflistet.

## Voraussetzungen

- Gladys Assistant **5.1.0** oder neuer.
- Internetzugang von Gladys aus: Die Integration liest `danepubliczne.imgw.pl`.
- Für „Rund um mein Haus“: der Standort deines Hauses in Gladys (Einstellungen, Häuser). Die
  Integration fragt bei der Installation danach (Berechtigung „Standort“). Er dient nur im
  Container dazu, die nächsten Stationen zu finden: nie an das IMGW-PIB gesendet (die
  Integration lädt die ganze Liste), nie gespeichert und nie protokolliert.
- Nur Polen.

## Konfiguration

### Einstellungen

| Einstellung                | Wirkung                                                                                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stationen                  | Stations-IDs oder -namen, durch Kommas getrennt: `152210170, Trestno`. Ein Name, den mehrere Stationen tragen, bekommt sein Gewässer dazu: `Krosno Wisłok`. |
| Rund um mein Haus          | Verfolgt auch die 3 nächsten Stationen, die Messwerte senden, höchstens 10, 20 oder 50 km von deinem Haus entfernt.                                         |
| Aktualisierungsintervall   | 20, 30 (Standard) oder 60 Minuten. Eine Anfrage deckt alle Stationen ab.                                                                                    |
| Sprache der Funktionsnamen | Namen der Funktionen neuer Geräte (Wasserstand, Abfluss…) sowie Sprache des Textes „Letzte Messung“ und der Szenenvariablen. Standardmäßig Französisch.     |

Speichere, öffne dann den Tab **Entdecken** der Integration und lege die gewünschten Geräte an.
Eine Station bleibt verfolgt, solange ihr Gerät existiert, auch wenn du sie aus der
Konfiguration entfernst.

### Deine Stationen finden

Klicke in der Konfiguration auf **„Stationen suchen“**. Lass das Feld leer, um die Stationen
rund um dein Haus aufzulisten (20 km oder die gewählte Entfernung), oder gib ein:

- einen Stationsnamen: `Głogów`, `glogow` oder `GLOGOW` (Groß- und Kleinschreibung und
  polnische Buchstaben werden ignoriert);
- ein Gewässer oder einen See: `Wisła`, `Odra`, `Drużno` (die 10 nächsten oder die ersten 10
  nach Gewässer);
- beides: `Odra Słubice`;
- eine Woiwodschaft: `dolnośląskie`;
- eine Stations-ID: `152210170`.

Jede Zeile nennt ID, Name, Gewässer, Entfernung zu deinem Haus und den aktuellen Wasserstand
(mit der Alarmstufe, wenn erreicht) oder „keine aktuelle Messung“. Kopiere die IDs in
„Stationen“ und speichere.

## Geräte

| Funktion             | Typ in Gladys          | Wert                                                                                                                    |
| -------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Wasserstand          | Flüssigkeitstiefe (cm) | Stand über dem Pegelnullpunkt, in cm (stan wody).                                                                       |
| Abfluss (m³/s)       | Wasserdurchfluss       | In m³/s (Gladys hat keine Einheit m³/s: Der Name sagt es). Vom IMGW-PIB berechnet, an manchen Stationen Stunden später. |
| Wassertemperatur     | Temperatur (°C)        | Rund hundert Stationen, einmal täglich gemessen (06:00 UTC).                                                            |
| Alarmstufe (0 bis 2) | Risikostufe            | 0 unter der Warnstufe (stan ostrzegawczy), 1 ab dieser, 2 ab der Alarmstufe (stan alarmowy).                            |
| Letzte Messung       | Text                   | Datum des letzten Wasserstands oder „Keine neue Messung seit…“.                                                         |

Eine Funktion gibt es nur, wenn die Station sie liefert: Rund 600 Stationen haben Warn- und
Alarmstufen, Seestationen oft keine. Der **Wasserstand ist keine Tiefe**: Er ist die Ablesung
der Pegellatte über ihrem eigenen Nullpunkt. Vergleiche ihn mit den Schwellen derselben
Station (im Widget angezeigt), nicht mit einer anderen Station. Die Geräteparameter enthalten
ID, Name, Gewässer und Woiwodschaft der Station.

Wasserstand, Abfluss und Temperatur sind numerische Funktionen: Gladys-Szenen können sie
bereits mit einem beliebigen eigenen Wert vergleichen („Wasserstand über 650 cm“).

## Dashboard-Widget

Füge das Widget **IMGW-PIB** einem Dashboard hinzu.

- **Ohne Einstellung**: eine Zeile pro verfolgter Station (höchstens 10) mit Wasserstand und
  Tendenz, gefärbt nach ihrer Alarmstufe: grün unter der Warnstufe, orange auf der Warnstufe,
  rot auf der Alarmstufe, grau ohne Schwellen oder ohne aktuelle Messung. Eine Überschrift
  nennt die Stationen auf oder über ihrer Warnstufe.
- **Mit gewählter Station**: ihr Wasserstand, Abfluss und ihre Wassertemperatur live, dann ihre
  Lage, ihre Warn- und Alarmstufe, Tendenz und letzte Messung sowie ein Link zur Karte des
  IMGW-PIB.

## Szenenauslöser

| Auslöser                            | Filter                                                               | Variablen                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Warn- oder Alarmstufe überschritten | Station, Stufe (Warnung, Alarm), Richtung (erreicht, fällt darunter) | Name der Station, Gewässer, Wasserstand (cm), Kürzel und Name der Stufe, ihre Höhe (cm), Richtung |
| Station sendet keine Messwerte mehr | Station                                                              | Name der Station, Gewässer, Datum der letzten Messung                                             |
| Station sendet wieder Messwerte     | Station                                                              | Name der Station, Gewässer, Datum der letzten Messung                                             |

Die Stufen sind die, die das IMGW-PIB für jede Station veröffentlicht. Eine Stufe gilt als
erreicht, sobald der Wasserstand ihr gleicht; das Fallen zählt, sobald der Stand 2 cm darunter
liegt, und erst dann kann ein neues Steigen zählen: Ein Stand, der um eine Schwelle pendelt,
löst einmal aus. Eine Station ist still nach 6 Stunden ohne neuen Wasserstand.

Die Auslöser feuern nur für ein angelegtes Gerät, bei einer frischen Messung und nicht nach
einem Neustart von mehr als einem Tag. Eine vom IMGW-PIB geänderte Schwelle wird ohne
Auslösen übernommen.

## Szenenbeispiele

- **Die Wisła in Warschau**: „Warn- oder Alarmstufe überschritten“, Station Warszawa-Bulwary,
  Stufe „Warnstufe“, erreicht → Nachricht senden: „{{station_name}}: {{height}} cm, Warnstufe
  ({{threshold_value}} cm) erreicht“.
- **Kellerwache**: „Warn- oder Alarmstufe überschritten“, deine Station, Stufe „Alarmstufe“,
  erreicht → die Steckdose der Pumpe einschalten und die Familie benachrichtigen; derselbe
  Auslöser mit „fällt darunter“ → „{{station_name}}: wieder unter der Alarmstufe“.
- **Stationswache**: „Station sendet keine Messwerte mehr“ → eine Erinnerung, die Karte des
  IMGW-PIB anzusehen („{{station_name}} still seit {{last_reading}}“).

## Datenquellen, Lizenz und Kontingente

- „Źródłem pochodzenia danych jest Instytut Meteorologii i Gospodarki Wodnej – Państwowy
  Instytut Badawczy“ (Quelle der Daten ist das IMGW-PIB). „Dane Instytutu Meteorologii i
  Gospodarki Wodnej – Państwowego Instytutu Badawczego zostały przetworzone“: Die Integration
  berechnet daraus die Alarmstufe und die Tendenz. Nutzungsbedingungen:
  [regulamin](https://danepubliczne.imgw.pl/docs/regulamin_udostepniania_danych.pdf),
  kostenlos für private Nutzung.
- Die Werte sind **Betriebsdaten**, vom IMGW-PIB nicht geprüft: Das IMGW-PIB kann sie später
  korrigieren.
- Ohne Konto, ohne Schlüssel, ohne dokumentiertes Kontingent. Die Integration bleibt sparsam:
  **eine Anfrage pro Aktualisierung** (standardmäßig 30 Minuten) für alle verfolgten
  Stationen, rund 550 kB. Die Stationen senden alle 10 bis 60 Minuten einen Wasserstand; das
  IMGW-PIB veröffentlicht ihn etwa eine halbe Stunde später.

## Fehlerbehebung

- **„Unbekannte Station“**: Prüfe die Schreibweise oder nutze „Stationen suchen“ und kopiere
  die ID.
- **„Mehrere Stationen heißen…“**: Gib das Gewässer dazu an (`Krosno Wisłok`) oder nutze die ID.
- **„IMGW-PIB antwortet nicht“**: Der Dienst oder dein Internetzugang ist ausgefallen; die
  Werte kommen von selbst zurück.
- **„Rund um mein Haus“ fügt nichts hinzu**: Gib deinem Haus einen Standort (Einstellungen,
  Häuser) oder wähle eine größere Entfernung. Rund 30 Stationen haben in den Daten keine
  Koordinaten und werden so nie gewählt: Füge sie per ID hinzu.
- **Keine Alarmstufe**: Das IMGW-PIB gibt für diese Station keine Warn- und Alarmstufen an
  (viele Seen und Stauseen).
- **Keine Wassertemperatur**: Nur rund hundert Stationen messen sie, einmal täglich.
- **„Keine neue Messung seit…“**: Die Station sendet verspätet oder gar nicht (Ausfall,
  Wartung, Eis).
- Protokolle: in Gladys die Protokolle der Integration; `LOG_LEVEL=debug` zeigt jeden Zyklus.

## Grenzen

- Keine Hardware nötig; gegen den echten Dienst und aufgezeichnete Antworten getestet, aber
  noch nicht in einer echten Gladys-Installation: Rückmeldungen willkommen.
- Keine hydrologischen Warnungen des IMGW-PIB (sie gelten für Einzugsgebiete, nicht für
  Stationen), keine Vorhersagen, keine Eiserscheinungen: nur Messwerte und Schwellen.
- Höchstens 20 Stationen aus der Konfiguration (plus die, deren Gerät du angelegt hast).
- Die Funktionsnamen werden beim Anlegen des Geräts festgelegt: Eine spätere Sprachänderung
  ändert nur die danach gesendeten Texte.
