// In der Android-App: Route folgen und Aufzeichnen übernimmt der native Navigationsdienst (läuft auch bei gesperrtem
// Bildschirm, spricht Ansagen); GPX geht über das Teilen-Menü, Drucken über den Druckdialog von Android.
// Im Browser tut diese Datei nichts.
if (NATIV) {
  const Navi = window.Capacitor.registerPlugin('Navi');
  const app = { folgen: false, aufz: false, umgeplant: 0 };
  // nach dem Umplanen unterwegs: die neue Strecke ab dem Standort blau über der geplanten
  const ebeneUmplan = L.layerGroup().addTo(karte);

  document.body.classList.add('app');
  // „Link teilen“ zeigt in der App auf die lokale Adresse der App, die niemand sonst öffnen kann: ausblenden, GPX nehmen
  $('bTeilen').hidden = true;
  $('unterwegsHinweis').innerHTML = 'Läuft auch bei <b>gesperrtem Bildschirm</b>, mit Ansagen. Abseits der Route plant die App ab deinem Standort ' +
    'neu zum nächsten Ziel. Beenden auch über die Mitteilung „Navigation läuft“.';
  $('tourenHinweis').innerHTML = 'Touren liegen in der App auf dem Handy; wer die App deinstalliert, löscht sie mit. ' +
    '„Sicherung speichern“ gibt alle Touren samt Planung, Tagebuch und Fotos als eine ZIP-Datei weiter (z. B. an Drive oder per Mail); „Sicherung laden“ holt sie zurück.';

  // Stopps mit Namen und Besichtigungszeit: an welchem Meter der Route sie liegen
  function stoppsFuerApp(plan) {
    const e = plan.e;
    if (!e || S.fest) return [];
    const out = [];
    plan.wps.forEach((w, i) => {
      if (i === 0 || (!w.name && !w.notiz)) return;
      // text: Führung, liest der Dienst am Stopp statt „… erreicht“ vor (auch bei gesperrtem Bildschirm)
      // lat/lon: daran erkennt der Dienst den Stopp für die Führung (auch nach dem Umplanen und bei gleichen Namen)
      const s = { d: e.stueckEnde[i - 1], name: w.name || (i === plan.wps.length - 1 ? 'Ziel' : 'Stopp ' + i), min: +w.min || 0, lat: w.lat, lon: w.lon };
      // Notiz und Führung liest der Dienst am Stopp statt „… erreicht“ vor
      const text = stoppVorlesen(w);
      if (text) s.text = text;
      out.push(s);
    });
    // Punkt-Alarm: Wegpunkte der GPX-Datei, Hütten/Gipfel/Brunnen (benannte Wegpunkte sind oben schon dabei)
    if (punktAlarmAbstand()) {
      for (const p of R.alarmPunkte(e.pts, alarmQuellen(false), 150)) {
        if (!out.some(s => s.name === p.name && Math.abs(s.d - p.d) < 50)) out.push({ d: p.d, name: p.name, min: 0, lat: p.lat, lon: p.lon });
      }
      out.sort((a, b) => a.d - b.d);
    }
    return out;
  }

  // Kennung des Plans, der zuletzt an den Dienst ging: Neuberechnungen ohne Planänderung (z. B. anderes Tempo) schicken
  // nur Einstellungen, sonst ersetzte die geplante Strecke eine unterwegs umgeplante
  const planKennung = () => JSON.stringify([S.wps, S.profil, S.fest, S.ergebnis ? S.ergebnis.pts.length : 0, S.ergebnis ? S.ergebnis.laenge : 0, naviPlan().tag]);
  async function senden(mitRoute) {
    const plan = naviPlan(), e = plan.e;   // Mehrtagestour: nur der gewählte Tag
    if (mitRoute && e) app.plan = planKennung();
    // beim Laufen ist tempo das Lauftempo (min/km); kmAnsage: jeden Kilometer der Aufzeichnung Zeit und Tempo ansagen.
    // Art: beim Folgen die der Route (Restzeit), sonst die Aktivität unter Unterwegs (Sprunggrenze, „Pause/Weiter“)
    const art = app.folgen ? artAktuell() : AKT().art;
    const opt = { tempo: art === 'lauf' ? S.pace : artAktuell() === 'lauf' ? 1 : tempoAktuell(), rad: art === 'rad', lauf: art === 'lauf', kmAnsage: $('kmAnsage').checked,
      streckenziel: streckenziel(), ansagen: true, folgen: app.folgen, aufzeichnen: app.aufz, alarm: punktAlarmAbstand() || 150 };
    if (mitRoute && e) {
      // vierter Wert 1: Punkt beginnt einen neuen Abschnitt (mehrteilige GPX-Spur), der Sprung ist kein Weg
      opt.pts = e.pts.map(p => [p.lat, p.lon, p.ele == null ? null : p.ele, p.luecke ? 1 : 0]);
      opt.stopps = stoppsFuerApp(plan);
      // Abbiegehinweise für die Ansagen: [Meter ab Start, Befehl, Ausfahrt]
      opt.hinweise = S.fest ? [] : (e.hinweise || []).map(h => [h.d, h.cmd, h.exit]);
      // fürs Umplanen unterwegs: alle Ziele nach dem Start [Breite, Länge, Meter ab Start, Minuten, Name] und das Profil;
      // eine geöffnete Spur (GPX) oder gerade Linien werden nicht umgeplant
      const prof = (PROFILE[S.profil] || PROFILE.wandern).brouter;
      opt.profil = S.fest || !prof ? null : prof;
      opt.ziele = S.fest ? [] : plan.wps.slice(1).map((w, i) => [w.lat, w.lon, e.stueckEnde[i], +w.min || 0, w.name || '']);
      // Umkehrzeit und Dunkelgrenze für heute (ms; 0 = aus): der Dienst warnt und sagt an, auch bei gesperrtem Bildschirm
      const dk = dunkelFuer(plan);
      opt.dunkelAb = dk.dunkelAb; opt.untergang = dk.untergang ? dk.untergang.valueOf() : 0; opt.umkehrD = dk.umkehrD; opt.umkehrZeit = dk.umkehrZeit;
      // Ort des Umkehrpunkts: nach dem Umplanen legt der Dienst ihn auf die neue Strecke
      if (dk.umkehrOrt) { opt.umkehrLat = dk.umkehrOrt.lat; opt.umkehrLon = dk.umkehrOrt.lon; }
    }
    // Ausstiege [Meter ab Start, Name, Breite, Länge] für die Warnungen; kommen sie erst nach dem Start, schickt ausstiegeGeladen sie nach
    const aus = e && ausstiegeFuerPlan(plan);
    if (aus) opt.ausstiege = aus.map(a => [a.d, a.name, a.lat, a.lon]);
    try {
      const st = await Navi.starten(opt);
      anzeigen(st);
      return st;
    } catch (err) {
      melde((err && err.message) || String(err), 7);
      app.folgen = false; app.aufz = false;
      knoepfe();
      throw err;
    }
  }

  function knoepfe() {
    $('bNavi').textContent = app.folgen ? '■ Folgen beenden' : '▶ Route folgen';
    $('bAufz').textContent = app.aufz ? '■ Aufzeichnung beenden' : '⏺ Aufzeichnung starten';
    if (!app.folgen) { $('abseits').hidden = true; ebeneUmplan.clearLayers(); app.umgeplant = 0; sicherAus(); }
  }

  // der Dienst hat unterwegs neu geplant: neue Strecke holen und zeigen
  async function umplanZeigen(st) {
    if (!st.umgeplant || st.umgeplant === app.umgeplant) return;
    app.umgeplant = st.umgeplant;
    const fassung = st.umgeplant;
    try {
      const r = await Navi.route();
      // inzwischen Folgen beendet, neue Route aus der App oder schon wieder umgeplant: diese Antwort nicht zeigen
      if (!app.folgen || app.umgeplant !== fassung || !r || r.umgeplant !== fassung) return;
      ebeneUmplan.clearLayers();
      if (!r.pts || r.pts.length < 2) return;
      L.polyline(r.pts, { color: '#fff', weight: 9, opacity: 0.9, interactive: false }).addTo(ebeneUmplan);
      L.polyline(r.pts, { color: '#1a73e8', weight: 5, opacity: 0.95, interactive: false, className: 'umplan' }).addTo(ebeneUmplan);
      melde('Neu geplant ab deinem Standort zum nächsten Ziel: noch ' + R.kmText(r.laenge || 0) + '.', 6);
    } catch (err) { /* Anzeige ist Beiwerk, die Ansagen kommen vom Dienst */ }
  }

  // Spur der Aufzeichnung auf der Karte: der Dienst zeichnet auf, die Oberfläche holt nur die neuen Punkte (ab der
  // Nummer des letzten geholten), solange sie läuft höchstens alle 5 s; eine neue Aufzeichnung (anderer Start) beginnt
  // eine neue Linie. Die Linie bleibt nach dem Speichern bis zur nächsten Aufzeichnung (wie im Browser)
  const spur = { start: 0, n: 0, holt: false, zuletzt: 0 };
  function spurLinieNeu() {
    if (aufzLinie) aufzLinie.remove();
    aufzLinie = L.polyline([], { color: '#1a73e8', weight: 4, opacity: 0.85, interactive: false, className: 'aufz-spur' }).addTo(karte);
  }
  async function spurNachladen(a) {
    if (a.start && a.start !== spur.start) { spur.start = a.start; spur.n = 0; spurLinieNeu(); }
    if (spur.holt || !(a.punkte > spur.n) || (app.aufz && Date.now() - spur.zuletzt < 5000)) return;
    spur.holt = true; spur.zuletzt = Date.now();
    const start = spur.start, ab = spur.n;
    try {
      const r = await Navi.aufzeichnungHolen({ leeren: false, ab });
      if (spur.start !== start || spur.n !== ab || !aufzLinie) return;   // inzwischen neue Aufzeichnung
      const pts = r.spur || [];
      // ohne anzahl (App kennt „ab“ nicht): die ganze Spur kam, nur den neuen Teil zeichnen
      const neu = r.anzahl == null ? pts.slice(ab) : pts;
      for (const p of neu) aufzLinie.addLatLng([p[0], p[1]]);
      spur.n = r.anzahl == null ? pts.length : r.anzahl;
    } catch (e) { /* Linie ist Beiwerk, die Aufzeichnung läuft im Dienst */ } finally { spur.holt = false; }
  }

  // Stand aus dem Dienst in die Oberfläche (beim Ereignis „position“ und nach jedem Aufruf)
  function anzeigen(st) {
    if (!st) return;
    const warFolgen = app.folgen, warAufz = app.aufz;
    app.folgen = !!st.folgen; app.aufz = !!st.aufzeichnen;
    knoepfe();
    if (st.lat != null) {
      // richtung: Bewegungsrichtung aus dem GPS des Dienstes (nur beim Gehen); im Stehen zeigt der Kompass die Richtung
      posNeu({ coords: { latitude: st.lat, longitude: st.lon, accuracy: st.gen || 20, altitude: null,
        heading: st.richtung == null ? null : st.richtung, speed: st.richtung == null ? 0 : 1 }, timestamp: st.t || Date.now() });
      $('gpsStatus').textContent = (st.laeuft ? 'Dienst läuft' : 'GPS') + ' · Genauigkeit ± ' + Math.round(st.gen || 0) + ' m';
    }
    if (st.rest) {
      $('uRest').textContent = R.kmText(st.rest.meter);
      $('uZeit').textContent = R.zeitText(st.rest.stunden);
      $('uAuf').textContent = Math.round(st.rest.auf) + ' m';
      const an = new Date(Date.now() + st.rest.stunden * 3600e3);
      // weit weg (noch nicht am Start): Weg zum Start statt eines Rests ab der nächsten Stelle der Route
      const ne = naviPlan().e;
      const start = ne && ne.pts.length && st.lat != null ? R.abstand({ lat: st.lat, lon: st.lon }, ne.pts[0]) : null;
      $('uAnkunft').textContent = 'Ankunft ohne Pausen gegen ' + an.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr' +
        (st.abw == null ? '' : st.abw >= 1000 && start != null ? ' · zum Start ' + R.kmText(start) : ' · ' + Math.round(st.abw) + ' m neben der Route') +
        (st.lat != null ? sonnenHinweis(an, st.lat, st.lon) : '');
      if (st.naechster) $('uAnkunft').textContent += ' · gleich: in ' + R.kmText(st.naechster.bis) + ' ' + st.naechster.text;
      $('abseits').hidden = !st.abseits;
      if (!st.umgeplant && app.umgeplant) { ebeneUmplan.clearLayers(); app.umgeplant = 0; }   // neue Route aus der App
      umplanZeigen(st);
      if (st.abseits) $('abseits').textContent = R.abseitsText(st.abw, start);
      // Ausstieg, Umkehrzeit (die Ansage macht der Dienst), Akku aus dem Dienst
      if (app.folgen && ne) sicherZeigen({ d: Math.max(0, ne.laenge - st.rest.meter), rest: st.rest.stunden, akku: st.akku || null });
    }
    if (warFolgen && !app.folgen && st.rest && st.rest.meter < 50) melde('Ziel erreicht. Schön war’s!', 6);
    gewitterZeigen(st.gewitter || null);
    // Ausfälle des Dienstes einmal je Art melden: ohne GPS oder Sprachausgabe gibt es keine Warnung abseits der Route
    const ausfall = st.gpsFehler ? st.gpsFehler + ': die Navigation bekommt keinen Standort. In den Android-Einstellungen prüfen.'
      : st.spracheFehlt ? 'Die Sprachausgabe von Android startet nicht: es kommen keine Ansagen und keine Abseits-Warnung.' : '';
    if (ausfall && ausfall !== app.ausfall) melde(ausfall, 10);
    app.ausfall = ausfall;
    // Kopfhörer getrennt: der Dienst spricht nicht mehr, bis man die Ansagen wieder einschaltet
    if (st.stumm && !app.stumm) melde('🔇 Kopfhörer getrennt: Ansagen aus.', 8);
    app.stumm = !!st.stumm;
    $('uStumm').hidden = !st.stumm;
    if (st.aufz) {
      spurNachladen(st.aufz);
      app.kmZeiten = st.aufz.kmZeiten || [];
      app.hand = !!st.aufz.hand;
      // beendete Aufzeichnung: bis zu ihrem Ende rechnen, nicht bis jetzt
      const std = ((st.aufz.ende || Date.now()) - st.aufz.start) / 3600e3;
      aufzAnzeige({ meter: st.aufz.meter, dauer: std, bewegung: st.aufz.bewegung != null ? st.aufz.bewegung / 3600e3 : std, start: st.aufz.start,
        laeuft: app.aufz, pausiert: !!st.aufz.pause, hand: app.hand, auf: st.aufz.auf, v: st.v, ele: st.ele, kmZeiten: app.kmZeiten });
      // über „Beenden“ in der Mitteilung gestoppt: gleich speichern wie mit dem Knopf
      if (warAufz && !app.aufz && st.aufz.punkte > 1) appSpeichern();
    }
  }
  Navi.addListener('position', anzeigen);
  // Ausstiege kamen nach dem Start: an den Dienst (für die Warnungen)
  ausstiegeGeladen = () => { if (app.folgen) senden(false).catch(() => {}); };
  // Kilometer-Ansage an- oder abgeschaltet: gleich an den Dienst (läuft die Aufzeichnung schon, gilt es sofort)
  $('kmAnsage').addEventListener('change', () => { if (app.folgen || app.aufz) senden(false).catch(() => {}); });
  $('streckenziel').addEventListener('change', () => { if (app.folgen || app.aufz) senden(false).catch(() => {}); });
  $('bLaut').onclick = () => Navi.laut().then(anzeigen).catch(() => {});
  // anderer Abstand oder aus: Stopps samt Punkten neu an den Dienst
  $('punktAlarm').addEventListener('change', () => { if (app.folgen) senden(true).catch(() => {}); });


  $('bNavi').onclick = async () => {
    if (app.startet) return;   // Texte der Führung laden noch: ein zweiter Tipp darf das Folgen nicht gleich beenden
    if (app.folgen) { app.folgen = false; fuehrungAus(); await senden(false).catch(() => {}); return; }
    if (!S.ergebnis) { melde('Erst eine Route planen oder eine Tour öffnen.'); return; }
    app.startet = true;
    try {
      if ($('fuehrung').checked) $('bNavi').textContent = '… Führung wird geladen';
      await fuehrungLaden();   // Texte vorher holen: unterwegs ist oft kein Netz
      sicherStart();
      app.folgen = true;
      U.folgen = true; $('bOrt').classList.add('an');
      await senden(true).catch(() => {});
    } finally { app.startet = false; knoepfe(); }
  };

  // Beenden speichert gleich (wie im Browser); ⏸/▶ schaltet die Pause von Hand im Dienst
  $('bAufz').onclick = async () => {
    if (app.aufz) {
      app.aufz = false;
      await senden(false).catch(() => {});
      await appSpeichern();
      return;
    }
    app.aufz = true; app.gespeichert = false;
    $('aGespeichert').hidden = true; $('bAufzSpeichern').hidden = true;
    await senden(false).catch(() => {});
  };
  $('bAufzPause').onclick = () => { if (app.aufz) Navi.pause({ an: !app.hand }).then(anzeigen).catch(err => melde(err.message || String(err), 6)); };
  aktivitaetGewechselt = () => { if (app.folgen || app.aufz) senden(false).catch(() => {}); };

  // Aufzeichnung aus dem Dienst holen und als Tour speichern, danach im Dienst leeren. Höhen nachladen kann dauern:
  // solange speichert ein zweiter Aufruf nicht doppelt. Misslingt es, bleibt die Spur im Dienst und „Nochmal speichern“
  async function appSpeichern(meldung) {
    if (app.speichert || app.gespeichert) return;
    app.speichert = true;
    let fertig = false;
    try {
      const r = await Navi.aufzeichnungHolen({ leeren: false });
      const pts = (r.spur || []).map(p => { const q = { lat: p[0], lon: p[1], ele: p[2] == null ? null : p[2] }; if (p[3]) q.t = p[3]; if (p[4] === 1) q.luecke = true; return q; });
      if (pts.length < 2) { melde('Aufzeichnung zu kurz: nichts gespeichert.'); await Navi.aufzeichnungHolen({ leeren: true }); fertig = true; return; }
      if (pts.some(p => p.ele == null)) await hoehenFuellen(pts).catch(() => {});
      if (!aufzAlsTour(pts, r.start, app.kmZeiten)) return;
      fertig = true; app.gespeichert = true;
      await Navi.aufzeichnungHolen({ leeren: true });
      if (meldung) melde(meldung + '.', 7);
    } catch (e) {
      if (!fertig) melde('Aufzeichnung nicht gespeichert: ' + (e && e.message || e));
    } finally {
      app.speichert = false;
      $('bAufzSpeichern').hidden = fertig;
    }
  }
  $('bAufzSpeichern').onclick = () => appSpeichern();

  // anderer Tag einer Mehrtagestour gewählt, während der Dienst folgt: neue Route nachreichen
  naviEtappeGewechselt = () => { if (app.folgen && S.ergebnis) senden(true).catch(() => {}); };
  // Wird die Route geändert, während der Dienst ihr folgt: neue Route nachreichen
  const altesAuswerten = auswertenUndZeigen;
  auswertenUndZeigen = function () {
    altesAuswerten();
    if (app.folgen && S.ergebnis) senden(planKennung() !== app.plan).catch(() => {});
  };

  // GPX: WebView kann nichts herunterladen, darum über das Teilen-Menü (z. B. an CoMaps, Drive, Mail)
  // Standort im Notfall: Text über das Teilen-Menü (SMS, Messenger, Mail)
  // Original in die Galerie: der Dienst kann das erst ab Android 10 (MediaStore ohne Speicher-Erlaubnis); darunter weder
  // Schalter noch Versuch, sonst käme bei jedem Kamerafoto eine Fehlermeldung
  const androidVersion = +((navigator.userAgent.match(/Android (\d+)/) || [])[1] || 0);
  if (androidVersion >= 10) {
    fotoInGalerie = (daten, name, mime) => Navi.fotoInGalerie({ daten, name, mime });
    $('tbGalerieFeld').hidden = false;
  }
  // Vorlesen über die Sprachausgabe von Android (die des WebViews ist nicht verlässlich)
  vorlesen = text => { Navi.vorlesen({ text }).catch(err => melde(err.message || String(err), 6)); };
  vorlesenStopp = () => { Navi.vorlesenStopp().catch(() => {}); };
  textTeilen = function (text) {
    return Navi.textTeilen({ text }).catch(err => melde(err.message || String(err), 6));
  };
  dateiAusgeben = function (datei, text, mime) {
    Navi.teilen({ name: datei, text, mime }).catch(err => melde(err.message || String(err), 6));
  };
  // große Datei (Sicherung als ZIP): in Stücken zu 3 MB an die App, dann über das Teilen-Menü; Fehler gehen an den Aufrufer
  blobAusgeben = async function (datei, blob, mime) {
    const STUECK = 3 * 1024 * 1024;
    for (let i = 0; i === 0 || i < blob.size; i += STUECK) {
      const daten = await new Promise((ok, nein) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => nein(r.error); r.readAsDataURL(blob.slice(i, i + STUECK)); });
      await Navi.dateiStueck({ name: datei, daten, erstes: i === 0 });
    }
    await Navi.teilen({ name: datei, mime, entwurf: true });
  };
  // Erinnerung nach der geplanten Rückkehr als Mitteilung von Android, auch bei geschlossener App
  bescheidMitteilung = (bis, name) => {
    Navi.erinnern({ zeit: bis, titel: 'Bist du gut angekommen?', text: (name ? name + ': ' : '') + 'geplante Rückkehr ' + R.uhr(new Date(bis)) + ' Uhr ist vorbei. Antippen und „Ankunft melden“.' })
      .then(r => { if (r && r.mitteilungen === false) melde('Ohne Erlaubnis für Mitteilungen kommt die Erinnerung nur beim Öffnen der App.', 7); })
      .catch(err => melde('Erinnerung nicht gestellt: ' + (err.message || err), 6));
  };
  bescheidMitteilungAus = () => { Navi.erinnernAus().catch(() => {}); };
  // Notsignal mit der Taschenlampe; geht sie nicht, blinkt der Bildschirm
  notsignalLampe = an => { Navi.lampe({ an }).catch(() => { $('notsignalBlitz').hidden = !an; }); };
  fotoTeilen = async function (blob, name, text) {
    const daten = await new Promise((ok, nein) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = () => nein(r.error); r.readAsDataURL(blob); });
    return Navi.teilen({ name, daten, mime: blob.type || 'image/jpeg', text }).catch(err => melde(err.message || String(err), 6));
  };

  // Zurück-Taste von Android (MainActivity fragt hier nach): erst Fenster, Kartenwahl, Suche und großes Blatt schließen,
  // dann zum Reiter Planen; erst danach geht die App in den Hintergrund (Navigation läuft weiter)
  window.gugZurueck = function () {
    if (!$('menue').hidden) { menue(false); return true; }
    if (bildZu()) return true;
    if (document.querySelector('.leaflet-popup')) { karte.closePopup(); return true; }
    if (!$('lagenwahl').hidden) { $('lagenwahl').hidden = true; return true; }
    if (kreuzAn) { kreuz(false); return true; }
    if ($('treffer').children.length) { sucheSchliessen(); return true; }
    if ($('panel').classList.contains('gross')) { blatt('mittel'); return true; }
    // eine Tour zurück zur Liste, Touren, Tagebuch, Reiseziele und Gipfelbuch zurück zu „Ich“, alles andere zum Planen
    if (seite === 'tour') { reiter('touren'); return true; }
    if (['touren', 'gegangen', 'tagebuch', 'ziele', 'gipfelbuch', 'fotos'].includes(seite)) { reiter('ich'); return true; }
    if (seite !== 'planen' && seite !== 'karte') { reiter('planen'); return true; }
    return false;
  };

  // Drucken: Druckdialog von Android; das Versprechen erfüllt sich, wenn der Dialog fertig ist
  window.print = () => Navi.drucken({ name: druckName || (S.name || '').trim() || 'Gipfel und Gasse' });

  // Nach dem Öffnen der App: läuft der Dienst schon (z. B. nach dem Wischen aus der Übersicht)?
  Navi.status().then(st => {
    anzeigen(st);
    if (st.fortgesetzt) { reiter('unterwegs'); melde('Android hatte die App beendet: Navigation und Aufzeichnung laufen jetzt weiter.', 8); }
    else if (st.unterbrochenAlt) { reiter('unterwegs'); melde('Android hatte die App unterwegs beendet. Die Navigation ist zu lange her und läuft nicht weiter; eine Aufzeichnung endet an der Unterbrechung.', 10); }
    else if (st.folgen || st.aufzeichnen) { reiter('unterwegs'); melde('Navigation läuft im Hintergrund weiter.'); }
    if (!st.aufzeichnen) {
      Navi.aufzeichnungHolen({ leeren: false }).then(r => {
        if (r.spur && r.spur.length > 1) {
          // nach einem Neustart des Dienstes kommt die Spur aus seiner Datei: auch auf die Karte
          if (!aufzLinie || !aufzLinie.getLatLngs().length) {
            spur.start = r.start || spur.start; spur.n = r.spur.length; spurLinieNeu();
            aufzLinie.setLatLngs(r.spur.map(p => [p[0], p[1]]));
          }
          // beendet, aber noch nicht gespeichert (z. B. vor dieser Fassung oder über die Mitteilung bei geschlossener App)
          appSpeichern('Aufzeichnung von ' + new Date(r.start || r.spur[0][3] || Date.now()).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' Uhr gespeichert');
        }
      }).catch(() => {});
    }
  }).catch(() => {});
}
