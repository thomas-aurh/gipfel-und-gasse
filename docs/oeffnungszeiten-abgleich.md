# Öffnungszeiten: OpenStreetMap gegen Google Maps (Stichprobe 03.11.2026)

Gehört zur Entscheidung „Öffnungszeiten der Stopps gegen den Zeitplan“ in [STAND.md](../STAND.md).

Frage: Wie verlässlich sind die Öffnungszeiten, die die App aus OpenStreetMap zeigt (`opening_hours`, Kartenpaket
Oberbayern vom 03.11.)? Stichprobe: je 10 Museen, Gasthäuser/Cafés und Hütten mit eingetragenen Zeiten, gezogen mit festem
Startwert (20261103) aus `oberbayern-orte-4d3e6ae8678e.json.gz`. Google Maps im Browser von Hand gelesen (Stand 03.11.,
nur die aktuelle Woche, also die Winterzeiten). Bei Abweichung entschied, wo möglich, die offizielle Webseite.

## Ergebnis

| | Anzahl |
|---|---|
| beide gleich | 11 |
| abweichend | 8 |
| Google ohne Zeiten (meist Hütten, bei Google als Unterkunft geführt) | 8 |
| Google findet den Ort nicht | 1 |
| OSM ohne vergleichbare Zeiten („Mo off“, „siehe Webseite“) | 2 |

Von den 19 Orten, für die beide etwas sagen, stimmen 11 überein (58 %). Bei Gasthäusern und Cafés passte es meist
(6 von 8 vergleichbaren), bei Museen nur 3 von 9.

Schiedsrichter offizielle Seite (6 der 8 Abweichungen):
- **OSM richtig, Google falsch (2):** EFA Mobile Zeiten (Google zeigt die Sommerzeiten), Jurahaus Eichstätt (Google
  zeigt die Sommerzeiten, Mittwoch/Donnerstag vertauscht).
- **Google richtig, OSM falsch (3):** Stadtresidenz Landshut (wegen Bauarbeiten geschlossen, OSM zeigt Zeiten),
  Altmühlzentrum Dollnstein (Saisonpause, OSM ohne Saison), Bellevue di Monaco (OSM-Zeiten veraltet).
- **offen (1):** Staatliche Graphische Sammlung (Google täglich 7–20 Uhr, unplausibel; OSM die Studiensaal-Zeiten;
  die offizielle Seite nennt keine Zeiten).
- **ohne Schiedsrichter (2):** Hobis Backstube, Burgeralm (Google „vorübergehend geschlossen“, keine eigene Seite gefunden).

## Was daraus folgt

1. Die gefährlichste Abweichung ist „OSM sagt geöffnet, der Ort ist zu“ (Sanierung, Saisonpause): 2 von 30. Die App
   sollte bei Stopps den Link zur Webseite oder zu Google Maps nahe an die Zeitplan-Prüfung stellen und das Alter
   der Angabe zeigen, wo OSM es kennt (`check_date:opening_hours`, `check_date`).
2. Für Hütten ist OSM besser als Google: Google führt 7 von 10 Hütten als Unterkunft ohne Öffnungszeiten.
3. Google ist nicht durchweg besser: bei 2 Museen zeigte es die falsche Saison.
4. Ein automatischer Abgleich ist nicht möglich (Google erlaubt das Speichern und Vergleichen nicht); diese Stichprobe
   ist von Hand.

## Einzelwerte

| Nr | Art | Ort | OSM | Google (03.11.) | Urteil |
|---|---|---|---|---|---|
| 1 | Museum | Grabkreuzmuseum Bergmeister | Sa 09–12 | keine Zeiten | – |
| 2 | Museum | Fraunhofer-Glashütte | Mo–So 09–16 | täglich 09–16 | gleich |
| 3 | Museum | Foltermuseum Burghausen | 10–17 | täglich 10–17 | gleich |
| 4 | Museum | Meißener Porzellan, Schloss Lustheim | Oct–Mar Di–So 10–16 | Di–So 10–16 | gleich |
| 5 | Museum | EFA Mobile Zeiten | Sep 14–Nov 08 Sa, So 10–17 | Mi–So 10–17 | OSM näher (offiziell: Sa/So, 4.–8.11. täglich, ab 9.11. Winterpause) |
| 6 | Museum | Staatliche Graphische Sammlung | Mo 14–17; Di–Do 10–13, 14–17; Fr 10–13 | täglich 07–20 | offen |
| 7 | Museum | Stadtresidenz Landshut | Oct–Mar 10–16 | vorübergehend geschlossen | Google richtig (Bauarbeiten) |
| 8 | Museum | Altmühlzentrum | Di–So 09:30–17:30 | vorübergehend geschlossen | Google richtig (Saisonpause) |
| 9 | Museum | Das Jurahaus | Nov–Mar Mi 09–12, Fr 14–17 | Sommerzeiten, Mi/Do vertauscht | OSM richtig |
| 10 | Museum | Tirol Panorama | Mi–Mo 09–17 | Mi–Mo 09–17 | gleich |
| 11 | Gasthaus | Trattoria da Salvino | Mo–Sa 11:30–14:30, 17:30–22 | gleich | gleich |
| 12 | Gasthaus | Gasthof Michael Forster | Di–Mi 10–14, Do–So 10–01 | keine Zeiten | – |
| 13 | Gasthaus | Servus Bar | Di–Fr 16–23:30, Sa–So 14–23:30 | gleich | gleich |
| 14 | Café | Seeliebe | Mo–So 10–20 | nicht gefunden | – |
| 15 | Gasthaus | Sahyadri | Mo 17:30–22, Di–So 11:30–14:30, 17:30–22 | gleich | gleich |
| 16 | Café | Hobis Backstube | Mo, Di, Fr 06:30–13 … | vorübergehend geschlossen | ohne Schiedsrichter |
| 17 | Gasthaus | Pizzeria Giuseppe Zell am See | Mo–So 11:30–22 | gleich | gleich |
| 18 | Café | Bellevue di Monaco | Di 11–17, Mi 11–18, Do–Sa 11–22 | Di–Fr 9–22, Sa 10–22, So 10–17 | Google richtig |
| 19 | Gasthaus | Pasto | Mo–So 10–24 | täglich 10–24 | gleich |
| 20 | Gasthaus | Ngon Soulfood | Mo–Fr, So 11:30–15, 17:30–22 | gleich | gleich |
| 21 | Hütte | Hörnlehütte | 08–22; Apr, Nov off | keine Zeiten (Unterkunft) | – |
| 22 | Hütte | Berghaus Aschenbrenner | Di–So 09–18 | keine Zeiten (Unterkunft) | – |
| 23 | Hütte | Burgeralm | Di off | vorübergehend geschlossen | ohne Schiedsrichter |
| 24 | Hütte | Hochsonnbergalm | May–Oct Do–So 09–18 | keine Zeiten | – |
| 25 | Hütte | Buchenbergalm | Mo–So 09–18 | täglich 09–18 | gleich |
| 26 | Hütte | Priener Hütte | Mo–Di off | keine Zeiten (Unterkunft) | – |
| 27 | Hütte | Rotmoosalm | May–Oct 09–22 | keine Zeiten (Unterkunft) | – |
| 28 | Hütte | Albert-Link-Hütte | Mo off | Di–Sa 10–18, So 10–17, Mo zu | OSM unvollständig |
| 29 | Hütte | Schönfeldhütte | Apr 29–Nov 08 | keine Zeiten (Unterkunft) | – |
| 30 | Hütte | Grünsteinhütte | „siehe Webseite“ | nicht verglichen | – |
