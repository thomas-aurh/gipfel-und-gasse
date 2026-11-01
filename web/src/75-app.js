// In der Android-App: Route folgen und Aufzeichnen übernimmt der native Navigationsdienst (läuft auch bei gesperrtem
// Bildschirm, spricht Ansagen); GPX geht über das Teilen-Menü, Drucken über den Druckdialog von Android.
// Im Browser tut diese Datei nichts.
if (NATIV) {
  const Navi = window.Capacitor.registerPlugin('Navi');
  const app = { folgen: false, aufz: false };

  document.body.classList.add('app');
  // „Link teilen“ zeigt in der App auf die lokale Adresse der App, die niemand sonst öffnen kann: ausblenden, GPX nehmen
  $('bTeilen').hidden = true;
  $('unterwegsHinweis').innerHTML = 'Läuft auch bei <b>gesperrtem Bildschirm</b>: Android zeigt dann die Mitteilung „Navigation läuft“, ' +
    'dort lässt sie sich auch beenden. Ansagen kommen über die Sprachausgabe des Handys. Die Karte selbst braucht noch Netz; ' +
    'Offline-Karten kommen als nächster Ausbau.';

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

  async function senden(mitRoute) {
    const e = S.ergebnis;
    const opt = { tempo: S.tempo, rad: (PROFILE[S.profil] || PROFILE.wandern).art === 'rad', ansagen: true, folgen: app.folgen, aufzeichnen: app.aufz };
    if (mitRoute && e) {
      // vierter Wert 1: Punkt beginnt einen neuen Abschnitt (mehrteilige GPX-Spur), der Sprung ist kein Weg
      opt.pts = e.pts.map(p => [p.lat, p.lon, p.ele == null ? null : p.ele, p.luecke ? 1 : 0]);
      opt.stopps = stoppsFuerApp();
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
    if (!app.folgen) $('abseits').hidden = true;
  }

  // Stand aus dem Dienst in die Oberfläche (beim Ereignis „position“ und nach jedem Aufruf)
  function anzeigen(st) {
    if (!st) return;
    const warFolgen = app.folgen, warAufz = app.aufz;
    app.folgen = !!st.folgen; app.aufz = !!st.aufzeichnen;
    knoepfe();
    if (st.lat != null) {
      posNeu({ coords: { latitude: st.lat, longitude: st.lon, accuracy: st.gen || 20, altitude: null }, timestamp: st.t || Date.now() });
      $('gpsStatus').textContent = (st.laeuft ? 'Dienst läuft' : 'GPS') + ' · Genauigkeit ± ' + Math.round(st.gen || 0) + ' m';
    }
    if (st.rest) {
      $('uRest').textContent = R.kmText(st.rest.meter);
      $('uZeit').textContent = R.zeitText(st.rest.stunden);
      $('uAuf').textContent = Math.round(st.rest.auf) + ' m';
      const an = new Date(Date.now() + st.rest.stunden * 3600e3);
      $('uAnkunft').textContent = 'Ankunft ohne Pausen gegen ' + an.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr' +
        (st.abw != null ? ' · ' + Math.round(st.abw) + ' m neben der Route' : '');
      $('abseits').hidden = !st.abseits;
      if (st.abseits) $('abseits').textContent = 'Du bist ' + Math.round(st.abw) + ' m neben der Route';
    }
    if (warFolgen && !app.folgen && st.rest && st.rest.meter < 50) melde('Ziel erreicht. Schön war’s!', 6);
    if (st.aufz) {
      $('aStrecke').textContent = R.kmText(st.aufz.meter);
      // beendete Aufzeichnung: bis zu ihrem Ende rechnen, nicht bis jetzt
      $('aDauer').textContent = R.zeitText(((st.aufz.ende || Date.now()) - st.aufz.start) / 3600e3, true);
      // auch wenn sie über „Beenden“ in der Mitteilung gestoppt wurde: jetzt speicherbar
      if (warAufz && !app.aufz && st.aufz.punkte > 1) $('bAufzSpeichern').disabled = false;
      $('aAuf').textContent = Math.round(st.aufz.auf) + ' m';
    }
  }
  Navi.addListener('position', anzeigen);

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
    $('bAufzSpeichern').textContent = '✓ In „Touren“';
  };

  // Wird die Route geändert, während der Dienst ihr folgt: neue Route nachreichen
  const altesAuswerten = auswertenUndZeigen;
  auswertenUndZeigen = function () {
    altesAuswerten();
    if (app.folgen && S.ergebnis) senden(true).catch(() => {});
  };

  // GPX: WebView kann nichts herunterladen, darum über das Teilen-Menü (z. B. an CoMaps, Drive, Mail)
  gpxHerunter = function (name, pts, wps) {
    Navi.teilen({ name: dateiname(name) + '.gpx', text: R.gpxSchreiben(name, pts, wps), mime: 'application/gpx+xml' })
      .catch(err => melde(err.message || String(err), 6));
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
