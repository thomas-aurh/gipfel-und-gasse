# Gipfel & Gasse: Stand

Was Gipfel & Gasse kann, steht im [README](README.md) und in [`web/README.md`](web/README.md). Hier steht, was offen ist, warum es so gebaut ist und wohin es ausgeliefert wird.
Gepflegt beim Session-Abschluss (Skill `projekt-abschluss`).

## Offen

- **Android-App (Stufen 1–5) gebaut, auf dem Pixel nicht geprüft.** Bis zur Korrektur in #5 lief die Anbindung an
  Android auf dem Handy gar nicht (Capacitor-Kern fehlte, Routen nur als gerade Linie). Von Thomas am 01.11. auf dem
  Pixel geprüft (Verona, neue APK): Route über Wege (online) und Standort auf der Karte. Offen bleibt der Rest unten. Geprüft in GitHub Actions: Bau, Java-Tests,
  Probe-Rendering der echten Oberbayern-Karte, Probe-Routen auf den echten Routendaten; lokal in der Cloud-Session:
  Oberfläche im Klicktest (`web/test/ui.js`, nicht in GitHub Actions) mit nachgebildeten Diensten. Nicht geprüft, weil kein Gerät in der Cloud: Installation und Erlaubnisse, GPS und Ansagen
  bei gesperrtem Bildschirm, Akkuverbrauch, Download der Pakete, Tempo von Vektorkarte und Offline-Routing, Teilen und
  Drucken. Nächster Schritt: APK von der Download-Seite installieren, unter Touren › Offline-Karten „Oberbayern“ laden
  und eine kurze Runde gehen (Ansage alle 1 km, Abseits-Warnung durch Abweichen, Abbiegeansage).
- **Umplanen unterwegs (#14) nicht auf dem Handy geprüft:** geprüft sind die Rechnung (Java-Tests `UmplanenTest`, in
  GitHub Actions) und die Anzeige in der App (Klicktest mit nachgebildetem Dienst). Ungeprüft: echtes Abweichen mit
  gesperrtem Bildschirm, Rechenzeit offline auf dem Pixel, Abruf bei brouter.de aus dem Dienst. Im Browser wird nicht
  umgeplant (dort nur die Abseits-Warnung).
