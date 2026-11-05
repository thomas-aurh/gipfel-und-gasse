# Gipfel & Gasse

Tourenplaner für Berg und Stadt auf OpenStreetMap: Route planen, Höhenprofil, Gehzeit, Wegtypen, Kinderwagen-Einschätzung,
Sehenswürdigkeiten und Stadtrundgänge, Wetter, Info zu Orten (geöffnet jetzt, Wikipedia, Google Maps), Reisetagebuch,
Reiseziele, GPX, Karte drucken. Als **Web-App** (eine HTML-Datei) und als
**Android-App**, die unterwegs auch bei gesperrtem Bildschirm navigiert und aufzeichnet.

## Im Browser (PC oder Handy)

**https://thomas-aurh.github.io/gipfel-und-gasse/** öffnen, nichts zu installieren; nach jedem Merge die neue Fassung.
Planen, Touren, Etappen, Reisetagebuch, Reiseziele, Gipfelbuch, Wetter und Drucken gehen hier genauso. Nur die Android-App
kann navigieren und aufzeichnen bei gesperrtem Bildschirm und Offline-Kartenpakete. Die Daten liegen je Browser bzw. App:
am PC „Sicherung speichern“ (Menü › Sicherung), die Datei aufs Handy schicken, dort „Sicherung laden“.

## Android-App installieren

1. Auf dem Handy öffnen: **https://github.com/thomas-aurh/gipfel-und-gasse/releases/tag/neueste**
2. `Gipfel-und-Gasse.apk` antippen und herunterladen.
3. Beim ersten Mal fragt Android, ob der Browser Apps installieren darf: erlauben (Einstellungen › „Unbekannte Apps
   installieren“). Danach installieren.
4. Beim ersten „▶ Route folgen“ fragt die App nach **Standort** („Bei Nutzung der App“ genügt) und **Mitteilungen**.

Updates genauso: neue APK von derselben Seite installieren, die Touren bleiben erhalten.

**Bedienung:** Der Kartennachweis steht am Telefon in einer Zeile („Kartendaten © OpenStreetMap-Mitwirkende …“), Antippen zeigt ihn ganz. Unten die fünf Hauptbereiche Karte, Entdecken (Orte und Wetter), Planen, Unterwegs und Ich (Touren mit Geplant
und Gegangen samt Statistik, Reisetagebuch, Reiseziele, Gipfelbuch), links oben das Menü ☰ mit Offline-Karten, Notfall,
Sicherung und Info. Eine Tour in der Liste antippen öffnet ihre Seite mit „▶ Los“ (folgen mit Ansagen), „✏️ Bearbeiten“,
Link, GPX und Drucken; läuft Folgen oder Aufzeichnen, zeigt ein Balken über der Leiste das an (Antippen öffnet Unterwegs). Am Telefon lässt sich das Blatt unten am Kopf hoch- und herunterziehen, oder
im Inhalt nach unten wischen, wenn er ganz oben steht. *Planen* hat oben die Aktionsleiste („▶ Los“ folgt der Route sofort, 💾 Speichern, ↶ Rückgängig, ✕ Neu,
⋯ Mehr) und, sobald eine Route steht, drei Reiter: **📍 Route** (Art und Tempo als Zeile zum Aufklappen, Punkte und
Stopps, Etappen), **📊 Überblick** (Kennzahlen, Höhenprofil, Kinderwagen, Wegtypen, Untergrund) und **🎒 Vorbereiten**
(Tag, Startzeit, Pausen und Name, Zeitplan, Wetter für die Tour, Packliste, Familien-Check, Anreise). Ein Punkt am Reiter
„Vorbereiten“ zeigt eine Warnung des Zeitplans an. Strecke, Zeit und Aufstieg stehen immer im Kopf des Blatts. Die App startet am Telefon mit der reinen Karte; mit dem Ziel der ersten Route geht *Planen* auf. Ohne Route bietet *Planen* „⭕ Runde mit Länge“, „🏛️ Stadtrundgang“
und die zuletzt gespeicherte Tour an. Am Touchscreen wird mit zwei Fingern gezoomt; das Fadenkreuz ⌖ steht nur beim Planen.

