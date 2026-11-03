# Gipfel & Gasse

Tourenplaner für Wanderungen, Stadtrundgänge und Radtouren auf OpenStreetMap, gedacht für Familienausflüge, Bergtouren und Städtereisen. Eine einzige
HTML-Datei, ohne Konto und ohne eigenen Server. Die Idee kommt von Apps wie komoot; Name, Gestaltung und Code sind eigen.

## Was es kann

| Bereich | Was passiert |
|---|---|
| **Berg oder Stadt** | Umschalter oben im Reiter Planen. Berg: topografische Karte, markierte Wanderwege, Orte entlang der Route. Stadt: Stadtplan, Sehenswürdigkeiten auf der Karte, Stopps mit Besichtigungszeit. |
| **Sehenswürdigkeiten** | ab Zoomstufe 14 auf der Karte: Museen und Galerien, Sehenswürdigkeiten (Denkmäler, Burgen, bekannte Kirchen), Aussicht, Parks, Kunst und Brunnen, Eis und Café, Spielplätze, Touristinfo, Toiletten. Orte mit Wikipedia-Eintrag sind größer und mit ⭐. Antippen zeigt Öffnungszeiten, Eintritt, Wikipedia und „➕ Als Stopp“. |
| **Stopps und Rundgang** | Stopps tragen Namen und Besichtigungszeit (vorgeschlagen, z. B. Museum 60 min, änderbar); die Gesamtzeit rechnet sie ein, unterwegs auch die Restzeit. „✨ Rundgang vorschlagen“ verbindet die bekanntesten 4 bis 10 Orte im Ausschnitt zu einer kurzen Runde ab dem Start. „⇅ Reihenfolge optimieren“ ordnet eigene Stopps neu. |
| **Karte drucken** | A4-Seite mit Name, Kennzahlen, Stopps, Karte samt Route und Höhenprofil; im Druckdialog auch als PDF speicherbar. Topografisch oder als Stadtplan, je nach gewählter Karte. |
| **Planen** | Auf die Karte tippen setzt Start, Zwischenziele und Ziel. Punkte lassen sich ziehen, antippen und entfernen; ein Tipp auf die Route fügt dort einen Punkt ein. Rückgängig (auch Strg+Z), zurück zum Start (Rundtour), umkehren. Arten: Wandern, Stadtspaziergang, Fahrrad, kürzester Weg, gerade Linie (weglos). |
| **Kennzahlen** | Strecke, Gehzeit nach DIN 33466 mit Tempo (zügig, normal, gemütlich, mit Kind), Auf- und Abstieg, höchster Punkt, Schwierigkeit nach SAC-Skala (T1 bis T6). |
| **Höhenprofil** | nach Steigung gefärbt; mit dem Finger oder der Maus darüber zeigt die Stelle auf der Karte, Doppeltipp springt hin. |
| **Wegtypen und Untergrund** | Anteile in km und Prozent (Pfad, Forstweg, Straße …; befestigt, Schotter, Naturboden, Fels); antippen hebt die Stellen auf der Karte hervor. |
| **Kinderwagen** | Einschätzung ja, mit Mühe, eher nicht oder unklar, mit Gründen (Treppen, Bergwege, Pfade, Naturboden, Steigung). |
| **Entdecken** | Wetter für drei Tage am Start mit Gewitterwarnung und Sonnenuntergang. Orte entlang der Route: Hütten und Einkehr, Gipfel und Aussicht, Trinkwasser, Spielplätze, Baden, Rastplätze, Wasserfälle, Bus und Bahn, Toiletten, Parkplätze. Ohne Route rund um die Kartenmitte. |
| **Suche** | Orte, Gipfel, Hütten (während des Tippens). Treffer als Start oder nächster Punkt übernehmen. |
| **Unterwegs** | Standort, Route folgen (Rest in km, Restzeit, noch bergauf, Ankunft, Warnung mit Vibration, wenn man mehr als 50 m abseits ist), Aufzeichnen und als Tour speichern. Hält den Bildschirm wach. |
| **Touren** | speichern im Browser, öffnen, löschen (zweimal tippen), GPX herunterladen und öffnen, alle als GPX sichern, Link teilen. |
| **Karten** | OpenTopoMap (topografisch) oder Stadtplan (OpenStreetMap Standard), darüber markierte Wanderwege, Radrouten (Waymarked Trails) oder die Sehenswürdigkeiten, die Gipfel & Gasse selbst aus OSM-Daten zeichnet. |

Eine offene Planung übersteht das Neuladen der Seite, samt berechneter Abschnitte (es wird nichts neu angefragt).
Bei einer Rundtour zieht das Verschieben des Starts das Ziel mit.

## Starten

