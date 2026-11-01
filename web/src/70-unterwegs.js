// Unterwegs: Standort, der Route folgen, Aufzeichnen
const U = { fortschritt: null, naviStart: 0, watch: null, pos: null, folgen: false, navi: false, aufz: null, abseitsSeit: 0, gewarnt: false, wach: null, ersterFix: true };
let ichMarke = null, ichKreis = null, aufzLinie = null;

function gpsAn() {
  if (U.watch != null) return true;
  if (!('geolocation' in navigator)) { melde('Dieser Browser kennt kein GPS.'); return false; }
  $('gpsStatus').textContent = 'Suche GPS …';
  U.watch = navigator.geolocation.watchPosition(posNeu, err => {
    const t = { 1: 'Standort nicht erlaubt. In den Einstellungen des Browsers freigeben.', 2: 'Kein GPS-Empfang.', 3: 'GPS antwortet nicht.' }[err.code] || err.message;
    $('gpsStatus').textContent = t;
    if (err.code === 1) {
      if (U.navi) $('bNavi').click();
      if (U.aufz && U.aufz.laeuft) $('bAufz').click();
      gpsAus(); melde(t, 6); $('gpsStatus').textContent = t;
    }
  }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
  return true;
}
function gpsAus() {
  if (U.watch != null) navigator.geolocation.clearWatch(U.watch);
  U.watch = null; U.folgen = false; U.ersterFix = true;
  ebeneIch.clearLayers(); ichMarke = ichKreis = null;
  $('bOrt').classList.remove('an');
  $('gpsStatus').textContent = 'GPS aus.';
}

function posNeu(p) {
  const c = p.coords;
  U.pos = { lat: c.latitude, lon: c.longitude, ele: c.altitude, gen: c.accuracy, t: p.timestamp };
  const ll = [c.latitude, c.longitude];
  if (!ichMarke) {
    ichKreis = L.circle(ll, { radius: c.accuracy, color: '#1a73e8', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(ebeneIch);
    ichMarke = L.marker(ll, { interactive: false, icon: L.divIcon({ className: '', html: '<div class="ich"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(ebeneIch);
  } else { ichMarke.setLatLng(ll); ichKreis.setLatLng(ll).setRadius(c.accuracy); }
  $('gpsStatus').textContent = 'GPS an · Genauigkeit ± ' + Math.round(c.accuracy) + ' m';
  if (U.ersterFix) { U.ersterFix = false; karte.setView(ll, Math.max(karte.getZoom(), 15)); }
  else if (U.folgen) karte.panTo(ll, { animate: true });
  if (U.navi) naviNeu();
  if (U.aufz) aufzNeu();
}

$('bOrt').onclick = () => {
  if (U.watch == null) { if (gpsAn()) { U.folgen = true; $('bOrt').classList.add('an'); } return; }
  if (!U.folgen) { U.folgen = true; $('bOrt').classList.add('an'); if (U.pos) karte.setView([U.pos.lat, U.pos.lon], Math.max(karte.getZoom(), 15)); return; }
  if (U.navi || aufzLaeuft()) { U.folgen = false; $('bOrt').classList.remove('an'); return; }
  gpsAus();
};
// wer die Karte selbst verschiebt, will nicht mitgezogen werden
karte.on('dragstart', () => { if (U.folgen) { U.folgen = false; $('bOrt').classList.remove('an'); } });

async function wachHalten(an) {
  try {
    if (an && !U.wach && navigator.wakeLock) { U.wach = await navigator.wakeLock.request('screen'); U.wach.addEventListener('release', () => { U.wach = null; }); }
    if (!an && U.wach) { await U.wach.release(); U.wach = null; }
  } catch (e) { /* nicht jeder Browser erlaubt das */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && (U.navi || aufzLaeuft())) wachHalten(true); });
function aufzLaeuft() { return !!(U.aufz && U.aufz.laeuft); }

// ---------- der Route folgen ----------
$('bNavi').onclick = () => {
  if (U.navi) { U.navi = false; $('bNavi').textContent = '▶ Route folgen'; $('abseits').hidden = true; if (!aufzLaeuft()) wachHalten(false); return; }
  if (!S.ergebnis) { melde('Erst eine Route planen oder eine Tour öffnen.'); return; }
  if (!gpsAn()) return;
  U.navi = true; U.folgen = true; U.gewarnt = false; U.fortschritt = null; U.naviStart = Date.now(); $('bOrt').classList.add('an');
  $('bNavi').textContent = '■ Folgen beenden';
  wachHalten(true);
  if (U.pos) naviNeu();
};

function naviNeu() {
  const e = S.ergebnis;
  if (!e || !U.pos) return;
  const lage = R.aufStrecke(e.pts, U.pos, U.fortschritt);
  if (lage.abw < 80) U.fortschritt = lage.d;
  const rest = R.rest(e.pts, lage.d, S.tempo, (PROFILE[S.profil] || PROFILE.wandern).art);
  $('uRest').textContent = R.kmText(rest.meter);
  // noch offene Stopps: deren Teilstück endet hinter der aktuellen Stelle
  const offenAb = (e.stueckEnde || []).findIndex(d => d > lage.d + 20);
  const besicht = S.fest || offenAb < 0 ? 0 : besichtigung(offenAb + 1);
  rest.zeit += besicht / 60;
  $('uZeit').textContent = R.zeitText(rest.zeit);
  $('uAuf').textContent = rest.auf + ' m';
  const an = new Date(Date.now() + rest.zeit * 3600e3);
  // noch nicht auf der Route (z. B. Anfahrt): der Rest gilt erst ab dem Start, darum den Weg dorthin nennen
  const weit = U.fortschritt == null && lage.abw >= 300;
  $('uAnkunft').textContent = 'Ankunft ohne Pausen gegen ' + an.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr · ' +
    (weit ? 'noch nicht auf der Route, zum Start ' + R.kmText(R.abstand(U.pos, e.pts[0])) : Math.round(lage.abw) + ' m neben der Route');
  const naechster = (e.hinweise || []).find(h => h.d > lage.d + 5);
  if (naechster && naechster.d - lage.d < 1000) $('uAnkunft').textContent += ' · gleich: in ' + R.kmText(naechster.d - lage.d) + ' ' + R.hinweisText(naechster.cmd, naechster.exit);
  // abseits: mehr als 50 m (oder die GPS-Ungenauigkeit) für 15 s
  const grenze = Math.max(50, (U.pos.gen || 0) * 1.5);
  if (lage.abw > grenze) {
    if (!U.abseitsSeit) U.abseitsSeit = Date.now();
    if (Date.now() - U.abseitsSeit > 15000) {
      $('abseits').hidden = false;
      $('abseits').textContent = R.abseitsText(lage.abw, U.fortschritt == null ? R.abstand(U.pos, e.pts[0]) : null);
      if (!U.gewarnt && navigator.vibrate) navigator.vibrate([200, 100, 200]);
      U.gewarnt = true;
    }
  } else { U.abseitsSeit = 0; U.gewarnt = false; $('abseits').hidden = true; }
  if (rest.meter < 30 && lage.abw < 40 && lage.d > e.laenge / 2 && Date.now() - U.naviStart > 60000) { melde('Ziel erreicht. Schön war’s!', 6); $('bNavi').click(); }
}

// ---------- Aufzeichnen ----------
$('bAufz').onclick = () => {
  if (U.aufz && U.aufz.laeuft) {
    U.aufz.laeuft = false; U.aufz.ende = Date.now();
    $('bAufz').textContent = '⏺ Neue Aufzeichnung';
    $('bAufzSpeichern').disabled = U.aufz.pts.length < 2;
    if (!U.navi) wachHalten(false);
    aufzZahlen();
    return;
  }
  if (!gpsAn()) return;
  U.aufz = { laeuft: true, start: Date.now(), ende: null, pts: [] };
  $('bAufzSpeichern').textContent = '💾 Als Tour speichern';
  if (aufzLinie) aufzLinie.remove();
  aufzLinie = L.polyline([], { color: '#1a73e8', weight: 4, opacity: 0.85, interactive: false }).addTo(karte);
  U.folgen = true; $('bOrt').classList.add('an');
  $('bAufz').textContent = '■ Aufzeichnung beenden';
  $('bAufzSpeichern').disabled = true;
  wachHalten(true);
  if (U.pos) aufzNeu();
};

function aufzNeu() {
  const a = U.aufz;
  if (!a || !a.laeuft || !U.pos) return;
  if (U.pos.gen > 40) return;                     // zu ungenau
  const p = { lat: U.pos.lat, lon: U.pos.lon, ele: U.pos.ele, t: U.pos.t };
  const letzt = a.pts[a.pts.length - 1];
  if (letzt && R.abstand(letzt, p) < Math.max(8, U.pos.gen / 2)) return;   // stehen bleiben zählt nicht als Weg
  a.pts.push(p);
  aufzLinie.addLatLng([p.lat, p.lon]);
  aufzZahlen();
}

function aufzZahlen() {
  const a = U.aufz;
  if (!a) return;
  const pts = a.pts.map(p => Object.assign({}, p));
  const m = R.laengen(pts);
  $('aStrecke').textContent = R.kmText(m);
  const dauer = ((a.ende || Date.now()) - a.start) / 3600e3;
  $('aDauer').textContent = R.zeitText(dauer, true);
  $('aAuf').textContent = R.hoehenmeter(pts.map(p => p.ele), 8).auf + ' m';
}
setInterval(() => { if (U.aufz && U.aufz.laeuft) aufzZahlen(); }, 30000);

$('bAufzSpeichern').onclick = async () => {
  const a = U.aufz;
  if (!a || a.pts.length < 2) return;
  const pts = a.pts.map(p => Object.assign({}, p));
  // GPS-Höhen schwanken stark; wo sie fehlen, das Höhenmodell nehmen
  if (pts.some(p => p.ele == null)) await hoehenFuellen(pts);
  const name = 'Aufzeichnung ' + new Date(a.start).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  if (!spurAlsTour(name, pts, 'aufzeichnung')) return;
  $('bAufzSpeichern').disabled = true;
  $('bAufzSpeichern').textContent = '✓ In „Touren“';
  setTimeout(() => { $('bAufzSpeichern').textContent = '💾 Als Tour speichern'; }, 4000);
};