**Offline-Karten:** Menü ☰ › *Offline-Karten* (oder Kartenart und Ebenen rechts an der Karte › „Kartenpakete laden und verwalten“): Region
herunterladen (Oberbayern mit München, Innsbruck und Salzburg; Allgäu und Bodensee; die Größe steht
in der Liste). Danach unter Kartenart und Ebenen (rechts an der Karte) „Offline-Karte“ und „Höhenlinien und Relief“; ohne Netz
schaltet die App selbst um. Auch Höhen für gerade Linien und GPX-Dateien kommen dann aus dem Paket. Enthält das Paket Routendaten,
plant die App auch Routen ohne Netz (BRouter läuft im Handy). Mit der Orte-Datei des Pakets kommen „Orte entlang der Route“
und die Sehenswürdigkeiten der Stadt aus dem Paket, die Suche findet Orte, Gipfel, Hütten, Straßen und Haltestellen auch ohne Netz
(mit Netz mischt sie die Treffer mit denen von Photon). Nur das Wetter braucht Netz. Bei gewählter Offline-Karte zeigt ein
gestrichelter Rahmen mit Namen, wie weit jedes installierte Paket reicht; außerhalb davon zeigt die App die topografische Karte (mit Netz). Zeigt die Offline-Karte nichts:
*Offline-Karten* › „🔍 Offline-Karte prüfen“ und das Ergebnis senden.

**Zeitplan:** In *Planen* Tag, Startzeit und Pausen eintragen: die App nennt die Ankunft und den Sonnenuntergang am Ziel
(ohne Netz gerechnet) und warnt, wenn weniger als 30 Minuten Reserve bleiben; ohne Startzeit nennt sie den spätesten Start.
Darunter „Anreise zum Start“ mit Bus und Bahn oder Auto (öffnet Google Maps).

**Stopps und Tourliste:** Ab drei Punkten steht unter *Planen* die Liste der Punkte; am Griff ≡ zieht man einen Stopp
oder das Ziel an eine andere Stelle (eine grüne Linie zeigt, wo er landet), mit der Maus gehen auch ▲ und ▼ (am Touchscreen
nur der Griff). Der Start bleibt, „↶ Rückgängig“ holt die alte Reihenfolge. Punkt entfernen, Ordnen und Tage teilen melden
sich unten mit „↶ Rückgängig“ in der Meldung (7 s). Am PC ist das Blatt 440 px breit. Ab drei Touren lassen sich die Listen unter
*Touren* durchsuchen und sortieren (neueste, älteste, Name, Länge, Höhenmeter), geplante auch nach Art filtern (Wandern, Laufen,
Rad, Stadt, GPX).

**GPX laden:** Menü ☰ › „📂 GPX-Dateien laden“ (oder unter Ich › Touren „📂 GPX laden“), auch mehrere Dateien auf einmal:
jede kommt gleich als Tour unter „Geplant“, bei einer Datei geht ihre Tourseite auf. Fehlen Höhen, ergänzt die App sie.
Aus der Datei übernimmt die App außerdem die Wegpunkte (z. B. Highlights aus komoot: Hütten 🏠, Gipfel ⛰️, sonst 📍; auf der
Karte und auf der Tourseite mit ihrer Lage an der Strecke), die Art (`<type>` hike, running, cycling … → Wandern, Laufen, Rad),
die Herkunft („aus komoot.de“) und, wenn die Punkte Zeitstempel tragen, die „Dauer laut Datei“ neben der eigenen Gehzeit.

**Anreise und Parkplatz:** Auf der Tourseite unter „Anreise zum Start“: „🚆 Bus und Bahn“ und „🚗 Auto“ öffnen Google Maps mit
dem Weg zum Start; „🅿️ Parkplätze am Start“ zeigt öffentliche Parkplätze bis 1 km um den Start (aus OpenStreetMap, ohne Netz
aus dem Kartenpaket) mit Abstand, Gebühr und Plätzen, „🚗 hin“ führt mit Google Maps dorthin.