`dist/Gipfel-und-Gasse.html` im Browser öffnen, mit Internetverbindung (Karten, Routen, Suche, Wetter kommen aus dem Netz).
Am besten über `https://` ausliefern statt als Datei: Der OpenStreetMap-Kartendienst verlangt eine Herkunftsangabe
(Referer), die ein Browser bei `file://` nicht schickt, und GPS braucht auf dem Telefon eine sichere Adresse.
Als Artifact auf claude.ai geht es nicht: Dort sind fremde Kacheln, Anfragen an andere Server und GPS gesperrt.

## Bauen

```bash
sh build.sh
```

- `dist/Gipfel-und-Gasse.html`: fertige Datei mit Leaflet, Offline-Bündel, Gestaltung und App-Code (Offline-Bündel nur nach `npm ci` im Hauptordner).
- `dist/check.js`: nur der App-Code, für die Syntaxprüfung.

`sh pruefen.sh` baut, prüft die Syntax und rechnet die Einheitstests. Genau das läuft bei jedem Pull Request auf GitHub.

Klicktest `node test/ui.js` (nicht in GitHub Actions): braucht `npx playwright install chromium-headless-shell` und für
den Teil mit den Offline-Karten `python3` mit `pmtiles mapbox-vector-tile pillow` (`test/testkarten.py`); ohne sie
bricht er dort ab, alles davor ist gelaufen. Fallen beim Schreiben neuer Schritte:
- Marker und Fenster von Leaflet per `page.evaluate(() => element.click())` auslösen, nicht mit `page.click`: die Karte
  bewegt sich nach dem Einpassen noch, Playwright wartet dann auf „stabil“ bis zur Zeitüberschreitung.
- Nach einer Änderung auf das Ergebnis warten (`waitForFunction`), nicht sofort lesen.
- Testdaten (Touren, Reisen), die spätere Schritte nicht erwarten, am Ende des Schritts wieder entfernen.

## Aufbau

| Datei/Ordner | Inhalt |
|---|---|
| `src/logo.svg` | Logo: Abzeichen mit Gipfel, Altstadtgiebel und Zwiebelturm, eine gestrichelte Route führt von der Gasse auf den Gipfel. `build.sh` setzt es in den Kopf; der Druck nimmt es oben rechts mit. |
| `src/symbol.svg` | vereinfachte Fassung für das Browser-Symbol (16 bis 32 px): Berg, Zwiebelturm, roter Gipfelpunkt |
| `src/head.html` | Gestaltung (CSS); unter 760 px Breite wird die Seitenleiste zum Blatt unten |
| `src/body.html` | Gerüst: Karte, Suche, Kartenknöpfe, Reiter Planen, Entdecken, Unterwegs, Touren, Info |
| `src/00-rechnen.js` | reine Rechnungen ohne DOM und Netz: Abstand, Höhenmeter mit Schwelle, Gehzeit DIN 33466, Fahrzeit, SAC-Skala, Wegtyp und Untergrund aus OSM-Merkmalen, Kinderwagen-Urteil, BRouter-Antwort lesen, Strecke auswerten, Position auf der Strecke, GPX lesen und schreiben, Teilen-Link, Overpass-Abfrage und Orte, Wettercodes, Höhendaten (Terrarium, Schummerung, Höhenlinien), Abbiegehinweise und Übergänge an Zwischenzielen |
| `src/10-dienste.js` | Anfragen an BRouter (in der App zuerst offline, sonst brouter.de mit Abbiegehinweisen), Photon, Overpass, Open-Meteo; Profile (Wandern → `hiking-mountain`, Fahrrad → `trekking`, kürzester Weg → `shortest`) |
| `src/20-karte.js` | Karte, Kartenarten, Meldungen, Speicher im Browser |
| `src/30-planen.js` | Wegpunkte, Teilstücke (zwischengespeichert, damit Ziehen nur das betroffene Stück neu anfragt), Route zeichnen, Kennzahlen, Hervorhebung |
| `src/40-profil.js` | Höhenprofil auf Canvas |
| `src/50-entdecken.js` | Suche, Orte entlang der Route, Wetter (Ort wählbar), Öffnungszeiten jetzt, Wikipedia-Kurzinfo und Vorlesen, Link zu Google Maps, drinnen bei Regen |
| `src/52-info.js` | Info-Modus: Antippen zeigt, was dort ist (Kartenpaket und Overpass); Fenster nicht hinter Blatt und Suche |
| `src/55-stadt.js` | Umschalter Berg/Stadt, Sehenswürdigkeiten im Ausschnitt (Overpass), Stopps, Rundgang vorschlagen |
| `src/57-drucken.js` | Druckansicht A4: Kopf, Karte, Höhenprofil |
| `src/58-offline.js` | in der App: Offline-Karte, Höhenlinien und Relief, Höhen ohne Netz, Routen ohne Netz, Orte und Suche aus der Orte-Datei des Pakets, Paketverwaltung, „Offline-Karte prüfen“; liest die Pakete in Teilen über `?von=&bis=` (im Browser ohne Wirkung) |
| `src/60-touren.js` | Touren speichern und öffnen, GPX, Teilen-Link, Sicherung |
| `src/65-tagebuch.js` | Reisetagebuch: Reisen, Einträge mit Fotos, Ort und Wetter, Heft (PDF) |
| `src/67-ziele.js` | Reiseziele: Listen, ⭐-Ebene, eintippen, Liste einfügen, Datei laden (Text, CSV, GPX, KML, GeoJSON), als GPX |
| `src/70-unterwegs.js` | GPS, Route folgen, Aufzeichnen, Bildschirm wach halten |
| `src/75-app.js` | in der App: Route folgen und Aufzeichnen über den Navigationsdienst, GPX über Teilen, Drucken über Android |
| `src/80-start.js` | Reiter, Blatt unten, Entwurf und Link beim Start |
| `vendor/leaflet/` | Leaflet 1.9.4 (unverändert aus npm) |
| `test/syntax.js` | prüft die Skripte in der fertigen HTML-Datei |
| `test/einheit.js` | Einheitstests der Rechnungen (Node, ohne Browser) |
| `test/ui.js` | Klicktest mit Playwright und Chromium; bildet die Dienste nach (siehe dort), Bildschirmfotos nach `test/out/` |

