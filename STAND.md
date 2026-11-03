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
- **Aus der Durchsicht vom 01.11., noch nicht gebaut:** Stopps von Hand umsortieren; Tourliste sortieren und filtern.
- **Aus der Code-Durchsicht vom 03.11., noch nicht behoben (Web):** Aufzeichnung im Browser nur im Arbeitsspeicher
  (Tab im Hintergrund verworfen ⇒ Spur weg); Sicherung baut alle Fotos in einen einzigen Text (bei sehr vielen Fotos zu
  groß, jetzt mit Meldung statt still); Drucken im Handy-Browser baut nach 500 ms zurück, bevor die Vorschau fertig
  ist (nicht geprüft); GPS bleibt nach „Folgen/Aufzeichnung beenden“ an, bis 📍 aus; BRouter-Grenze von drei
  gleichzeitigen Anfragen hält nicht immer; Foto-Kacheln im Tagebuch können bei schnellem Bearbeiten doppelt erscheinen.
- **Android-Durchsicht (03.11.) nicht auf dem Gerät geprüft:** Fortsetzen nach Prozess-Tod (Mitteilung „Navigation
  unterbrochen“, Antippen setzt fort), Meldung bei GPS- oder Sprachausfall. Nachstellen: Navigation starten, App per
  `adb shell am kill io.github.thomasaurh.gipfelundgasse` im Hintergrund beenden, Mitteilung antippen.
- **Führung (03.11.) nicht auf dem Gerät geprüft:** Vorlesen der Kurzinfo am Stopp bei gesperrtem Bildschirm (Dienst),
  Länge der Ansage, echte Wikipedia-Antworten (im Klicktest nachgebildet). Im Browser nur der Ladevorgang geprüft, das
  Vorlesen am Stopp braucht echtes GPS.
- **Gipfelbuch (03.11.) nicht mit echten Daten geprüft:** Erkennung mit echtem Overpass und mit dem Kartenpaket in der App
  (im Klicktest nachgebildet). Gipfel ohne Namen zählen nicht; Fotos aus dem Tagebuch am Gipfel sind noch nicht verknüpft.
- **Mehrtagestour (03.11.), noch nicht gebaut:** Etappen im Druck und im Reisetagebuch-Heft; Navigation kennt die Etappen
  nicht (folgt der ganzen Tour, Ansagen bis zum Ziel); eine Startzeit je Tag statt derselben für alle.
- **Klicktest „Reiseziele, Datei laden“ zeitabhängig:** fiel am 03.11. in 2 von rund 15 Läufen mit denselben 5 Prüfungen aus
  (Ortssuche des eingelesenen Texts noch nicht fertig), sonst grün. Nicht an den Änderungen des Tages, nicht weiter untersucht.
- **`KartenServer` prüft den Host nicht** (bewusst noch nicht geändert): jede Anfrage auf `/_karten_/…` wird bedient.
  Harmlos, solange die WebView nur App-Inhalte lädt; die leere Offline-Karte ist seit #34 geklärt (Lesen über die Brücke), der Punkt kann jetzt angegangen werden.
- **Routendaten doppelt auf dem Handy:** Oberbayern und Allgäu bringen beide die Kachel E10_N45 (190 MB) mit; jede
  Region hat ihre eigene Kopie.