**Fotos:** Ich › *Fotos* zeigt alle Bilder aus dem Reisetagebuch als Raster, neueste zuerst. Antippen zeigt ein Foto groß;
wischen oder ‹ › blättert. Unten stehen Reise und Zeitpunkt, „📔 Zur Reise“ springt zum Eintrag, „🥾 …“ öffnet die gegangene
Tour desselben Tages. „📤 Teilen“ (oben links) gibt das Foto weiter, in der App über das Teilen-Menü von Android
(WhatsApp, Signal, Mail …), im Browser über dessen Teilen-Funktion oder als Download. Auf der Seite einer gegangenen Tour stehen umgekehrt die Fotos dieses Tages, und auf ihrer Karte liegen sie als kleine
Bilder an der Stelle, an der sie entstanden sind. Die Stelle kommt aus dem Foto selbst (GPS in den EXIF-Daten, höchstens
1 km neben der Spur), sonst aus dem Aufnahmezeitpunkt auf der Spur der Aufzeichnung (± 15 min um die Tour), sonst aus dem
Ort des Eintrags (höchstens 300 m neben der Spur); ohne passende Stelle bleibt das Foto nur im Raster. Ort und Zeitpunkt
werden beim Hinzufügen aus dem Original gelesen; Android entfernt den Ort bei der Auswahl aus der Galerie oft, dann zählt
die Zeit. Die Fotos liegen im Speicher der App (IndexedDB, auf 1600 px verkleinert, Originale der Kamera auf Wunsch in der
Galerie unter Bilder › Gipfel und Gasse) und kommen mit in die Sicherung.

**Sicherung:** Menü › Sicherung › „💾 Sicherung speichern“ schreibt eine ZIP-Datei: `sicherung.json` (Touren, Tagebuch,
Reiseziele, Gipfelbuch) und je Foto eine Bilddatei unter `fotos/`, die sich auch am PC öffnen lässt. Die App schreibt die
Datei in Stücken zu 3 MB und gibt sie dann über das Teilen-Menü weiter (Drive, Mail …), so wird auch eine Sicherung mit
vielen Fotos nicht zu groß für den Speicher. „📥 Sicherung laden“ nimmt die ZIP-Datei und ältere Sicherungen (ein JSON mit
den Fotos als Text) und ergänzt, was fehlt.

**Ladeanzeige:** Dauert eine Anfrage an einen Dienst (Route, Suche, Orte, Wetter, Wanderwege) länger als einen Moment,
erscheint oben über der Karte das Logo, in dem ein kleiner Wanderer den Weg zum Gipfel hinauf- und wieder hinuntergeht.

**Wanderwege in der Nähe:** In *Entdecken* „Wanderwege suchen“ (2, 5 oder 10 km um die Kartenmitte): markierte Wanderwege
aus OpenStreetMap (über Waymarked Trails, sonst Overpass) mit Länge, Rundweg und Netz (örtlich, regional, Fernwanderweg zuletzt). Antippen zeigt den Verlauf auf
der Karte, „＋ Tour“ legt ihn mit Höhen unter „Geplant“ ab („aus OpenStreetMap“). Es sind beschilderte Wege, keine
ausgesuchten Touren mit Beschreibung; Stücke, die in OSM nicht zusammenhängen, bleiben getrennte Abschnitte. Braucht Netz.

**Familie:** In *Planen* „👨‍👩‍👧 Familien-Check“: passt die Tour zur gewählten Grenze (bis 5 km und 200 Hm, 8 km und 400 Hm
oder 12 km und 700 Hm; gewählt unter *Touren* in der Liste, sonst 8 km und 400 Hm), und gibt es auf halber Strecke (30 bis
70 % der Länge, bis 250 m neben der Route) einen Spielplatz oder eine Einkehr? Die geplanten Touren lassen sich mit
derselben Grenze filtern.

**Stadtrundgang nach Zeit:** In *Entdecken* (Stadt) unter „Rundgang“ statt einer Anzahl Orte „⏱ in 1 Stunde“ bis „4 Stunden“
wählen: Die App nimmt die bekanntesten Orte, so viele in die Zeit passen (Weg samt Besichtigung), misst nach dem Routen nach
und lässt bei Bedarf den letzten Ort weg.

