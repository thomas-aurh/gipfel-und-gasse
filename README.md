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

**Bedienung:** Unten die fünf Hauptbereiche Karte, Entdecken (Orte und Wetter), Planen, Unterwegs und Ich (geplante und
gegangene Touren mit Statistik, Reisetagebuch, Reiseziele, Gipfelbuch), links oben das Menü ☰ mit Offline-Karten, Notfall,
Sicherung und Info. Eine Tour in der Liste antippen öffnet ihre Seite mit „▶ Los“ (folgen mit Ansagen), „✏️ Bearbeiten“,
Link, GPX und Drucken; läuft Folgen oder Aufzeichnen, zeigt ein Balken über der Leiste das an (Antippen öffnet Unterwegs). Am Telefon lässt sich das Blatt unten am Kopf hoch- und herunterziehen, oder
im Inhalt nach unten wischen, wenn er ganz oben steht. *Planen* zeigt oben Strecke, Zeit, Höhenmeter und das Höhenprofil; Art und Tempo („🥾 Wandern · Normal“) sowie Name, Tag
und Startzeit sind am Telefon je eine Zeile zum Aufklappen. Die App startet am Telefon mit der reinen Karte; mit dem Ziel der ersten Route geht *Planen* auf. Ohne Route bietet *Planen* „⭕ Runde mit Länge“, „🏛️ Stadtrundgang“
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

**Stopps und Tourliste:** Ab drei Punkten steht unter *Planen* die Liste der Punkte; ▲ und ▼ schieben einen Stopp oder das
Ziel eine Stelle weiter (der Start bleibt, „↶ Rückgängig“ holt die alte Reihenfolge). Ab drei Touren lassen sich die Listen unter
*Touren* durchsuchen und sortieren (neueste, älteste, Name, Länge, Höhenmeter), geplante auch nach Art filtern (Wandern, Laufen,
Rad, Stadt, GPX).

**Mehrtagestour:** Ein Zwischenziel antippen › „🛏 Hier übernachten“ teilt die Tour in Etappen. Unter *Planen* steht dann je
Tag Strecke, Höhenmeter, Gehzeit und höchster Punkt, mit Startzeit die Ankunft gegen den Sonnenuntergang am Etappenziel (jeder
Tag beginnt zur selben Startzeit). „📔 Als Reise ins Tagebuch“ legt die Reise über diese Tage an.

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

**Notfall:** Menü ☰ › *Notfall*: Koordinaten zum Vorlesen, „📍 Standort senden“ (SMS, Messenger) und „📞 112“.

**Unterwegs:** Leiste unten › *Unterwegs* › „▶ Route folgen“ und/oder „⏺ Aufzeichnung starten“. Danach darf der Bildschirm aus:
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