## Wie gerechnet wird

- **Gehzeit (DIN 33466):** 4 km/h in der Ebene, 300 Hm/h bergauf, 500 Hm/h bergab; die größere der beiden Zeiten plus die
  Hälfte der kleineren. Ohne Pausen. Tempo teilt die Zeit (mit Kind: 0,7, also rund 40 % länger).
- **Fahrzeit Rad:** grob 16 km/h plus 600 Hm/h bergauf.
- **Höhenmeter:** gezählt wird erst ab 5 m Änderung, damit das Rauschen des Höhenmodells nicht mitzählt.
- **Schwierigkeit:** höchste SAC-Stufe (`sac_scale`) auf der Route. Fehlt das Merkmal, steht „–“; das heißt nicht „leicht“.
- **Untergrund ohne `surface`:** nur bei Straßen (befestigt) und Forstwegen mit `tracktype` erschlossen, sonst „unbekannt“.
- **Rundgang:** Reihenfolge nach Luftlinie, erst „nächster Nachbar“, dann 2-opt (Teilstücke umdrehen, solange die Runde
  kürzer wird). Für bis zu zehn Orte reicht das; die Wege selbst rechnet danach BRouter.
- **Besichtigungszeit:** Vorschlag je Art (Museum 60, Sehenswürdigkeit 20, bekannte 30, Park 20, Aussicht 15, Kunst 5 min).
- **Abseits der Route:** mehr als 50 m (oder 1,5 × GPS-Ungenauigkeit) für mindestens 15 Sekunden.

## Grenzen

- **Im Browser keine Offline-Karten.** Die Nutzungsregeln von OpenStreetMap und OpenTopoMap verbieten das
  Massen-Herunterladen von Kacheln. Ohne Netz: die Android-App mit Kartenpaket, oder die GPX-Datei in eine andere App.
- **Im Browser GPS nur bei eingeschaltetem Bildschirm** und ohne Sprach- und Abbiegeansagen; das kann nur die Android-App.
- **Touren nur in diesem Browser**, kein Abgleich zwischen Geräten.
- **Freie Dienste mit Fair-Use-Regeln:** für eine Familie unproblematisch, für viele Nutzer bräuchte es eigene Server
  (BRouter und Kacheln lassen sich selbst betreiben).

## Fremde Inhalte und Lizenzen

- **Leaflet** 1.9.4, BSD-2-Clause, © Volodymyr Agafonkin und CloudMade; Lizenz in `vendor/leaflet/LICENSE`. In die fertige Datei eingebettet.
- **Kartendaten** © OpenStreetMap-Mitwirkende, Open Database License (ODbL). Hinweis steht auf der Karte und in exportierten GPX-Dateien.
- **Kacheln:** OpenTopoMap (CC-BY-SA, Höhen SRTM), OpenStreetMap Standard, Waymarked Trails (CC-BY-SA). Werden beim Ansehen geladen, nicht mitgeliefert.
- **Dienste:** BRouter (Routen), Photon (Suche, betrieben von komoot), Overpass API (Orte), Open-Meteo (Wetter und Höhen, CC-BY 4.0). Werden nur auf Handlung hin angefragt.
- Alles andere (Code, Gestaltung, Logo und Symbol) ist selbst gemacht.