**Mehrtagestour:** Ganz oben in *Planen* die Art **„🛏 Mehrtagestour“** wählen (geroutet wie Wandern): die App schlägt die Zahl der Tage
vor (höchstens etwa 6,5 h Gehzeit am Tag, bis 30 Tage, ★ in der Auswahl) und teilt die Tour nach Gehzeit in gleich lange Tage: liegt ein vorhandener Punkt höchstens 15 % eines Tages neben der
Grenze, wird er die Übernachtung, sonst setzt die App einen neuen Punkt und legt ihn auf die nächste Hütte oder Unterkunft bis 2 km (OpenStreetMap über
Overpass; Berghütte vor Gasthof, Herberge und Hotel); findet sie keine, bleibt er auf der Route (ziehen verschiebt ihn). Je Tag steht dann
eine Karte mit Datum, Strecke, Höhenmetern, Gehzeit, Start (ab Tag 2 eigene Startzeit) und darunter den Punkten dieses Tages; ein
Tag, der länger als das Tageslicht ist, wird so benannt. 🛏 an einem Punkt beendet den Tag dort; jeder Tag hat auf der Karte seine Farbe. Eine andere Art (z. B. „Wandern“)
nimmt Übernachtungen und gesetzte Punkte zurück (Rückgängig holt sie wieder). Weiter geht auch: Zwischenziel antippen › „🛏 Hier übernachten“. Unter *Planen* steht dann je
Tag Strecke, Höhenmeter, Gehzeit und höchster Punkt, mit Startzeit die Ankunft gegen den Sonnenuntergang am Etappenziel.
Ab Tag 2 lässt sich eine eigene Startzeit eintragen (leer: wie Tag 1); sie gilt auch für Stopps, Tourwetter und Druck und
bleibt mit der Tour gespeichert. Unter *Unterwegs* wählt „Welcher Tag?“ mit großen Knöpfen (Strecke, Gehzeit, Ziel je Tag) einen Tag (vorgewählt der Tag, der nach dem geplanten
Starttag heute ist, sonst Tag 1) oder die ganze Tour: die Navigation, auch der Dienst der App mit Ansagen und Umplanen,
bekommt dann nur diese Etappe und meldet am Abend „Etappe geschafft“. Der Druck listet die Etappen je Tag.
„📔 Als Reise ins Tagebuch“ legt die Reise über diese Tage an.

**Packliste:** „🎒 Packliste“ unter *Planen* und auf der Tourseite stellt zusammen, was mit muss: Grundausstattung je
Wandern, Stadt, Laufen und Rad; Wasser nach Gehzeit (etwa ½ l je Stunde, mehr bei Hitze); Wechselshirt, Stöcke und
Stirnlampe nach Aufstieg, Abstieg und Länge; Sonnenschutz in der Höhe; Kleidung nach dem geladenen Tourwetter (Kälte, Regen,
Wind, Hinweis bei Gewitter); Hüttensachen bei Etappen; Zusätze beim Tempo „Mit Kind“. Abhaken merkt sich die App je Tour,
eigene Dinge („Fernglas“) stehen bei allen Touren unter „Eigenes“.

**Wetter für die Tour:** In *Planen* „🌦 Wetter für die Tour“: Vorhersage für Start, höchsten Punkt und Ziel (bei Etappen je
Tag), jeweils für die Stunde, in der man laut Zeitplan dort ist, umgerechnet auf die Höhe des Punkts. Warnt bei Gewitter,
Sturmböen (ab 60 km/h) und Frost. Ohne Startzeit rechnet die App ab 9 Uhr; bis 16 Tage voraus.

**Reiseziele:** Menü ☰ › *Reiseziele*: Listen mit Zielen (Ort per Suche, Notiz, Link, Stichworte, Stand Idee/geplant/
besucht), als ⭐ auf der Karte; Fenster mit Anreise, Wetter dort und „Als Stopp“. „📂 Datei laden“ liest Text (eine Zeile
je Ziel, die App sucht den Ort), CSV (`Name;Ort;Notiz;Link`, auch mit `lat;lon`), GPX-Wegpunkte, KML aus Google My Maps
und GeoJSON; „📋 Liste einfügen“ nimmt dieselben Zeilen aus einer Notiz oder Nachricht. „⬇ Als GPX“ gibt eine Liste weiter. Im Info-Fenster merkt „⭐ Merken“ einen Ort. Kommt mit in die Sicherung.

**Gipfelbuch:** Menü ☰ › *Gipfelbuch*: Kommt eine gespeicherte Aufzeichnung bis auf 50 m an einen Gipfel aus OpenStreetMap,
steht er hier mit Höhe, Tag und Zahl der Besuche (ohne Netz aus dem Kartenpaket). „🔍 Gegangene Touren durchsuchen“ holt das
für ältere Touren nach. Kommt mit in die Sicherung.

**Info auf der Karte:** Der Knopf ⓘ rechts an der Karte schaltet zwischen Planen (Antippen setzt Punkte) und Info: Dann
zeigt Antippen, was dort ist (Name, Art, geöffnet jetzt, Eintritt, Wikipedia, Link zu Google Maps), aus dem Kartenpaket und von Overpass; im
Fenster geht es weiter mit „Als Stopp“ oder „Hier starten“.