- **Pfeil in Blickrichtung (#15) nicht auf dem Handy geprüft:** Kompass im WebView der App und Querformat nur im
  Klicktest nachgebildet. Der neue Schritt „Download-Seite erneuern“ läuft erst beim ersten Bau auf `main` (danach
  prüfen: Link liefert die APK, Titel nennt den neuen Bau).
- **Laufen (#17) nicht auf dem Handy geprüft:** Kilometer-Ansage aus dem Dienst bei gesperrtem Bildschirm, Genauigkeit
  der Zeit je km bei schwachem GPS. Routen fürs Laufen nutzen das Wanderprofil von BRouter (eigenes Laufprofil fehlt).
- **Reisetagebuch (#16) nicht auf dem Handy geprüft:** Kamera und Galerie aus der App (Dateiauswahl im WebView),
  Größe der Sicherung mit vielen Fotos. Fotos liegen im Speicher der App (IndexedDB): wer die App deinstalliert, löscht
  sie mit, darum vorher „Sicherung speichern“.
- **Fester Signierschlüssel fehlt:** bis er als Repo-Geheimnis (`KEYSTORE_B64`, `KEYSTORE_PASSWORT`) hinterlegt ist,
  signiert GitHub mit einem Ersatzschlüssel aus dem Cache. Wird der Cache geräumt (nach 7 Tagen ohne Bau), passt das
  nächste Update nicht mehr über die alte App: dann deinstallieren und neu installieren, gespeicherte Touren gehen dabei
  verloren (vorher „Sicherung speichern“, danach „Sicherung laden“).
- **Stufe 5 (Orte und Suche ohne Netz) gebaut:** geprüft mit Testdaten (Einheitstests, Klicktest) und im Ablauf
  „Kartenpakete“ mit den echten Orten (Probe-Suche Zugspitze, Marienplatz u. a.). Nicht geprüft: Ladezeit und Speicher
  der Orte-Datei auf dem Handy. Die Datei kommt erst mit dem nächsten Lauf „Kartenpakete“ nach dem Merge ins Paket.
- **Emulator-Test in GitHub Actions** fehlt (App startet, Dienst startet mit vorgegebener Position).
- **Web mit den echten Diensten nicht geprüft:** die Cloud-Umgebung sperrt brouter.de, die Kachelserver, Photon,
  Overpass und Open-Meteo. Offen: CORS bei BRouter aus dem Browser, `WayTags` mit `sac_scale` und `surface`, Kacheln
  bei `file://`. Nächster Schritt: `web/dist/Gipfel-und-Gasse.html` am PC in Chrome öffnen, Tour um Penzberg planen.
- **Stadt nicht mit echten Daten geprüft:** Fußwege des Profils `hiking-mountain` in der Stadt, Fülle der Karte
  (höchstens 250 Marken), Dauer der Overpass-Abfrage. Nächster Schritt: Rundgang in der Münchner Altstadt planen.
- **Web-App auf dem Telefon nicht geprüft:** GPS, Vibration, Bildschirm wach halten und Teilen-Menü im Browser
  (eigene Wege, nicht die der Android-App); braucht die `https://`-Auslieferung.
- **Aus der Durchsicht vom 01.11., noch nicht gebaut:** Stopps von Hand umsortieren; Wetter je Stunde
  und am Gipfel; Blickrichtung des Standorts; Tourliste sortieren und filtern; Berg/Stadt und „Art“ zusammenführen.
- **Routendaten doppelt auf dem Handy:** Oberbayern und Allgäu bringen beide die Kachel E10_N45 (190 MB) mit; jede
  Region hat ihre eigene Kopie.
- **Web-Auslieferung wartet auf Thomas' Wahl** (siehe Auslieferung).
- **Ideen, nicht gebaut:** Fotos und Notizen an Punkten der Tour; Familien-Filter (unter X km und Y Hm, Spielplatz
  oder Einkehr auf halber Strecke); eigene zugeschnittene Routendaten (kleineres Paket).

## Entscheidungen

- **Name Gipfel & Gasse und eigenes Logo** (01.11.): Thomas' Wahl, weil die App seit dem Stadtmodus Berg und Stadt
  kann. Logo als rundes Abzeichen (Gipfel, Giebel, Zwiebelturm, Route), dazu ein vereinfachtes Symbol für kleine
  Größen. Frühere Namen Wegwerk und Murmel; deren gespeicherte Touren übernimmt die App einmalig. Verworfen: Stadt Land
  Pfad, Kundschafter, Spürnase, Kartograf, Fährte u. a.; Bergzeit und Bergfex sind bereits Marken.
- **Dunkelmodus über Farbvariablen** (02.11.): folgt dem System, im Menü fest auf hell oder dunkel stellbar; Kartenbild
  nachts per Filter abgedunkelt statt eigener dunkler Kartenstile (offline-tauglich, keine weiteren Pakete).
- **Umplanen zum nächsten Ziel, im Navigationsdienst** (02.11., Thomas' Wahl): länger als 15 s abseits ⇒ ab dem
  Standort neu zum nächsten offenen Ziel, danach wie geplant; ohne Netz mit den Routendaten der Pakete, sonst
  brouter.de; höchstens ein Versuch je Minute. Im Dienst statt in der Oberfläche, damit es bei gesperrtem Bildschirm
  läuft. Verworfen: zurück auf die Route (führt zurück, auch wenn ein Parallelweg passt), erst fragen.
- **Laufen mit Leistungs-Kilometern** (02.11., Thomas' Wahl: Lauf-Profil mit Pace, Kilometer-Ansagen): Zeit =
  (km + Hm/100) × Lauftempo, wie die Leistungs-km im Trailrunning (ITRA). Zurückgestellt: Auto-Pause, Rundkurs mit
  Wunschlänge.
- **Reisetagebuch** (02.11., Thomas' Wahl aus Vorbild Polarsteps/Day One): Reisen mit Zeitraum, Einträge mit Text und
  Fotos, Ort, Uhrzeit und Wetter automatisch; Fotos auf 1600 px verkleinert in IndexedDB, in der Sicherung als
  Daten-Adresse. Zurückgestellt: Einträge auf der Karte, Heft zum Drucken.
- **Navigation: Menü links oben plus Leiste unten** (02.11., Thomas' Wahl nach Vorbild gängiger Tourenplaner): jede
  Funktion eine eigene Seite, die vier häufigsten mit einem Tipp erreichbar; geplante und gegangene Touren getrennt.
  Verworfen: nur Menü (ein Tipp mehr für Planen und Unterwegs), Reiter im Blatt (wirkte überladen).
- **Orte und Suche ohne Netz aus einer Datei je Paket** (01.11.): `orte.json.gz` mit derselben Auswahl wie die
  Overpass-Abfragen der App und einer Suchliste (Orte, Gipfel, Seen, Straßen, benannte Orte), gebaut aus den
  OSM-Auszügen Bayern und Österreich von Geofabrik (zusammen decken sie die Region). Mit Paket gehen Orte und Stadt
  immer offline (schnell, schont Overpass), die Suche mischt Paket und Photon. Verworfen: Orte aus den Vektorkacheln
  (zu wenige Merkmale), Overpass im Bau (zu große Abfrage für einen freien Dienst), SQLite-Suche nativ (mehr Code, für
  eine Region unnötig).
- **Offline-Routing mit BRouter in der App** (01.11.): dieselbe Engine und dieselben Profile wie online, deshalb gleiche
  Routen und gleiche Antwort (GeoJSON samt Abbiegehinweisen), die Oberfläche bleibt unverändert. Quellen in fester Fassung
  beim Bau geholt (nicht im Repo), Routendaten als fertige 5°-Kacheln von brouter.de im Paket. Verworfen: GraphHopper
  (andere Profile und Daten), eigene zugeschnittene Routendaten (später möglich, spart Platz, aber aufwendiger Bau).
- **Offline-Karten als PMTiles mit eigenem Datei-Server** (01.11.): je Region eine Vektorkarte (Protomaps-Weltdatensatz,
  zugeschnitten) und ein Höhen-Paket (Terrarium-Kacheln bis Zoom 12), gezeichnet in Leaflet (protomaps-leaflet,
  Höhenlinien und Relief selbst gerechnet), damit die Oberfläche bleibt. Ein eigener Java-Server liefert Byte-Bereiche,
  weil Capacitors lokaler Server Bereiche falsch ausliefert und bei 2 GB endet. Download über den Download-Manager von
  Android (läuft im Hintergrund weiter), standardmäßig nur im WLAN, mit SHA-256-Prüfung. Verworfen: Rasterkacheln von
  OpenTopoMap herunterladen (verboten), MapLibre statt Leaflet (Oberfläche neu), Kacheln einzeln als Dateien (zu viele).
- **Android als Hybrid-App, APK selbst installieren, Kartenpakete aus öffentlichem Repo** (01.11., Thomas' Wahl):
  Nur eine native App darf bei gesperrtem Bildschirm GPS nutzen und offline Karten zeichnen. Hybrid (Capacitor) behält
  die Web-Oberfläche, nativ werden nur Hintergrund-GPS, Ansagen, Routing und Pakete. Gebaut in GitHub Actions, weil die
  Cloud-Umgebung Android-Werkzeuge und Kartenquellen sperrt. Verworfen: komplett nativ (Oberfläche doppelt),
  Play Store (Konto, Prüfung, Datenschutzerklärung), Pakete per Kabel (jedes Update Handarbeit).
- **Stadtmodus in derselben App** (01.11.): ein Umschalter statt zweier Apps; Planung, Profil, Touren und GPX sind
  gleich, nur Karte, Orte und Stopps unterscheiden sich. Sehenswürdigkeiten zeichnet die App selbst aus OSM-Daten
  (Overpass), weil es keine freie Sightseeing-Kartenquelle ohne Schlüssel gibt. „Bekannt“ heißt: mit Wikipedia- oder
  Wikidata-Eintrag. Verworfen: Carto-Kacheln (Nutzungsgrenzen), eigene Beliebtheitswerte (keine freie Quelle).
- **Drucken statt Karten-Export als Bild** (01.11.): der Druckdialog des Browsers kann PDF, Kacheln bleiben scharf.
- **Eigene App statt Nachbau von komoot** (01.11.): Funktionen wie bei Tourenplanern üblich, aber eigener Name, eigene
  Gestaltung, eigener Code.
- **Eine HTML-Datei ohne eigenen Server** (01.11.): wie das Tafelwerk; Leaflet eingebettet. Routen, Suche, Orte und
  Wetter kommen von freien Diensten (BRouter, Photon, Overpass, Open-Meteo), nur auf Handlung hin. Verworfen: eigener
  Routing-Server (zu viel Betrieb für eine Familie), GraphHopper und openrouteservice (brauchen API-Schlüssel, der im
  Browser offen läge).
- **BRouter als Routendienst** (01.11.): frei, ohne Schlüssel, Wanderprofil mit Bergwegen, liefert Höhen und die
  OSM-Merkmale je Abschnitt; daraus entstehen Wegtypen, Untergrund, SAC-Stufe und das Kinderwagen-Urteil ohne zweiten Dienst.
- **Gehzeit nach DIN 33466** (01.11.): dieselbe Formel wie die Wegweiser der Alpenvereine; Tempo „mit Kind“ als Faktor 0,7.
- **Kein Artifact auf claude.ai** (01.11.): dort sind fremde Bilder, Anfragen an andere Server und GPS gesperrt.

## Auslieferung

- **Android:** Merge auf `main` ⇒ GitHub Actions (`app.yml`) baut und ersetzt die Download-Seite
  https://github.com/thomas-aurh/gipfel-und-gasse/releases/latest (Datei `Gipfel-und-Gasse.apk`).
- **Kartenpakete:** Ablauf „Kartenpakete“ (`kartenpakete.yml`), monatlich am 3. und von Hand (Actions › Kartenpakete ›
  Run workflow); legt Karte, Höhen und Routendaten samt `pakete.json` in den Release `kartenpakete`, die Größen stehen
  dort und in der App-Liste. Die App holt die Liste von dort.
- **Web:** `sh web/pruefen.sh` baut `web/dist/Gipfel-und-Gasse.html` (dazu `node web/test/ui.js`). Wohin, ist offen:
  Datei am PC in Chrome öffnen (reicht zum Planen) oder eine `https://`-Adresse fürs Telefon, jetzt ohne Kosten über
  GitHub Pages aus diesem öffentlichen Repo möglich.

## Erledigt

- **02.11.** Ablauf „Kartenpakete“ bei Pull Requests, die nur die App betreffen: prüft die veröffentlichten Pakete statt
  neu zu bauen (Minuten statt einer halben Stunde) (#11).

- **01.11.** Eigenes öffentliches Repo (Code aus other-projects umgezogen) und Android-App in vier Stufen:
  Capacitor-Gerüst mit Bau und Download über GitHub Actions (#1); Vordergrunddienst mit GPS bei gesperrtem Bildschirm,
  Ansagen, Abseits-Warnung, Aufzeichnung, GPX teilen, Drucken (#1); Offline-Karten als Pakete je Region mit
  Paketverwaltung, eigenem Datei-Server, Höhenlinien und Relief (#2); Offline-Routing mit BRouter und
  Abbiegeansagen (#3). Kartenpakete für Oberbayern im Release `kartenpakete`. Copilot-Hinweise zu #1–#3 behoben.
  Danach: Capacitor-Kern eingebaut, ohne ihn liefen die Android-Funktionen auf dem Handy nicht (#5, Fehlerbild aus
  Verona); Stufe 5 Orte und Suche ohne Netz (#6); Touren als Punkte auf der Karte, Zwischenziele aus der Suche,
  Paket-Update nur für geänderte Dateien, Offline-Karte außerhalb des Pakets topografisch (#7); Durchsicht: Sicherung
  aller Touren als eine Datei, Aktionsleiste oben in Planen, Zurück-Taste, Kartenpakete aus der Kartenwahl, Region
  Allgäu und Bodensee, kleinere Fehler (#8); Zeitplan mit Startzeit, Pausen und Sonnenuntergang (ohne Netz gerechnet),
  Notfall in Unterwegs (Koordinaten, Standort senden, 112); Aktionsleiste am Telefon mit „Mehr“ statt seitlich
  wischbar (Funktionen waren unsichtbar), Blatt nach der ersten Route halb offen (#9); Navigation neu: Menü ☰ links oben
  mit allen Seiten, Leiste unten mit Karte, Planen, Unterwegs, Touren; Touren getrennt in Geplant und Gegangen (mit
  Statistik); Offline-Karten, Notfall, Sicherung als eigene Seiten (#10).
- **02.11.** Aufgeräumt und neu gestaltet: Hinweise gekürzt, Bedienung unter Info, Zwischenpunkt-Tipp verschwindet nach
  der ersten Nutzung; Dunkelmodus (automatisch, hell, dunkel im Menü, Karte nachts gedimmt); Karten mit Schatten,
  Listen als Kacheln, aktive Leiste hervorgehoben (#12).
  Kartenpakete: App-PRs prüfen die veröffentlichten Pakete statt neu zu bauen (#11). Fadenkreuz zum genauen Setzen
  von Punkten, Koordinaten und Abstand zum letzten Punkt (#13).
  Automatisches Umplanen beim Navigieren zum nächsten Ziel, neue Strecke blau auf der Karte (#14).
  Standortpunkt mit Pfeil in Blickrichtung (Kompass, beim Gehen GPS-Richtung); Download-Link bleibt beim Bau
  erreichbar (APK wird ersetzt statt die Seite neu anzulegen) (#15).
  Laufen: Art „Laufen“ mit Lauftempo (min/km, 100 Hm wie 1 km), Ø Tempo und Kilometer-Ansage beim Aufzeichnen (#17).
  Reisetagebuch als Menüpunkt: Reisen mit Zeitraum, Einträge mit Text und Fotos, Ort und Wetter von selbst, gegangene
  Touren der Reise; Fotos kommen mit in die Sicherung (#16).

- **01.11.** Hinweise aus dem Copilot-Review zu #5 behoben: Restaufstieg ab der aktuellen Stelle, GPX-Abschnitte und
  Zeitstempel bleiben erhalten, GPX-Import ersetzt keine geöffnete Tour, Tempo der Tour wird wiederhergestellt,
  Speichern während der Berechnung gesperrt, Reihenfolge für offene Touren ohne Rückweg, Zeitlimit bis der Inhalt
  gelesen ist, späte Such- und Overpass-Antworten verworfen, Ziel nur nahe der Route, Rückgängig nach Link samt Wegewahl,
  Leaflet-Lizenztext in der Datei, Tastaturbedienung für Tour öffnen und GPX öffnen.

- **01.11.** Umbenannt in Gipfel & Gasse, eigenes Logo und Browser-Symbol, Logo im Druck; Touren aus Murmel und Wegwerk
  werden übernommen.

- **01.11.** Stadtmodus: Umschalter Berg/Stadt, Sehenswürdigkeiten im Ausschnitt mit ⭐ für bekannte, Stopps mit
  Besichtigungszeit (in Gesamt- und Restzeit), Rundgang vorschlagen, Reihenfolge optimieren, Karte drucken (A4/PDF);
  höchstens drei BRouter-Anfragen gleichzeitig; Prüfung prüft jetzt auch die fertige HTML-Datei.

- **01.11.** Durchsicht: Rundtour-Start zieht das Ziel mit; Rückgängig bei geöffneter GPX-Spur gesperrt (vorher
  gemischte Anzeige); laufende Berechnung überschreibt keine frisch geöffnete Tour mehr; gleiche Abschnitte werden nicht
  doppelt angefragt; Entwurf speichert die berechneten Stücke (Neuladen ohne neue Anfragen); geteilter Link verdrängt
  die eigene Planung nicht spurlos; Restzeit beim Rad mit Rad-Formel; GPS-Verweigerung beendet Folgen und Aufzeichnen;
  Aufzeichnungsdauer minutengenau; Profil am Telefon scrollbar; Overpass-Obergrenze 1500. Umbenannt in Gipfel & Gasse.

- **01.11.** Gipfel & Gasse angelegt: Planen mit BRouter, Höhenprofil, Gehzeit, Wegtypen und Untergrund, Kinderwagen-Urteil,
  Orte entlang der Route, Wetter, Suche, Touren und GPX, Teilen-Link, Route folgen und Aufzeichnen; Einheitstests und
  Klicktest.
