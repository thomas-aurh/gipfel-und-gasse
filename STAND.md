# Gipfel & Gasse: Stand

Was Gipfel & Gasse kann, steht im [README](README.md) und in [`web/README.md`](web/README.md). Hier steht, was offen ist, warum es so gebaut ist und wohin es ausgeliefert wird.
Gepflegt beim Session-Abschluss (Skill `projekt-abschluss`).

## Offen

- **Android-App, Stufen 1 und 2 gebaut, auf dem Pixel nicht geprüft:** Installation, Erlaubnisse, GPS und Ansagen bei
  gesperrtem Bildschirm, Akkuverbrauch, Teilen und Drucken. Nächster Schritt: APK von der Download-Seite installieren
  und eine kurze Runde gehen (Ansage alle 1 km, Abseits-Warnung durch Abweichen testen).
- **Fester Signierschlüssel fehlt:** bis er als Repo-Geheimnis (`KEYSTORE_B64`, `KEYSTORE_PASSWORT`) hinterlegt ist,
  signiert GitHub mit einem Debug-Schlüssel aus dem Cache. Wird der Cache geräumt (nach 7 Tagen ohne Bau), passt das
  nächste Update nicht mehr über die alte App: dann deinstallieren und neu installieren, gespeicherte Touren gehen dabei
  verloren (vorher „Alle sichern“).
- **Weitere Stufen der App** (in dieser Reihenfolge):
  3. **Offline-Karten:** Kartenpakete je Region (Vektorkacheln aus OSM, Höhenlinien und Schummerung aus freien
     Höhendaten), gebaut in GitHub Actions, als Download in diesem Repo; Paketverwaltung in der App.
  4. **Offline-Routing:** BRouter-Kern als Bibliothek in der App, Routendaten je 5°-Kachel; Abbiegehinweise für Ansagen.
  5. **Offline-Orte und -Suche:** Sehenswürdigkeiten, Hütten, Wasser, Haltestellen je Region aus OSM.
- **Emulator-Test in GitHub Actions** fehlt noch (App startet, Dienst startet mit vorgegebener Position).

- **Nicht geprüft mit den echten Diensten:** Die Cloud-Umgebung der ersten Session sperrt brouter.de, die Kachelserver,
  photon.komoot.io, overpass-api.de und open-meteo.com (Proxy 403). Geprüft sind die Rechnungen (Einheitstests) und alle
  Abläufe im Browser mit nachgebildeten Antworten im gleichen Format (`test/ui.js`). Offen ist also: ob BRouter die
  Anfrage aus dem Browser erlaubt (CORS), ob seine `WayTags` wie erwartet `sac_scale` und `surface` enthalten, ob die
  Kacheln bei `file://` laden. Nächster Schritt: `web/dist/Gipfel-und-Gasse.html` am PC in Chrome öffnen und eine Tour um Penzberg planen.
- **Stadt nicht mit echten Daten geprüft:** ob das BRouter-Profil `hiking-mountain` in der Stadt gute Fußwege wählt
  (es meidet große Straßen, bevorzugt Fußwege und Parks), wie voll die Karte in einer Großstadt wird (höchstens 250
  Marken) und wie lange Overpass für einen Stadtausschnitt braucht. Nächster Schritt: Rundgang in München-Altstadt planen.
- **Nicht geprüft auf dem Telefon:** GPS, Vibration, Bildschirm wach halten, Teilen-Menü.
- **Auslieferung wartet auf Thomas' Wahl** (siehe Auslieferung): Datei auf dem PC oder über eine `https://`-Adresse.
- **Ideen, nicht gebaut** (wartet auf Thomas' Wahl):
  - Als App installierbar (Manifest und Service Worker; braucht die `https://`-Auslieferung).
  - Offline-Karte für einen kleinen Ausschnitt aus einer eigenen Kachelquelle (die Nutzungsregeln von OSM und OpenTopoMap
    erlauben kein Massen-Herunterladen).
  - Fotos und Notizen an Punkten der Tour, Höhepunkte.
  - Familien-Filter: nur Touren unter X km und Y Hm, Spielplatz oder Einkehr auf halber Strecke.

## Entscheidungen

- **Name Gipfel & Gasse und eigenes Logo** (01.11.): Thomas' Wahl, weil die App seit dem Stadtmodus Berg und Stadt
  kann. Logo als rundes Abzeichen (Gipfel, Giebel, Zwiebelturm, Route), dazu ein vereinfachtes Symbol für kleine
  Größen. Frühere Namen Wegwerk und Murmel; deren gespeicherte Touren übernimmt die App einmalig. Verworfen: Stadt Land
  Pfad, Kundschafter, Spürnase, Kartograf, Fährte u. a.; Bergzeit und Bergfex sind bereits Marken.
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
- **Keine Offline-Kacheln** (01.11.): verboten nach den Nutzungsregeln der Kachelserver. Ersatz: GPX-Export.
- **Kein Artifact auf claude.ai** (01.11.): dort sind fremde Bilder, Anfragen an andere Server und GPS gesperrt.

## Auslieferung

- **Android:** Merge auf `main` ⇒ GitHub Actions baut und ersetzt die Download-Seite
  https://github.com/thomas-aurh/gipfel-und-gasse/releases/latest (Datei `Gipfel-und-Gasse.apk`).
- **Web:** wie unten.

1. `sh web/pruefen.sh` (baut `web/dist/Gipfel-und-Gasse.html`), dazu `node web/test/ui.js` für den Klicktest.
2. Noch nicht festgelegt. Möglich:
   - **Datei auf dem PC:** `web/dist/Gipfel-und-Gasse.html` in Chrome öffnen. Zum Planen am PC reicht das; die Kacheln von
     OpenStreetMap Standard können ohne Referer gesperrt sein, OpenTopoMap ist voreingestellt.
   - **`https://`-Adresse** für das Telefon (GPS, Teilen-Links): z. B. GitHub Pages aus einem eigenen öffentlichen Repo
     oder Cloudflare Pages. Das Repo other-projects ist privat; Pages aus einem privaten Repo braucht ein bezahltes Konto.

## Erledigt

- **01.11.** Eigenes öffentliches Repo; Android-App Stufe 1 (Capacitor-Gerüst, App-Symbol und Startbild aus dem Logo,
  Bau und Download über GitHub Actions) und Stufe 2 (Vordergrunddienst mit GPS bei gesperrtem Bildschirm, Rest,
  Abseits-Warnung mit Vibration, Ansagen jeden Kilometer, Stopps und Ziel, Aufzeichnung mit Sicherung, Mitteilung mit
  „Beenden“, GPX über Teilen-Menü, Drucken über Android). Java-Tests für die Formeln, Klicktest der App-Anbindung.

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
