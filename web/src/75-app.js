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
    '„Sicherung speichern“ gibt alle Touren samt Planung als eine Datei weiter (z. B. an Drive oder per Mail); „Sicherung laden“ holt sie zurück.';

  // Stopps mit Namen und Besichtigungszeit: an welchem Meter der Route sie liegen
  function stoppsFuerApp() {
    const e = S.ergebnis;
    if (!e || S.fest) return [];
    const out = [];
    S.wps.forEach((w, i) => {
      if (i === 0 || !w.name) return;
      out.push({ d: e.stueckEnde[i - 1], name: w.name, min: +w.min || 0 });
    });
    return out;
  }

  // Kennung des Plans, der zuletzt an den Dienst ging: Neuberechnungen ohne Planänderung (z. B. anderes Tempo) schicken
  // nur Einstellungen, sonst ersetzte die geplante Strecke eine unterwegs umgeplante
  const planKennung = () => JSON.stringify([S.wps, S.profil, S.fest, S.ergebnis ? S.ergebnis.pts.length : 0, S.ergebnis ? S.ergebnis.laenge : 0]);
  async function senden(mitRoute) {
    const e = S.ergebnis;
    if (mitRoute && e) app.plan = planKennung();
    // beim Laufen ist tempo das Lauftempo (min/km); kmAnsage: jeden Kilometer der Aufzeichnung Zeit und Tempo ansagen
    const opt = { tempo: tempoAktuell(), rad: artAktuell() === 'rad', lauf: artAktuell() === 'lauf', kmAnsage: $('kmAnsage').checked,
      ansagen: true, folgen: app.folgen, aufzeichnen: app.aufz };
    if (mitRoute && e) {
      // vierter Wert 1: Punkt beginnt einen neuen Abschnitt (mehrteilige GPX-Spur), der Sprung ist kein Weg
      opt.pts = e.pts.map(p => [p.lat, p.lon, p.ele == null ? null : p.ele, p.luecke ? 1 : 0]);
      opt.stopps = stoppsFuerApp();
      // Abbiegehinweise für die Ansagen: [Meter ab Start, Befehl, Ausfahrt]
      opt.hinweise = S.fest ? [] : (e.hinweise || []).map(h => [h.d, h.cmd, h.exit]);
      // fürs Umplanen unterwegs: alle Ziele nach dem Start [Breite, Länge, Meter ab Start, Minuten, Name] und das Profil;
      // eine geöffnete Spur (GPX) oder gerade Linien werden nicht umgeplant
      const prof = (PROFILE[S.profil] || PROFILE.wandern).brouter;
      opt.profil = S.fest || !prof ? null : prof;
      opt.ziele = S.fest ? [] : S.wps.slice(1).map((w, i) => [w.lat, w.lon, e.stueckEnde[i], +w.min || 0, w.name || '']);
    }
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
    if (!app.folgen) { $('abseits').hidden = true; ebeneUmplan.clearLayers(); app.umgeplant = 0; }
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
      const start = S.ergebnis && S.ergebnis.pts.length && st.lat != null ? R.abstand({ lat: st.lat, lon: st.lon }, S.ergebnis.pts[0]) : null;
      $('uAnkunft').textContent = 'Ankunft ohne Pausen gegen ' + an.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr' +
        (st.abw == null ? '' : st.abw >= 1000 && start != null ? ' · zum Start ' + R.kmText(start) : ' · ' + Math.round(st.abw) + ' m neben der Route') +
        (st.lat != null ? sonnenHinweis(an, st.lat, st.lon) : '');
      if (st.naechster) $('uAnkunft').textContent += ' · gleich: in ' + R.kmText(st.naechster.bis) + ' ' + st.naechster.text;
      $('abseits').hidden = !st.abseits;
      if (!st.umgeplant && app.umgeplant) { ebeneUmplan.clearLayers(); app.umgeplant = 0; }   // neue Route aus der App
      umplanZeigen(st);
      if (st.abseits) $('abseits').textContent = R.abseitsText(st.abw, start);
    }
    if (warFolgen && !app.folgen && st.rest && st.rest.meter < 50) melde('Ziel erreicht. Schön war’s!', 6);
    if (st.aufz) {
      $('aStrecke').textContent = R.kmText(st.aufz.meter);
      // beendete Aufzeichnung: bis zu ihrem Ende rechnen, nicht bis jetzt
      $('aDauer').textContent = R.zeitText(((st.aufz.ende || Date.now()) - st.aufz.start) / 3600e3, true);
      // auch wenn sie über „Beenden“ in der Mitteilung gestoppt wurde: jetzt speicherbar
      if (warAufz && !app.aufz && st.aufz.punkte > 1) $('bAufzSpeichern').disabled = false;
      $('aAuf').textContent = Math.round(st.aufz.auf) + ' m';
      const std = ((st.aufz.ende || Date.now()) - st.aufz.start) / 3600e3;
      $('aTempo').textContent = st.aufz.meter > 50 ? R.paceText(std * 60 / (st.aufz.meter / 1000)) : '–';
    }
  }
  Navi.addListener('position', anzeigen);
  // Kilometer-Ansage an- oder abgeschaltet: gleich an den Dienst (läuft die Aufzeichnung schon, gilt es sofort)
  $('kmAnsage').addEventListener('change', () => { if (app.folgen || app.aufz) senden(false).catch(() => {}); });
  // Art gewechselt (z. B. auf Laufen, das die Kilometer-Ansage einschaltet) während einer Aufzeichnung ohne Routenführung:
  // Einstellungen gleich an den Dienst; mit Routenführung schickt die Neuberechnung sie mit
  $('profilwahl').addEventListener('change', () => { if (app.aufz && !app.folgen) senden(false).catch(() => {}); });

  $('bNavi').onclick = async () => {
    if (app.folgen) { app.folgen = false; await senden(false).catch(() => {}); return; }
    if (!S.ergebnis) { melde('Erst eine Route planen oder eine Tour öffnen.'); return; }
    app.folgen = true;
    U.folgen = true; $('bOrt').classList.add('an');
    await senden(true).catch(() => {});
  };

  $('bAufz').onclick = async () => {
    if (app.aufz) {
      app.aufz = false;
      await senden(false).catch(() => {});
      $('bAufzSpeichern').disabled = false;
      return;
    }
    app.aufz = true;
    $('bAufzSpeichern').disabled = true;
    $('bAufzSpeichern').textContent = '💾 Als Tour speichern';
    await senden(false).catch(() => {});
  };

  $('bAufzSpeichern').onclick = async () => {
    const r = await Navi.aufzeichnungHolen({ leeren: false });
    const pts = (r.spur || []).map(p => { const q = { lat: p[0], lon: p[1], ele: p[2] == null ? null : p[2] }; if (p[3]) q.t = p[3]; return q; });
    if (pts.length < 2) { melde('Die Aufzeichnung hat zu wenige Punkte.'); return; }
    if (pts.some(p => p.ele == null)) await hoehenFuellen(pts);
    const name = 'Aufzeichnung ' + new Date(r.start || pts[0].t || Date.now()).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    if (!spurAlsTour(name, pts, 'aufzeichnung')) return;
    await Navi.aufzeichnungHolen({ leeren: true });
    $('bAufzSpeichern').disabled = true;
    $('bAufzSpeichern').textContent = '✓ In „Gegangene Touren“';
  };

  // Wird die Route geändert, während der Dienst ihr folgt: neue Route nachreichen
  const altesAuswerten = auswertenUndZeigen;
  auswertenUndZeigen = function () {
    altesAuswerten();
    if (app.folgen && S.ergebnis) senden(planKennung() !== app.plan).catch(() => {});
  };

  // GPX: WebView kann nichts herunterladen, darum über das Teilen-Menü (z. B. an CoMaps, Drive, Mail)
  // Standort im Notfall: Text über das Teilen-Menü (SMS, Messenger, Mail)
  fotoInGalerie = (daten, name, mime) => Navi.fotoInGalerie({ daten, name, mime });
  document.querySelectorAll('.nur-app').forEach(e => { e.hidden = false; });
  textTeilen = function (text) {
    return Navi.textTeilen({ text }).catch(err => melde(err.message || String(err), 6));
  };
  dateiAusgeben = function (datei, text, mime) {
    Navi.teilen({ name: datei, text, mime }).catch(err => melde(err.message || String(err), 6));
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
    if (seite !== 'planen' && seite !== 'karte') { reiter('planen'); return true; }
    return false;
  };

  // Drucken: Druckdialog von Android; das Versprechen erfüllt sich, wenn der Dialog fertig ist
  window.print = () => Navi.drucken({ name: (S.name || '').trim() || 'Gipfel und Gasse' });

  // Nach dem Öffnen der App: läuft der Dienst schon (z. B. nach dem Wischen aus der Übersicht)?
  Navi.status().then(st => {
    anzeigen(st);
    if (st.folgen || st.aufzeichnen) { reiter('unterwegs'); melde('Navigation läuft im Hintergrund weiter.'); }
    if (!st.aufzeichnen) {
      Navi.aufzeichnungHolen({ leeren: false }).then(r => {
        if (r.spur && r.spur.length > 1) {
          $('bAufzSpeichern').disabled = false;
          melde('Eine Aufzeichnung wartet noch aufs Speichern (Reiter Unterwegs).', 6);
        }
      }).catch(() => {});
    }
  }).catch(() => {});
}
