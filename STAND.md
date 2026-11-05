# Gipfel & Gasse: Stand

Was Gipfel & Gasse kann, steht im [README](README.md) und in [`web/README.md`](web/README.md). Hier steht, was offen ist, warum es so gebaut ist und wohin es ausgeliefert wird.
Gepflegt beim Session-Abschluss (Skill `projekt-abschluss`).

## Offen

- **Bescheid geben (05.11.) nur im Klicktest geprüft:** Teilen-Menü der App mit dem langen Text, ob WhatsApp den Link
  anzeigt. Die Erinnerung kommt nur beim Öffnen der App oder alle 60 s, solange sie offen ist; eine Mitteilung bei
  geschlossener App bräuchte eine Erinnerung im Navigationsdienst oder ein Plugin für lokale Mitteilungen.

- **Umbau für mehr Übersicht (04.11.):** Schritt 1 (Planen in Reitern, Bau 203) auf dem Pixel installiert; Schritt 2
  (Mehrtagestour mit Schalter, Teilung nach Gehzeit, Liste nach Tagen, Farbe je Tag, Tag-Knöpfe unterwegs) gebaut, nur im
  Klicktest geprüft. Offen aus Schritt 2: Tag-Chips im Blatt (nur diesen Tag zeigen); Hütte und Tageszahl (05.11.) nur im
  Klicktest geprüft (echte Overpass-Antworten, ob 2 km und die Reihenfolge Hütte vor Hotel passen; ohne Netz keine Suche). Die von der App gesetzten Punkte merkt sie sich nur bis zum Speichern als
  „automatisch“ (danach gelten sie als eigene Punkte und bleiben bei „1 Tag“). Schritt 3: Begriffe (Start, Stopp, Ziel, Übernachtung), Warnung ohne Startzeit neutral, Kartennachweis
  kompakt (Attribution Guidelines der OSMF prüfen), Meldungen über dem Blatt mit Rückgängig, Unterwegs vor dem Start als
  Tourkarte mit großem „▶ Los“. Offen auch: Berg/Stadt-Umschalter und Punktliste mit Ziehen statt ▲▼.

- **Fotos unter „Ich“ (04.11.) nur im Klicktest geprüft:** Wischen im WebView, Ladezeit bei vielen Fotos (jedes Bild
  wird aus IndexedDB gelesen), Verknüpfung nur über den Tag (ohne Aufzeichnung an dem Tag kein „Zur Tour“).
  „📤 Teilen“ von Thomas am 04.11. auf dem Pixel geprüft (Bau 197).
- **Sicherung als ZIP und Fotos auf der Tourkarte (04.11.) nur im Klicktest geprüft:** auf dem Pixel offen: Sicherung
  mit vielen Fotos (Dauer, Speicher, Stücke über `NaviPlugin.dateiStueck`), Laden der ZIP aus Drive im WebView (Dateiwahl
  mit `.zip`), ob die Kamera und die Galerie-Auswahl Ort und Zeit in den EXIF-Daten lassen (Android entfernt den Ort ohne
  ACCESS_MEDIA_LOCATION oft), wie gut die Stelle nach der Zeit trifft. Fotos von vor dem 04.11. haben keine Foto-Infos:
  bei ihnen zählt die Zeit des Eintrags.
- **Wanderwege in der Nähe:** auf dem Pixel (Bau 190, 193) scheiterte Overpass (Zeitüberschreitung, Überlast). Seitdem
  erst Waymarked Trails; dessen Antwortformat ist aus dem Quellcode (`wmt_api`) abgelesen, nicht gegen den echten Dienst
  gemessen (aus der Cloud gesperrt). Der Verlauf beim Antippen kommt weiter von Overpass. Offen: Antwortzeit bei 5 und 10 km in den
  Bergen, wie gut sich echte Relationen zu einem Verlauf fügen; ohne Netz nicht verfügbar (nicht im Kartenpaket).
- **GPX laden, Anreise und Parkplätze:** von Thomas am 04.11. auf dem Pixel geprüft (Bau 186): GPX-Import mit Wegpunkten
  (Datei aus komoot) und Parkplätze am Start. Nicht geprüft: mehrere Dateien auf einmal im WebView der App, die Links
  zu Google Maps für Anreise und „🚗 hin“.
- **Familien-Check und Rundgang nach Zeit (04.11.) nur nachgebildet geprüft:** echte Overpass-Antworten zum Mittelstück
  der Route (Spielplatz, Einkehr), ob 250 m neben der Route das Gemeinte trifft; wie gut die Schätzung (Luftlinie × 1,3 bei
  4 km/h) und das Nachmessen die Zeit in einer echten Altstadt treffen. Die Wiederholung im Schritt „Download-Seite
  erneuern“ greift erst beim nächsten 502.
- **Übersicht vom 04.11. auf dem Pixel nur angesehen** (Bau 165 bis 174: Einstiege, Start mit der Karte, Leiste, „Ich“,
  Tourliste). Nicht geprüft: „▶ Los“ auf der Tourseite mit Ansagen und der Balken bei laufender Navigation in der App,
  Klappzeilen mit Route, ▲▼ an den Stopps, Suche in den Tourlisten, Zoom nur mit zwei Fingern.
