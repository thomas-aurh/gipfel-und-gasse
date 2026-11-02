# Gipfel & Gasse

Tourenplaner für Berg und Stadt auf OpenStreetMap: Route planen, Höhenprofil, Gehzeit, Wegtypen, Kinderwagen-Einschätzung,
Sehenswürdigkeiten und Stadtrundgänge, Wetter, GPX, Karte drucken. Als **Web-App** (eine HTML-Datei) und als
**Android-App**, die unterwegs auch bei gesperrtem Bildschirm navigiert und aufzeichnet.

## Android-App installieren

1. Auf dem Handy öffnen: **https://github.com/thomas-aurh/gipfel-und-gasse/releases/latest**
2. `Gipfel-und-Gasse.apk` antippen und herunterladen.
3. Beim ersten Mal fragt Android, ob der Browser Apps installieren darf: erlauben (Einstellungen › „Unbekannte Apps
   installieren“). Danach installieren.
4. Beim ersten „▶ Route folgen“ fragt die App nach **Standort** („Bei Nutzung der App“ genügt) und **Mitteilungen**.

Updates genauso: neue APK von derselben Seite installieren, die Touren bleiben erhalten.

**Offline-Karten:** Kartenwahl 🗺️ › „Kartenpakete laden und verwalten“ (oder Reiter *Touren* › *Offline-Karten*): Region
herunterladen (Oberbayern mit München, Allgäu und Bodensee; die Größe steht
in der Liste). Danach in der Kartenwahl 🗺️ „Offline-Karte“ und „Höhenlinien und Relief“; ohne Netz
schaltet die App selbst um. Auch Höhen für gerade Linien und GPX-Dateien kommen dann aus dem Paket. Enthält das Paket Routendaten,
plant die App auch Routen ohne Netz (BRouter läuft im Handy). Mit der Orte-Datei des Pakets kommen „Orte entlang der Route“
und die Sehenswürdigkeiten der Stadt aus dem Paket, die Suche findet Orte, Gipfel, Hütten, Straßen und Haltestellen auch ohne Netz
(mit Netz mischt sie die Treffer mit denen von Photon). Nur das Wetter braucht Netz.

**Zeitplan:** In *Planen* Tag, Startzeit und Pausen eintragen: die App nennt die Ankunft und den Sonnenuntergang am Ziel
(ohne Netz gerechnet) und warnt, wenn weniger als 30 Minuten Reserve bleiben; ohne Startzeit nennt sie den spätesten Start.

**Notfall:** Reiter *Unterwegs* › *Notfall*: Koordinaten zum Vorlesen, „📍 Standort senden“ (SMS, Messenger) und „📞 112“.

**Unterwegs:** Reiter *Unterwegs* › „▶ Route folgen“ und/oder „⏺ Aufzeichnung starten“. Danach darf der Bildschirm aus:
Android zeigt die Mitteilung „Noch 3,2 km · 1:10 h“, die Sprachausgabe sagt Abzweigungen an („In 100 Metern links
abbiegen“, „Jetzt links abbiegen“, Kreisverkehr mit Ausfahrt), jeden Kilometer Rest und Zeit, kündigt Stopps an, warnt mit Vibration, wenn man mehr als 50 m neben der Route ist, und meldet das Ziel. Beenden geht in der
App oder direkt in der Mitteilung.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `web/` | die Web-App: Quellen, Bau (`build.sh`), Prüfung (`pruefen.sh`), Tests. Beschreibung in [`web/README.md`](web/README.md) |
| `android/` | Android-Projekt (Capacitor 8). Eigener Code in `app/src/main/java/io/github/thomasaurh/gipfelundgasse/`: `NaviService` (Vordergrunddienst: GPS, Rest, Abweichung, Ansagen, Aufzeichnung), `NaviPlugin` (Brücke zur Oberfläche, Teilen, Drucken), `NaviRechnen` (Formeln wie die Web-App, mit JUnit-Test), `KartenServer` (liefert Kartenpakete mit echten Byte-Bereichen an die Oberfläche), `KartenPlugin` (Pakete laden, prüfen, löschen), `Routing` und `RoutingPlugin` (BRouter ohne Netz, dieselbe Antwort wie brouter.de) |
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