- **Neuer Paketname erst nach dem nächsten Lauf „Kartenpakete“ auf `main`** (#36): „Oberbayern mit München, Innsbruck
  und Salzburg“ steht in `karten/regionen.json`; die App zeigt ihn in Liste und Rahmen, sobald `pakete.json` neu gebaut
  ist (von Hand: Actions › Kartenpakete › Run workflow, sonst am 3.12.). Die ID `oberbayern` bleibt, nichts muss neu
  geladen werden. Rahmen auf dem Pixel nicht geprüft.
- **Info ohne Netz kennt keine Läden** (`karten/orte.py` nimmt keine Geschäfte auf); mit Netz findet Info sie über
  Overpass. Läden ins Paket: von Thomas am 02.11. verworfen, er schaut über den Google-Maps-Link nach.
- **Reiseziele (#28) nicht auf dem Handy geprüft:** Dateiwahl und Namensdialog (prompt) im WebView der App, KML-Export
  aus Google My Maps nur mit einem nachgebauten Beispiel. Nicht gebaut: „automatisch besucht“ (Tour oder Tagebuch in
  der Nähe).
- **Info auf der Karte (#27):** auf dem Pixel am 02.11. „zu viele Anfragen“ (429) vom Overpass-Hauptserver; seit #31
  fragt die App dann overpass.private.coffee (aus der Cloud nicht erreichbar, also ungeprüft). Ungeprüft: Antwortzeit von Overpass beim Antippen, ob der Umkreis
  (etwa 30 Bildpunkte) das Gemeinte trifft. Große Flächen (Schlosspark) findet Overpass nur über ihren Rand.
- **Orte-Infos (#26) nicht mit den echten Diensten geprüft:** Wikipedia (CORS, Antwortzeit), Wikidata, Vorlesen mit der Android-Sprachausgabe; Öffnungszeiten nur mit Testeinträgen.
- **Ideen, nicht gebaut:** Fotos und Notizen an Punkten der Tour; Familien-Filter (unter X km und Y Hm, Spielplatz
  oder Einkehr auf halber Strecke); Rundgang nach Zeitbudget („2 Stunden in Verona“); Packliste je Tourart und Wetter;
  kleines Offline-Paket um ein Reiseziel bzw. eigene zugeschnittene Routendaten (kleineres Paket); Fotos aus dem
  Tagebuch im Gipfelbuch.
- **Tourwetter (#44) nur nachgebildet geprüft:** Antwortform der echten Open-Meteo-Schnittstelle per curl gemessen
  (Liste je Punkt, UTC-Stunden, `elevation=nan`), im Browser und in der App aber nur mit nachgebildeter Antwort.
- **Prüfdatum der Öffnungszeiten ohne Netz (#47):** steht erst in den Kartenpaketen ab dem Neubau nach #47; auf dem
  Handy das Paket aktualisieren (Menü › Offline-Karten). Wie viele Orte `check_date` tragen, ist nicht gemessen.

## Entscheidungen

- **Dopplungen** (02.11.): Menü ☰ zeigt nur, was die Leiste unten nicht hat; Berg/Stadt und „Art“ bleiben getrennt
  (Thomas: „gar nicht so schlecht“), ebenso die drei Runden-Funktionen. Läden nicht ins Kartenpaket, dafür der Link zu
  Google Maps (Thomas schaut Öffnungszeiten lieber dort).
- **Kartenpakete über die App-Brücke lesen** (03.11.): `Karten.lesen` liefert Stücke als Base64 (höchstens 8 MB je
  Stück), weil das WebView Bereiche aus `shouldInterceptRequest` ab der Dateimitte nicht auslieferte, weder mit
  Range-Kopfzeile noch über `?von=&bis=` (#32, verworfen). fetch bleibt für den Browser und als Vergleich in der Prüfung;
  der Kartenserver bleibt für Orte-Datei und alte APKs. Overpass mit einem zweiten öffentlichen Server
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
- **Kartenpakete:** Ablauf „Kartenpakete“ (`kartenpakete.yml`), monatlich am 3. und von Hand (Actions › Kartenpakete ›
  Run workflow); legt Karte, Höhen und Routendaten samt `pakete.json` in den Release `kartenpakete`, die Größen stehen
  dort und in der App-Liste. Die App holt die Liste von dort.
- **Web:** https://thomas-aurh.github.io/gipfel-und-gasse/ (GitHub Pages, Quelle „GitHub Actions“, am 03.11. auf
  Thomas' Wunsch eingerichtet). Ablauf `pages.yml`: nach jedem Merge auf `main`, der `web/` betrifft, bauen, prüfen
  (`web/pruefen.sh`) und `web/dist/Gipfel-und-Gasse.html` als `index.html` veröffentlichen. Daten (Touren, Tagebuch)
  liegen je Browser; zwischen PC und Handy über „Sicherung speichern/laden“.

## Erledigt

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
  Prüfdatum im Kartenpaket (#47). Jeder PR vor dem Merge von einem unabhängigen Prüfer gelesen, Befunde behoben.

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