- **Alte Branches auf GitHub:** `claude/planen-uebersicht` (Stand von #57, versehentlich angelegt) und
  `claude/stand-offline-bestaetigt` (überholt) lassen sich aus der Cloud nicht löschen (403); von Hand löschen.
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
  Klicktest nachgebildet.
- **Laufen (#17) nicht auf dem Handy geprüft:** Kilometer-Ansage aus dem Dienst bei gesperrtem Bildschirm, Genauigkeit
  der Zeit je km bei schwachem GPS. Routen fürs Laufen nutzen das Wanderprofil von BRouter (eigenes Laufprofil fehlt).
- **Reisetagebuch (#16):** von Thomas am 02.11. auf dem Pixel benutzt (Eintrag, Ort, Wetter). „Foto aufnehmen“ öffnete
  die Kamera nicht; nach #18 und #19 am 02.11. von Thomas geprüft: Kamera öffnet, Original liegt in der Galerie.
  Capacitor legt das Kamerafoto zusätzlich im App-Ordner (Android/data/…/Pictures) ab und räumt es nicht weg. Offen:
  Größe der Sicherung mit vielen Fotos. Fotos liegen im Speicher der App (IndexedDB): wer die App deinstalliert, löscht
  sie mit, darum vorher „Sicherung speichern“.
- **Gewitterwarnung (#23) nicht auf dem Handy geprüft:** echter Abruf aus dem Dienst bei gesperrtem Bildschirm und ob
  die Vorhersage (WMO-Code ab 95) zu oft oder zu selten warnt.
- **Auto-Pause und Runde (#22) nicht auf dem Handy geprüft:** ob 10 s an der Ampel im Takt des Dienstes sauber als
  Pause zählen, wie gut die Runde die Wunschlänge trifft (im Klicktest mit nachgebildetem Routing).
- **Stufe 5 (Orte und Suche ohne Netz) gebaut:** geprüft mit Testdaten (Einheitstests, Klicktest) und im Ablauf
  „Kartenpakete“ mit den echten Orten (Probe-Suche Zugspitze, Marienplatz u. a.). Nicht geprüft: Ladezeit und Speicher
  der Orte-Datei auf dem Handy (auf dem Pixel liegt sie seit 02.11., 7 MB).
- **Emulator-Test in GitHub Actions** fehlt (App startet, Dienst startet mit vorgegebener Position).
- **Web mit den echten Diensten am PC geprüft (03.11., Browser über 127.0.0.1):** Karte, Routing über BRouter (mit
  Wegtypen, Untergrund und SAC-Stufe), Suche über Photon, Höhen. Overpass beantwortete das Info-Antippen an dem Abend
  nicht (beide Server Zeitüberschreitung bzw. 502), die App meldete das sauber. Ungeprüft: die Seite unter GitHub Pages
  (siehe Auslieferung), Kacheln bei `file://`.
- **Stadt nicht mit echten Daten geprüft:** Fußwege des Profils `hiking-mountain` in der Stadt, Fülle der Karte
  (höchstens 250 Marken), Dauer der Overpass-Abfrage. Nächster Schritt: Rundgang in der Münchner Altstadt planen.
- **Web-App auf dem Telefon nicht geprüft:** GPS, Vibration, Bildschirm wach halten und Teilen-Menü im Browser
  (eigene Wege, nicht die der Android-App); geht jetzt über die Pages-Adresse (siehe Auslieferung).
- **Aus der Code-Durchsicht vom 03.11., noch nicht behoben (Web):** Aufzeichnung im Browser nur im Arbeitsspeicher
  (Tab im Hintergrund verworfen ⇒ Spur weg); Drucken im Handy-Browser baut nach 500 ms zurück, bevor die Vorschau fertig
  ist (nicht geprüft); BRouter-Grenze von drei
  gleichzeitigen Anfragen hält nicht immer; Foto-Kacheln im Tagebuch können bei schnellem Bearbeiten doppelt erscheinen.
- **Android-Durchsicht (03.11.) nicht auf dem Gerät geprüft:** Fortsetzen nach Prozess-Tod (Mitteilung „Navigation
  unterbrochen“, Antippen setzt fort), Meldung bei GPS- oder Sprachausfall. Nachstellen: Navigation starten, App per
  `adb shell am kill io.github.thomasaurh.gipfelundgasse` im Hintergrund beenden, Mitteilung antippen.
- **Führung (03.11.) nicht auf dem Gerät geprüft:** Vorlesen der Kurzinfo am Stopp bei gesperrtem Bildschirm (Dienst),
  Länge der Ansage, echte Wikipedia-Antworten (im Klicktest nachgebildet). Im Browser nur der Ladevorgang geprüft, das
  Vorlesen am Stopp braucht echtes GPS.
- **Gipfelbuch (03.11.) nicht mit echten Daten geprüft:** Erkennung mit echtem Overpass und mit dem Kartenpaket in der App
  (im Klicktest nachgebildet). Gipfel ohne Namen zählen nicht; Fotos aus dem Tagebuch am Gipfel sind noch nicht verknüpft.
- **Mehrtagestour:** seit 04.11. Startzeit je Tag, Folgen je Etappe (Browser und Dienst der App) und Etappen im Druck;
  nur im Klicktest geprüft (in der App nur die Übergabe an den Dienst nachgebildet, kein echtes Folgen auf dem Pixel).
  Noch nicht gebaut: Etappen im Reisetagebuch-Heft. Die Startzeiten je Tag hängen an der Nummer des Tages: wer eine
  Übernachtung davor einfügt oder streicht, verschiebt sie.
- **Packliste (04.11.) nur im Klicktest geprüft:** ob die Dinge und Mengen auf echten Touren passen (Thomas' Urteil steht
  aus); Wetter kommt nur, wenn „Wetter für die Tour“ für denselben Plan geladen ist.
- **Routendaten doppelt auf dem Handy:** Oberbayern und Allgäu bringen beide die Kachel E10_N45 (190 MB) mit; jede
  Region hat ihre eigene Kopie.
- **Info ohne Netz kennt keine Läden** (`karten/orte.py` nimmt keine Geschäfte auf); mit Netz findet Info sie über
  Overpass. Läden ins Paket: von Thomas am 02.11. verworfen, er schaut über den Google-Maps-Link nach.
- **Reiseziele (#28) nicht auf dem Handy geprüft:** Dateiwahl und Namensdialog (prompt) im WebView der App, KML-Export
  aus Google My Maps nur mit einem nachgebauten Beispiel. Nicht gebaut: „automatisch besucht“ (Tour oder Tagebuch in
  der Nähe).
- **Info auf der Karte (#27):** auf dem Pixel am 02.11. „zu viele Anfragen“ (429) vom Overpass-Hauptserver; seit #31
  fragt die App dann overpass.private.coffee (aus der Cloud nicht erreichbar, also ungeprüft). Ungeprüft: Antwortzeit von Overpass beim Antippen, ob der Umkreis
  (etwa 30 Bildpunkte) das Gemeinte trifft. Große Flächen (Schlosspark) findet Overpass nur über ihren Rand.
- **Orte-Infos (#26) nicht mit den echten Diensten geprüft:** Wikipedia (CORS, Antwortzeit), Wikidata, Vorlesen mit der Android-Sprachausgabe; Öffnungszeiten nur mit Testeinträgen.
- **Ideen, nicht gebaut:** Notizen an Punkten der Tour;
  kleines Offline-Paket um ein Reiseziel bzw. eigene zugeschnittene Routendaten (kleineres Paket); Fotos aus dem
  Tagebuch im Gipfelbuch.
- **Tourwetter (#44) nur nachgebildet geprüft:** Antwortform der echten Open-Meteo-Schnittstelle per curl gemessen
  (Liste je Punkt, UTC-Stunden, `elevation=nan`), im Browser und in der App aber nur mit nachgebildeter Antwort.
- **Prüfdatum der Öffnungszeiten ohne Netz (#47):** in den Kartenpaketen seit dem Bau vom 03.11. abends (von Hand
  gestartet). Oberbayern gemessen: 3847 von 12 711 Orten mit Öffnungszeiten (30 %) tragen ein Prüfdatum, 886 davon älter
  als 2 Jahre; Museen 28 %, Gasthäuser 33 %, Hütten 21 %. Datei 7,15 statt 7,10 MB. Auf dem Pixel nicht geprüft: das
  Paket aktualisieren (Menü › Offline-Karten) und „Stand …“ in einem Ort-Fenster ohne Netz.

## Entscheidungen

- **Tourvorschläge aus offenen Daten** (04.11.): markierte Wanderwege aus OpenStreetMap statt kuratierter Touren, weil es
  keine offene Datenbank mit Tourvorschlägen gibt. Verworfen: Outdooractive/alpenvereinaktiv (Lizenz, Schlüssel läge offen
  in der App, jede Ansicht zu zählen), komoot (keine offene Schnittstelle, nur GPX-Export), Freizeitwege Bayern (nur
  wenige Fernwege als GPX).
- **Übersicht in Stufen** (04.11., Thomas' Wahl): erst Planen, Karte und Einstiege umbauen (wenig Umbruch), danach
  vielleicht Leiste Entdecken · Planen · Touren · Ich und eine eigene Seite je Tour mit „▶ Los“ statt der Seite
  Unterwegs, wenn die erste Stufe auf dem Pixel gefällt. Berg/Stadt bleibt vorerst getrennt von „Art“ (02.11.).
- **Dopplungen** (02.11.): Menü ☰ zeigt nur, was die Leiste unten nicht hat; Berg/Stadt und „Art“ bleiben getrennt
  (Thomas: „gar nicht so schlecht“), ebenso die drei Runden-Funktionen. Läden nicht ins Kartenpaket, dafür der Link zu
  Google Maps (Thomas schaut Öffnungszeiten lieber dort).
- **Kartenpakete über die App-Brücke lesen** (03.11.): `Karten.lesen` liefert Stücke als Base64 (höchstens 8 MB je
  Stück), weil das WebView Bereiche aus `shouldInterceptRequest` ab der Dateimitte nicht auslieferte, weder mit
  Range-Kopfzeile noch über `?von=&bis=` (#32, verworfen). fetch bleibt für den Browser und als Vergleich in der Prüfung;
  der Kartenserver bleibt für Orte-Datei und alte APKs. Falle beim Messen: protomaps-leaflet malt bei Lesefehlern den
  grauen Hintergrund und meldet die Kachel als geladen (Fehler nur in `console.error`), „geladen“ heißt also nicht
  „gezeichnet“; Prüfung und Klicktest zählen darum Kacheln mit nur Hintergrund. Overpass mit einem zweiten öffentlichen Server
  (overpass.private.coffee, laut OSM-Wiki weltweit) statt Warten.
- **Öffnungszeiten der Stopps gegen den Zeitplan** (03.11.): Quelle bleibt OpenStreetMap (`opening_hours`, mit dem
  Stopp gespeichert), kein zweiter Dienst. Abdeckung im Oberbayern-Paket gemessen: Hütten 21 %, Museen 58 %, Gasthäuser
  58 %, Cafés 66 % mit Zeiten; Burgen, Kirchen und Bergbahnen kaum (unter 6 %). Der Leser versteht jetzt auch Saison
  ohne Uhrzeit („Jun-Aug“), offenes Ende („11:30+“), Monate mit Doppelpunkt und Tage mit Datum („May 1-Sep 15“);
  lesbar damit Hütten 90 %, Museen 78 %, Gasthäuser 97 %. Feiertage bleiben außen vor (steht im Text dazu).
  Abgleich mit Google (03.11., `docs/oeffnungszeiten-abgleich.md`): 11 von 19 gleich, keine Quelle durchweg richtig;
  darum zeigt die App Quelle, Prüfdatum (`check_date`) und Links zu Webseite und Google Maps statt eines zweiten Dienstes.
- **Orte-Infos** (02.11.): Öffnungszeiten mit eigenem kleinem Leser (Wochentage, Monate, Zeiten, `;` und `,`), alles
  andere bleibt Rohtext; verworfen die Bibliothek opening_hours.js (groß, für eine HTML-Datei zu schwer). Anreise über die
  dokumentierte URL-Schnittstelle von Google Maps (öffnet am Telefon die App, rechnet Bus und Bahn); verworfen Links zu
  DB oder Bayern-Fahrplan (kein dokumentiertes, stabiles Format). Wikipedia nur, wenn ein Ort-Fenster aufgeht.
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
  (km + Hm/100) × Lauftempo, wie die Leistungs-km im Trailrunning (ITRA). Auto-Pause und Rundkurs kamen mit #22.
- **Reisetagebuch** (02.11., Thomas' Wahl aus Vorbild Polarsteps/Day One): Reisen mit Zeitraum, Einträge mit Text und
  Fotos, Ort, Uhrzeit und Wetter automatisch; Fotos auf 1600 px verkleinert in IndexedDB, in der Sicherung als
  Daten-Adresse. Einträge auf der Karte und Heft kamen mit #21.
- **Signierschlüssel auf GitHub erzeugt, verschlüsselt im Entwurfs-Release** (02.11.): nur ein Geheimnis nötig
  (`KEYSTORE_PASSWORT`), der Schlüssel verlässt GitHub nie unverschlüsselt. Verworfen: den Ersatzschlüssel verschlüsselt
  aus dem Cache holen (ginge ohne Neuinstallation, die Schutzautomatik der Sitzung hat das Herausgeben gestoppt) und
  einen Schlüssel in der Sitzung erzeugen (er ginge durch den Chat).
- **Leiste Karte · Entdecken · Planen · Unterwegs · Ich** (04.11., Thomas' Wahl): Touren gehören zu „Ich“ (Thomas nach dem
  Test von Bau 172: „Der Touren-Punkt gehört zu Ich“), Unterwegs zurück in die Leiste; dazu „▶ Los“ auf der Tourseite und der
  Balken bei laufender Navigation. Karte bleibt, weil die App am Telefon mit der reinen Karte startet. Berg/Stadt bleibt
  getrennt von „Art“. Löst die Leiste vom 02.11. ab.
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

- **Android:** Merge auf `main` ⇒ GitHub Actions (`app.yml`) baut, signiert mit dem festen Schlüssel (Entwurfs-Release
  `signierschluessel` + Geheimnis `KEYSTORE_PASSWORT`, beide nie löschen) und ersetzt die APK im Release `neueste`:
  https://github.com/thomas-aurh/gipfel-und-gasse/releases/tag/neueste (Datei `Gipfel-und-Gasse.apk`, Titel nennt den
  Bau). Nach jedem Bau geprüft: Fingerabdruck `20:D3:8E:B0…59:48:B2`.
- **Fehlerbild Download-Seite:** GitHub antwortet zeitweise mit `HTTP 502` (04.11. zweimal). Seitdem wiederholt der
  Schritt „Download-Seite erneuern“ jeden Aufruf bis zu fünfmal (Pause 5 bis 20 s), Löschen darf scheitern. Bricht er
  trotzdem ab: erst `gh release view neueste --json assets,name` messen (APK und Baunummer), dann den Job einmal neu
  anstoßen; das Skript räumt einen halben Lauf selbst auf (`-neu`/`-alt`).
- **Kartenpakete:** Ablauf „Kartenpakete“ (`kartenpakete.yml`), monatlich am 3. und von Hand (Actions › Kartenpakete ›
  Run workflow); legt Karte, Höhen und Routendaten samt `pakete.json` in den Release `kartenpakete`, die Größen stehen
  dort und in der App-Liste. Die App holt die Liste von dort.
- **Web:** https://thomas-aurh.github.io/gipfel-und-gasse/ (GitHub Pages, Quelle „GitHub Actions“, am 03.11. auf
  Thomas' Wunsch eingerichtet). Ablauf `pages.yml`: nach jedem Merge auf `main`, der `web/` betrifft, bauen, prüfen
  (`web/pruefen.sh`) und `web/dist/Gipfel-und-Gasse.html` als `index.html` veröffentlichen. Daten (Touren, Tagebuch)
  liegen je Browser; zwischen PC und Handy über „Sicherung speichern/laden“.

## Erledigt

- **05.11. (Bescheid geben, Hütten-Infos, Passt die Tour zu mir)** Aus der Recherche (komoot Live-Tracking, DAV:
  Rückkehrzeit hinterlassen, DAV-BergwanderCheck): „📣 Bescheid geben“ mit Tour, Start, Rückkehr, Notruf-Hinweis und
  Link (R.bescheidText), Erinnerung nach der geplanten Rückkehr, „✅ Ankunft melden“ (R.ankunftText); Tageskarte mit
  Telefon, Webseite und Öffnung der Unterkunft (aus den OSM-Tags, R.telAdresse); „🧭 Passt die Tour zu mir?“ unter
  Vorbereiten (R.tourCheck). Einheitstests 306, Klicktest 389.

- **05.11. (Planen neu geordnet, Thomas am Pixel, Bau 215)** Reihenfolge: 1. Berg und Natur | Stadt, 2. Art und Tempo,
  3. Hinweis, „Runde mit Länge“ (nur bei Laufen; unter „⋯“ für alle) und letzte Tour, 4. Aktionsleiste ▶ Los · 💾 · ↶ · ✕ ·
  ⏺ Aufzeichnen · ⋯. Einstieg „Stadtrundgang“ entfernt (führte nur zu Entdecken, dort steht der Rundgang). Klicktest 383.

- **05.11. (Planen umgeordnet, Mehrtagestour als Art; Thomas am Pixel, Bau 213)** Art und Tempo ganz oben im Blatt, Berg/Stadt
  ans Ende des Reiters Route (ohne Route unter den Einstiegen). Neue Art „Mehrtagestour“ (Profil `mehrtag`, geroutet wie
  Wandern): ihre Optionen (Tage mit ★-Vorschlag, Hütten, Tageskarten) erscheinen nur dort; die Route teilt sich von
  selbst, einmal je Route; eine andere Art macht wieder eine Tagestour. Der Schalter „1 Tag | Mehrere Tage“ entfällt.
  Klicktest 382.

- **05.11. (Mehrtagestour: Hütte und Tageszahl)** „Mehrere Tage“ schlägt die Zahl der Tage vor (R.tageVorschlag: höchstens
  etwa 6,5 h am Tag, 2 bis 30 Tage; Auswahl um den Vorschlag mit ★); neue Übernachtungen landen auf der nächsten Hütte
  oder Unterkunft bis 2 km (R.unterkunftAbfrage/R.unterkunftWahl, Overpass; Berghütte vor Gasthof, Herberge, Hotel,
  Zeltplatz), mit Namen; ohne Treffer oder Netz bleiben sie auf der Route. Einheitstests 298, Klicktest 382.

- **05.11. (Unterwegs und Info, Thomas am Pixel, Bau 209)** Unterwegs ohne Route mit Knöpfen „✏️ Route planen“ und „🥾 Tour
  öffnen“ statt Text (und ohne „Route folgen“); die Erklärtexte oben in Unterwegs, Reisetagebuch, Reiseziele und Gipfelbuch
  stehen jetzt gesammelt unter Menü › Werkzeuge › Info („Die Bereiche kurz erklärt“). Klicktest 380.

- **05.11. (Schritt 3a, Prüfbericht Browser Use vom 04.11.)** Leiste am PC mit allen fünf Bereichen (vorher abgeschnitten
  mit Rollbalken); aktiver Bereich mit `aria-current`, Seitentitel als Überschrift; Bedienflächen mindestens 44 px;
  bei 320 px Berg/Stadt, Aktionsleiste und Reiter ohne Umbruch; Kartennachweis am Telefon einzeilig mit „Kartendaten ©
  OpenStreetMap-Mitwirkende“ vorn, Antippen klappt ihn auf (OSMF-Attribution-Guidelines erlauben das Einklappen, die Tile
  Usage Policy verlangt die sichtbare OSM-Nennung; Leaflet-Vorspann weg); Begriffe Start, Stopp n, Übernachtung, Ziel;
  Unterwegs vor dem Start eine Karte der Tour über „▶ Route folgen“. Klicktest 376. Zurückgestellt: eigene Symbole statt
  Emoji (fehlen auf Rechnern ohne Emoji-Schrift), doppelte Suchtreffer (erst an mehreren Begriffen prüfen).

- **04.11. (Abend, Tage gebündelt)** Thomas am Pixel (Bau 205): „Hier sollten die Infos zu den Tagen gebündelt sein.“ Jetzt
  je Tag eine Karte mit Datum, Strecke, Höhenmetern, Gehzeit, Start und den Punkten dieses Tages (Übernachtung als letzter
  Punkt); „länger als das Tageslicht“ statt eines spätesten Starts mitten in der Nacht (auch bei einer Tagestour, mit
  Hinweis auf „Mehrere Tage“); Reiterleiste klebt nicht mehr über der Aktionsleiste. Klicktest 369.

- **04.11. (Abend, Mehrtagestour intuitiv)** Schritt 2 des Umbaus: Schalter „1 Tag | Mehrere Tage“ im Reiter Route,
  Teilung in 2 bis 5 gleich lange Tage nach Gehzeit (R.tagesAufteilung: vorhandener Punkt bis 15 % daneben, sonst neuer
  Punkt auf der Route), Punktliste nach Tagen mit 🛏 je Punkt, Route und Etappen je Tag in eigener Farbe, unterwegs
  große Knöpfe je Tag statt Auswahlfeld. Thomas: „das mit dem Punkt antippen hat funktioniert“, aber zu versteckt.
  Einheitstests 293, Klicktest 369.
- **04.11. (Abend, Planen in Reitern)** Schritt 1 des Umbaus für mehr Übersicht (Thomas: „alles intuitiver“): Planen in drei
  Reitern Route · Überblick · Vorbereiten statt einer langen Liste; „▶ Los“ in der Aktionsleiste; am Telefon Rückgängig,
  Neu und Mehr als Zeichen, damit die Leiste in eine Zeile passt; Warnpunkt am Reiter Vorbereiten. Klicktest 362.
- **04.11. (Abend, Packliste und Mehrtagestour)** „🎒 Packliste“ im Planen und auf der Tourseite (R.packliste,
  R.packWetter): je Tourart, Gehzeit, Höhenmetern, Höhe, Tagen und geladenem Tourwetter, mit Kind; Abhaken je Tour,
  eigene Dinge für alle. Mehrtagestour: eigene Startzeit ab Tag 2 (gespeichert in `zeit.tage`), gilt für Etappen, Stopps,
  Tourwetter und Druck; Unterwegs „Folgen“ je Tag (R.etappeAusschnitt, Browser und Dienst der App), Druck mit Etappen je
  Tag. Thomas' Wunsch. Einheitstests 289, Klicktest 359.
- **04.11. (Abend, Sicherung als ZIP, Fotos auf der Tourkarte)** Sicherung als ZIP (eigener ZIP-Schreiber und -Leser,
  ungepackt, CRC-32): `sicherung.json` (version 2, `fotoDateien`) und je Foto `fotos/<id>.jpg`; die App schreibt in
  Stücken zu 3 MB (`NaviPlugin.dateiStueck`) und teilt die fertige Datei (`teilen` mit `entwurf`); ältere JSON-Sicherungen
  laden weiter; ZIP an den ersten Bytes erkannt. Fotos: Ort und Aufnahmezeit aus dem EXIF des Originals (`R.exifLesen`),
  je Foto im Eintrag (`fotoInfo`, mit in der Sicherung); Tourkarte zeigt die Fotos als Bilder an ihrer Stelle
  (`R.fotoOrt`: Foto-GPS, sonst Zeit auf der Spur, sonst Ort des Eintrags), Antippen öffnet das Bild. Thomas' Wunsch.
  Einheitstests 281, Klicktest 350.
- **04.11. (Abend, Fotos)** Ich › Fotos: alle Bilder des Tagebuchs als Raster, großes Bild mit Blättern (Wischen, ‹ ›,
  Pfeiltasten), Reise und Zeitpunkt; Querverweise „Zur Reise“ (Eintrag hervorgehoben) und zur gegangenen Tour desselben
  Tages (zeitlich nächste); Tourseite zeigt die Fotos des Tages (Thomas' Wunsch, Vorbild Fotos im Profil gängiger
  Tourenplaner). Dazu „📤 Teilen“ im großen Bild: App über das Teilen-Menü von Android (Bilddatei, Begleittext Reise ·
  Tour · Datum), Browser über die Teilen-Funktion des Browsers, sonst Herunterladen. Klicktest 347, Einheitstests 266.
- **04.11. (Abend, Wanderwege 2)** Befund auf dem Pixel (Bau 193): Ladeanzeige funktioniert, Overpass antwortete „502 …
  at capacity“. Wanderwege kommen jetzt zuerst von Waymarked Trails (`list/by_area`, Ausschnitt in EPSG:3857, eigene
  Datenbank aus OSM, CORS offen), Overpass nur noch als Ersatz und für den Verlauf einer Route. Fehler von Diensten kurz
  und verständlich („Dienst gerade überlastet …“) statt der Fehlerseite. Klicktest 341, Einheitstests 265.
- **04.11. (Abend, Ladeanzeige)** Befund von Thomas auf dem Pixel (Bau 190): „Wanderwege suchen“ bei 5 km am Walchensee
  endete mit Zeitüberschreitung, ohne dass man sah, dass etwas lädt. Abfrage jetzt über die Wege im Umkreis und deren
  Routen (`way(around) → rel(bw)`, ohne Mittelpunkt) statt Routen direkt im Umkreis; bei Zeitüberschreitung der Hinweis
  auf einen kleineren Umkreis. Ladeanzeige für alle Dienste (ab 0,4 s): Logo mit Wanderer auf dem Weg zum Gipfel
  (SVG-Animation, ruhig bei „weniger Bewegung“), nicht im Druck-Logo. Klicktest 338, Einheitstests 261.
  Logo mit himmelblauem Himmel (Thomas' Wunsch), App-Symbole und Startbilder neu erzeugt (`werkzeuge/symbole.js`, ohne
  den Wanderer, der zwischen `<!--wanderer-->`-Markierungen im Logo steht).
- **04.11. (Abend, Wanderwege)** „🥾 Wanderwege in der Nähe“ in *Entdecken*: markierte Routen aus OSM (`route=hiking|foot`)
  über Overpass, Verlauf aus den Wegstücken der Relation (Alternativen weg, Lücken als Abschnitte), „＋ Tour“ speichert
  unter „Geplant“. Quellen geprüft: OSM offen (ODbL); Freizeitwege Bayern CC BY 4.0, aber nur wenige Fernwege als GPX;
  Outdooractive nur mit gekaufter Lizenz und Zähl-Pflicht, verworfen. Einheitstests 260, Klicktest 334.
- **04.11. (Abend, später)** GPX-Import übernimmt Wegpunkte (Symbol und Name → Hütte, Gipfel, Parkplatz, Punkt; „Blick …“
  bleibt Punkt), Art aus `<type>`, Herkunft aus `creator` und Dauer aus den Zeitstempeln; Tourseite und Karte zeigen sie,
  die Sicherung nimmt sie mit. Anlass: Datei aus komoot (8 Highlights, Art „hike“, Zeitstempel) ging bis auf die Spur
  verloren. Einheitstests 256, Klicktest 331.
- **04.11. (Abend)** GPX laden über Menü › Werkzeuge und unter Touren, mehrere Dateien auf einmal, jede gleich unter
  „Geplant“ gespeichert (Thomas' Wunsch; vorher nur geöffnet, Speichern von Hand). Tourseite mit Anreise zum Start
  (Google Maps, Bus und Bahn oder Auto) und Parkplätzen bis 1 km um den Start (OpenStreetMap, ohne private; Abstand,
  Gebühr, Plätze, Parkhaus, Wanderparkplatz; „🚗 hin“). Klicktest 327, Einheitstests 250.
- **04.11. (später Nachmittag)** Download-Seite: GitHub-Aufrufe bis zu fünfmal wiederholt (Bau 167 und 169 waren an 502
  gescheitert). Familien-Filter in den geplanten Touren (bis 5/8/12 km und 200/400/700 Hm) und „👨‍👩‍👧 Familien-Check“ im
  Planen (Grenze, Spielplatz oder Einkehr auf halber Strecke, nur das Mittelstück bei Overpass). Stadtrundgang nach
  Zeitbudget (1 bis 4 Stunden, nach dem Routen nachgemessen, zu langer Rundgang verliert den letzten Ort). Klicktest 321,
  Einheitstests 248.
- **04.11. (Nachmittag)** Durchsicht: Prüfung und Klicktest grün, alles Ausgelieferte auf `main`. Übersicht nach dem
  Vorbild gängiger Tourenplaner, jede Stufe von Thomas auf dem Pixel angesehen: Planen mit Kennzahlen und Höhenprofil
  zuerst, Art/Tempo und Name/Zeitplan als Klappzeilen, Einstiege ohne Route, Zoom-Knöpfe nur mit Maus (#57); Start am
  Telefon mit der reinen Karte (#59); Marke vom Höhenprofil blieb ohne Route stehen, behoben (#58); Stopps mit ▲▼,
  Tourlisten mit Suche, Sortierung und Art (#60); Leiste Karte · Entdecken · Planen · Unterwegs · Ich, „Ich“ mit Touren,
  Tagebuch, Reisezielen, Gipfelbuch, Tourseite mit „▶ Los“, Balken bei laufender Navigation (#60, #61, #62).
  Klicktest 315. Bau 167 und 169 brachen beim Erneuern der Download-Seite mit HTTP 502 von GitHub ab (APK gebaut,
  Code unschuldig); Neulauf des Jobs grün.
- **04.11.** Klicktest als Pflichtprüfung in GitHub Actions (Job `klicktest`, Chromium und Testkarten; die APK für die
  Download-Seite entsteht erst danach), bei Fehler mit Bildschirmfotos als Anhang. Wackler „Reiseziele, Datei laden“
  behoben: der Test wartete auf „2 Häkchen“ und fand die der eben abgebrochenen Einfügen-Liste, die unsichtbar stehen
  blieb; jetzt wartet er auf den Status genau dieses Imports, und Abbrechen leert die Vorschau (Gegenprobe rot,
  danach 6 von 6 grün). Die Vermutung vom 03.11. (GPS aus #53) war falsch (#55).
  Lauf „Kartenpakete“ von Hand: `pakete.json` trägt den neuen Namen „Oberbayern mit München, Innsbruck und Salzburg“
  (gemessen 04.11.); Rahmen der Pakete von Thomas am 04.11. auf dem Pixel bestätigt (Bau 161). Auf kleinen Zoomstufen
  reicht die Offline-Karte über den Rahmen hinaus (ganze Kacheln), außerhalb der Kacheln bleibt sie dunkel.

- **03.11. (abends)** `KartenServer` bedient `/_karten_/…` nur noch für die eigene App-Adresse (Schema und Host der
  Capacitor-Brücke, sonst 403; Java-Test `BereichTest.nurEigeneAdresse`). Im Browser geht GPS mit dem Ende von Folgen
  und Aufzeichnen wieder aus, wenn es nur dafür eingeschaltet war; mit 📍 eingeschaltet bleibt es an (Klicktest mit
  Gegenprobe) (#53).
- **03.11.** Offline-Karte: Kartendateien über die App-Brücke (`Karten.lesen`) statt über das WebView, Prüfung zählt
  Kacheln mit nur Hintergrund (#34). Von Thomas am 03.11. auf dem Pixel bestätigt (Bau 107): Karte zeichnet bei
  Penzberg und Innsbruck (liegt im Rechteck von „Oberbayern“, Südkante 47,25°); in Verona und Kempten (außerhalb der
  installierten Pakete) zeigt sie wie vorgesehen topografisch mit Hinweis. Rahmen der installierten Pakete auf der
  Offline-Karte (gestrichelt, Name oben links), Paket Oberbayern umbenannt in „Oberbayern mit München, Innsbruck und
  Salzburg“ (#36).

- **03.11.** Code-Durchsicht mit Prüfern: Web (#38, u. a. Seilbahn-Sprung zählte bis 1000 Hm, Import-Parser) und
  Android (#39, Neustart nach Prozess-Tod, sicheres Schreiben der Sitzung). Neu: Öffnungszeiten der Stopps gegen den
  Zeitplan mit erweitertem Leser (#40), Führung mit Wikipedia-Kurzinfo am Stopp (#41), Gipfelbuch (#42), Mehrtagestour
  mit Etappen (#43), Wetter für die Tour an Start, Gipfel und Ziel (#44). Abgleich der Öffnungszeiten OSM gegen Google
  an 30 Orten (#45, `docs/oeffnungszeiten-abgleich.md`), daraus Quelle, Prüfdatum und Links an den Zeiten (#46) und das
  Prüfdatum im Kartenpaket (#47, Pakete am Abend neu gebaut, #52). Web-Seite über GitHub Pages (#49); Info-Fenster mit
  „Diese Stelle in Google Maps“ als Ausweg, als Overpass ausfiel (#50). Jeder Feature-PR vor dem Merge von einem
  unabhängigen Prüfer gelesen, Befunde behoben.

- **02.11. (zweite Hälfte)** Blatt unten am Kopf ziehen und im Inhalt zuwischen; Menü ☰ ohne die Seiten der Leiste,
  eigenes Zeichen für Kartenart (#25). Ort-Fenster mit „geöffnet bis …“ aus `opening_hours`, Wikipedia-Kurzinfo samt
  Vorlesen, Anreise zum Start, „☔ Drinnen in der Nähe“ (#26). Info-Modus ⓘ: Antippen zeigt, was dort ist, statt einen
  Punkt zu setzen; Fenster nicht mehr hinter Blatt oder Suche (#27). Reiseziele mit Listen, ⭐-Ebene, eintippen,
  einfügen, Datei laden (Text, CSV, GPX, KML, GeoJSON), als GPX weitergeben (#28). Link „In Google Maps“ in allen
  Ort-Fenstern, von Thomas auf dem Pixel bestätigt (#30). Overpass mit zweitem Server bei 429 (#31). Offline-Karte:
  Prüfung auf dem Gerät (#29, #31), Lesen nur über `?von=&bis=` (#32); behoben ist die leere Karte damit erst, wenn
  Thomas' Prüfung es zeigt (siehe Offen).

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
  Laufen: Auto-Pause (Stehen über 10 s zählt nicht zur Bewegungszeit, Ansage „Pause“/„Weiter“) und Runde mit
  Wunschlänge ab dem Start (Dreieck, nach dem Routen nachbemessen) (#22).
  Kamera aus dem Tagebuch: Kamera-App im Manifest angemeldet (ohne sie wich Capacitor ab Android 11 still auf die
  Dateiauswahl aus, Befund von Thomas in Verona) (#18).
  Mit der Kamera aufgenommene Tagebuch-Fotos zusätzlich als Original in die Galerie (Bilder › Gipfel und Gasse,
  abschaltbar, ab Android 10) (#19).
  Gewitterwarnung unterwegs (alle 30 min beim Folgen oder Aufzeichnen, nächste drei Stunden, Ansage; in der App aus dem
  Dienst) und Statistik je Woche und Monat mit Säulen der letzten 12 Monate (#23).
  Fester Signierschlüssel aktiv (#20): angelegt in Lauf 79, Lauf 80 holte denselben aus dem Entwurfs-Release
  (Fingerabdruck `20:D3:8E:B0:…:59:48:B2` in beiden); Thomas hat einmal neu installiert (Bau 80). Wetter für Start,
  eigenen Standort, Kartenmitte oder einen gesuchten Ort, mit Ortsname und Höhe der Vorhersage (#24).
  Tagebuch: Einträge als Punkte auf der Karte (Ebene abschaltbar, „Öffnen“ springt zum Eintrag) und Reise als Heft
  zum Drucken oder als PDF (Kennzahlen, Skizze der Wege und Orte, Tage mit Einträgen und Fotos) (#21).

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