**Orte und Sehenswürdigkeiten:** Das Ort-Fenster zeigt, ob jetzt geöffnet ist (aus den Öffnungszeiten in OpenStreetMap,
ohne Feiertage), und bei Orten mit Wikipedia-Artikel eine Kurzinfo mit Bild, auf Wunsch vorgelesen. In *Entdecken* sucht
„☔ Drinnen in der Nähe“ Museen, Bäder, Kino und Ähnliches rund um den Wetterort; bei Regen heute oder morgen ist der Knopf
hervorgehoben. Ein Ort, der „Als Stopp“ in die Tour kommt, nimmt seine Öffnungszeiten mit: Mit Startzeit im Zeitplan steht
unter jedem Stopp die Ankunft und ob dann geöffnet ist (⛔ geschlossen, ⚠️ schließt während des Besuchs oder öffnet erst kurz
danach). Die Zeiten stammen aus OpenStreetMap (bei Museen und Gasthäusern meist eingetragen, bei Hütten selten).

**Bescheid geben:** „📣 Bescheid geben“ (Unterwegs und Planen › Vorbereiten) schickt über das Teilen-Menü (im Browser
in die Zwischenablage) eine Nachricht an eine vertraute Person: Tour, Länge, Aufstieg, Gehzeit, Start als Google-Maps-Link,
geplante Rückkehr, „melde ich mich bis … nicht: Notruf 112“ und den Link zur Tour (Empfehlung des DAV, Ziel, Route und
Rückkehrzeit zu hinterlassen). Unter *Unterwegs* steht dann die geplante Rückkehr; ist sie vorbei, erinnert die App
(in der App als Mitteilung von Android, auch bei geschlossener App; im Browser beim nächsten Blick in die Seite) und „✅ Ankunft melden“
schickt „Bin gut angekommen“. Kein Server, kein Live-Standort.

**Passt die Tour zu mir?** Unter *Vorbereiten*: Trittsicherheit nach der SAC-Wanderskala (T1 bis T6 aus OpenStreetMap),
Kondition nach Aufstieg und Gehzeit (je Tag bei Mehrtagestouren), langer Abstieg, Höhe über 2500 m und Hinweise mit Kind.

**Hütten:** Bei einer Mehrtagestour zeigt die Karte eines Tages zur Unterkunft Telefon („📞“, ruft an), Webseite zum
Reservieren und Öffnungszeiten, soweit OpenStreetMap sie kennt.

**Notfall:** Menü ☰ › *Notfall*: „🔦 Notsignal geben“ (alpines Notsignal: sechs Zeichen je Minute, eine Minute Pause; in der App mit der Taschenlampe, sonst blinkt der Bildschirm, dazu Ton und Vibration), Hinweis auf die Notruf-App SOS-EU-ALP; Koordinaten zum Vorlesen, „📍 Standort senden“ (SMS, Messenger) und „📞 112“.

**Unterwegs:** Leiste unten › *Unterwegs* › „▶ Route folgen“ und/oder „⏺ Aufzeichnung starten“. Im Browser sichert die
Seite die Aufzeichnung laufend; wird der Tab neu geladen oder vom Browser verworfen, zeichnet sie danach weiter (über 12 h
alt: nur noch speichern). Danach darf der Bildschirm aus:
Android zeigt die Mitteilung „Noch 3,2 km · 1:10 h“, die Sprachausgabe sagt Abzweigungen an („In 100 Metern links
abbiegen“, „Jetzt links abbiegen“, Kreisverkehr mit Ausfahrt), jeden Kilometer Rest und Zeit, kündigt Stopps an, warnt mit Vibration, wenn man mehr als 50 m neben der Route ist, und meldet das Ziel. Beenden geht in der
App oder direkt in der Mitteilung. Mit „🎧 Führung“ liest die App an jedem Stopp mit Wikipedia-Artikel dessen Kurzinfo vor
(Stopps aus *Entdecken* oder der Stadt-Liste bringen ihn mit); die Texte lädt sie beim Losgehen, unterwegs braucht es dafür
kein Netz.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `web/` | die Web-App: Quellen, Bau (`build.sh`), Prüfung (`pruefen.sh`), Tests. Beschreibung in [`web/README.md`](web/README.md) |
| `android/` | Android-Projekt (Capacitor 8). Eigener Code in `app/src/main/java/io/github/thomasaurh/gipfelundgasse/`: `NaviService` (Vordergrunddienst: GPS, Rest, Abweichung, Ansagen, Aufzeichnung), `NaviPlugin` (Brücke zur Oberfläche, Teilen, Drucken), `NaviRechnen` (Formeln wie die Web-App, mit JUnit-Test), `KartenServer` (liefert Kartenpakete in Teilen an die Oberfläche, Bereich aus `?von=&bis=` oder Range-Kopfzeile, Fehler als Text), `KartenPlugin` (Pakete laden, prüfen, löschen), `Routing` und `RoutingPlugin` (BRouter ohne Netz, dieselbe Antwort wie brouter.de) |
| `web/src/58-offline.js` | Offline-Karten in der App: Vektorkarte aus dem Paket, Höhenlinien und Relief (eigene Leaflet-Ebene), Höhen ohne Netz, Routen, Orte und Suche ohne Netz, Paketverwaltung |
| `web/vendor/offline/` | Eingang des Offline-Bündels (protomaps-leaflet, pmtiles), von `web/build.sh` mit esbuild gebündelt, Lizenzen werden angehängt |
| `karten/` | Kartenpakete: `regionen.json` (Regionen), `bauen.py` (Bau, holt auch die Routendaten), `hoehe.py` (Höhen-Paket), `orte.py` (Orte und Suche aus OSM-Auszügen von Geofabrik), `probe.js` (Probe-Rendering), `orte-probe.js` (Probe-Suche auf den echten Orten), `routing-probe.sh` mit `RoutingProbe.java` (Probe-Routen auf den echten Routendaten) |
| `werkzeuge/brouter-holen.sh` | holt die Routen-Engine BRouter in fester Fassung nach `android/brouter/` und die Profile in die App (nicht im Repo) |
| `.github/workflows/kartenpakete.yml` | baut die Pakete monatlich und auf Knopfdruck, prüft sie im Browser, veröffentlicht auf der Release „kartenpakete“ |
| `web/src/75-app.js` | verbindet die Oberfläche in der App mit dem Navigationsdienst; im Browser ohne Wirkung |
| `werkzeuge/symbole.js` | erzeugt App-Symbole und Startbilder aus `web/src/logo.svg` |
| `.github/workflows/app.yml` | prüft die Web-App, rechnet die Java-Tests, baut die APK; nach dem Merge auf `main` neue Download-Seite |

## Bauen

```bash
npm ci
npm run sync            # Web-App bauen und in android/ kopieren
sh werkzeuge/brouter-holen.sh   # Routen-Engine BRouter in fester Fassung
cd android && ./gradlew assembleRelease   # braucht das Android-SDK; sonst baut GitHub Actions
```

## Testen

```bash
npm ci
npm test                # Web-Prüfung und Klicktest (Playwright mit Chromium)
```

Für die Offline-Prüfungen erzeugt der Klicktest Testkarten mit `web/test/testkarten.py`
(`pip install pmtiles mapbox-vector-tile pillow`). Der Klicktest braucht Chromium für Playwright: einmal `npx playwright install chromium` (in der Cloud-Umgebung von
Claude ist es schon da). Er bildet die Kartendienste nach und prüft auch die Anbindung an die Android-App.

## Fremde Inhalte und Lizenzen

- Kartendaten © OpenStreetMap-Mitwirkende (ODbL); Kacheln, Dienste und Leaflet siehe [`web/README.md`](web/README.md).
- Capacitor (MIT), AndroidX (Apache 2.0).
- BRouter (MIT, © BRouter contributors): Routen-Engine und Profile in der App, Lizenz in den App-Dateien
  (`assets/brouter/LICENSE-BRouter.txt`); Routendaten von brouter.de, aus OpenStreetMap (ODbL).
- Orte und Suche der Pakete: aus OpenStreetMap (© OpenStreetMap-Mitwirkende, ODbL), Auszüge von Geofabrik; gelesen mit
  pyosmium (BSD-2-Clause) nur beim Bau der Pakete.
- Offline-Karten: protomaps-leaflet, pmtiles, @protomaps/basemaps (BSD-3-Clause) und deren Abhängigkeiten; alle
  Lizenztexte stehen in der fertigen HTML-Datei. Kartendaten der Pakete © OpenStreetMap-Mitwirkende (ODbL), Kacheln
  Protomaps; Höhen: Mapzen/Tilezen Terrain Tiles (u. a. SRTM, GMTED2010, EU-DEM: produziert mit Copernicus-Daten,
  finanziert von der EU).
- Code, Gestaltung, Logo und Symbole sind selbst gemacht.
