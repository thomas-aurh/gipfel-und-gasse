// Unterwegs: Standort, der Route folgen, Aufzeichnen
const U = { fortschritt: null, naviStart: 0, watch: null, pos: null, folgen: false, navi: false, aufz: null, abseitsSeit: 0, gewarnt: false, wach: null, ersterFix: true };
let ichMarke = null, ichKreis = null, aufzLinie = null;

function gpsAn() {
  if (U.watch != null) return true;
  // iPhone: Kompass nur nach Rückfrage, und die muss aus einem Tipp kommen (Standort, Route folgen, Aufzeichnen)
  if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().catch(() => {});
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
  kompassAus();
  $('bOrt').classList.remove('an');
  $('gpsStatus').textContent = 'GPS aus.';
}

function posNeu(p) {
  const c = p.coords;
  U.pos = { lat: c.latitude, lon: c.longitude, ele: c.altitude, gen: c.accuracy, t: p.timestamp };
  const ll = [c.latitude, c.longitude];
  if (!ichMarke) {
    ichKreis = L.circle(ll, { radius: c.accuracy, color: '#1a73e8', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(ebeneIch);
    ichMarke = L.marker(ll, { interactive: false, icon: L.divIcon({ className: '', html: '<div class="ich"><div class="ich-pfeil" hidden></div></div>', iconSize: [18, 18], iconAnchor: [9, 9] }) }).addTo(ebeneIch);
    kompassAn();
    blickZeigen();
  } else { ichMarke.setLatLng(ll); ichKreis.setLatLng(ll).setRadius(c.accuracy); }
  // beim Gehen ohne Kompass: Bewegungsrichtung aus dem GPS
  // (im Stehen ohne Kompass gibt es keine Richtung: dann Pfeil weg statt der alten Gehrichtung)
  const kompassFrisch = Date.now() - BLICK.kompassSeit <= 3000;
  if (!kompassFrisch) {
    if (c.heading != null && isFinite(c.heading) && (c.speed || 0) > 0.7) blickSetzen(c.heading);
    else if (BLICK.grad != null) { BLICK.grad = null; blickZeigen(); }
  }
  $('gpsStatus').textContent = 'GPS an · Genauigkeit ± ' + Math.round(c.accuracy) + ' m';
  if (U.ersterFix) { U.ersterFix = false; karte.setView(ll, Math.max(karte.getZoom(), 15)); }
  else if (U.folgen) karte.panTo(ll, { animate: true });
  if (U.navi) naviNeu();
  if (U.aufz) aufzNeu(c);
  notfallZeigen();
}

// ---------- Blickrichtung: Pfeil am Standortpunkt ----------
// Kompass des Geräts (wohin das Handy zeigt); ohne Kompass beim Gehen die GPS-Richtung. Unbekannt: Punkt ohne Pfeil.
const BLICK = { grad: null, gedreht: null, kompassSeit: 0, an: false, rahmen: 0 };
function blickSetzen(grad) {
  if (BLICK.grad != null && Math.abs(((grad - BLICK.grad + 540) % 360) - 180) < 2) return;   // Zittern unter 2° nicht zeigen
  BLICK.grad = (grad + 360) % 360;
  if (!BLICK.rahmen) BLICK.rahmen = requestAnimationFrame(() => { BLICK.rahmen = 0; blickZeigen(); });
}
function blickZeigen() {
  const m = ichMarke && ichMarke.getElement();
  const pf = m && m.querySelector('.ich-pfeil');
  if (!pf) return;
  pf.hidden = BLICK.grad == null;
  if (BLICK.grad == null) { BLICK.gedreht = null; return; }
  // fortlaufender Winkel: von 358° auf 1° dreht der Pfeil 3° weiter, nicht 357° zurück (die Drehung ist animiert)
  BLICK.gedreht = BLICK.gedreht == null ? BLICK.grad : BLICK.gedreht + ((BLICK.grad - BLICK.gedreht % 360 + 540) % 360) - 180;
  pf.style.transform = 'rotate(' + Math.round(BLICK.gedreht) + 'deg)';
}
function kompassEreignis(e) {
  let g = null;
  if (typeof e.webkitCompassHeading === 'number') g = e.webkitCompassHeading;          // iPhone
  else if (e.absolute && e.alpha != null) g = 360 - e.alpha;                            // Android: alpha gegen den Uhrzeigersinn ab Nord
  if (g == null || !isFinite(g)) return;
  const dreh = (screen.orientation && screen.orientation.angle) || 0;                    // Querformat: Oberkante des Bildschirms zählt
  BLICK.kompassSeit = Date.now();
  blickSetzen(g + dreh);
}
const KOMPASS = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
function kompassAn() {
  if (BLICK.an) return;
  BLICK.an = true;
  window.addEventListener(KOMPASS, kompassEreignis);
}
function kompassAus() {
  window.removeEventListener(KOMPASS, kompassEreignis);
  BLICK.an = false; BLICK.grad = null; BLICK.gedreht = null; BLICK.kompassSeit = 0;
}

// ---------- Notfall: Standort zum Vorlesen und Senden ----------
const FRISCH = 2 * 60000;   // so alt darf ein Standort sein, der als „Mein Standort“ hinausgeht
function standortFrisch() { return !!(U.pos && U.pos.t && Date.now() - U.pos.t < FRISCH); }
function notfallZeigen() {
  const p = U.pos;
  if (!p) return;
  const alt = !standortFrisch();
  $('notfallOrt').innerHTML = '<b>' + p.lat.toFixed(5) + ', ' + p.lon.toFixed(5) + '</b><br>' + R.esc(R.gradMinSek(p.lat, 'N', 'S') + ' · ' + R.gradMinSek(p.lon, 'O', 'W')) +
    '<br>' + (p.ele != null && isFinite(p.ele) ? 'Höhe etwa ' + Math.round(p.ele) + ' m · ' : '') + 'Genauigkeit ± ' + Math.round(p.gen || 0) + ' m' +
    (p.t ? ' · Stand ' + R.uhr(new Date(p.t)) + ' Uhr' : '') + (alt ? ' · <b>nicht aktuell</b>' : '');
}
// auf einen frischen Standort warten (GPS wird bei Bedarf eingeschaltet); true, wenn er rechtzeitig kommt
async function frischerStandort(ms) {
  if (standortFrisch()) return true;
  if (U.watch == null) gpsAn();
  $('notfallOrt').textContent = 'Standort wird bestimmt …';
  const bis = Date.now() + ms;
  while (Date.now() < bis) { await new Promise(r => setTimeout(r, 500)); if (standortFrisch()) return true; }
  notfallZeigen();
  return false;
}
// Text weitergeben: im Browser über das Teilen-Menü oder die Zwischenablage; die App nimmt das Teilen-Menü von Android
async function textTeilen(text) {
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); melde('Standort kopiert: in eine SMS oder Nachricht einfügen.', 6); }
  catch (e) { melde(text, 12); }
}
$('bStandortHolen').onclick = async () => {
  if (await frischerStandort(20000)) { notfallZeigen(); melde('Standort ist aktuell.'); }
  else melde(U.pos ? 'Kein aktueller GPS-Empfang; angezeigt ist der letzte bekannte Standort.' : 'Kein GPS-Empfang. Draußen mit freier Sicht zum Himmel nochmal versuchen.', 7);
};
// Senden: nur einen frischen Standort als „Mein Standort“; sonst den letzten bekannten nach Rückfrage, deutlich benannt
$('bStandortSenden').onclick = async () => {
  if (await frischerStandort(15000)) { textTeilen(R.notfallText(U.pos)); return; }
  if (!U.pos) { melde('Kein GPS-Empfang, kein Standort bekannt. Draußen mit freier Sicht zum Himmel nochmal versuchen.', 7); return; }
  if (confirm('Kein aktueller Standort. Den letzten bekannten von ' + R.uhr(new Date(U.pos.t)) + ' Uhr senden (als „nicht aktuell“ gekennzeichnet)?')) textTeilen(R.notfallText(U.pos, true));
};

// Ankunft gegen Sonnenuntergang am aktuellen Ort: Hinweis, wenn es dunkel wird, bevor man ankommt (30 min Reserve)
function sonnenHinweis(ankunft, lat, lon) {
  const u = R.sonnenuntergang(new Date(), lat, lon);
  if (!u || ankunft < new Date(u - 30 * 60000)) return '';
  return ' · ⚠️ Sonnenuntergang ' + R.uhr(u) + ' Uhr';
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
  const rest = R.rest(e.pts, lage.d, tempoAktuell(), artAktuell());
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
    (weit ? 'noch nicht auf der Route, zum Start ' + R.kmText(R.abstand(U.pos, e.pts[0])) : Math.round(lage.abw) + ' m neben der Route') + sonnenHinweis(an, U.pos.lat, U.pos.lon);
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
  U.aufz = { laeuft: true, start: Date.now(), ende: null, pts: [], meter: 0, km: 0, kmZeit: 0 };
  U.aufz.pause = R.autoPause(U.aufz.start, 0);
  $('bAufzSpeichern').textContent = '💾 Als Tour speichern';
  if (aufzLinie) aufzLinie.remove();
  aufzLinie = L.polyline([], { color: '#1a73e8', weight: 4, opacity: 0.85, interactive: false }).addTo(karte);
  U.folgen = true; $('bOrt').classList.add('an');
  $('bAufz').textContent = '■ Aufzeichnung beenden';
  $('bAufzSpeichern').disabled = true;
  wachHalten(true);
  if (U.pos) aufzNeu();
};

function aufzNeu(c) {
  const a = U.aufz;
  if (!a || !a.laeuft || !U.pos) return;
  // Bewegung für die Auto-Pause auch an der GPS-Geschwindigkeit (unabhängig vom Ausdünnen der Spur)
  if (a.pause && c && c.speed > 0.6 && a.pause.bewegt(Date.now())) sagenBrowser('Weiter.', true);
  if (U.pos.gen > 40) return;                     // zu ungenau
  const p = { lat: U.pos.lat, lon: U.pos.lon, ele: U.pos.ele, t: U.pos.t };
  const letzt = a.pts[a.pts.length - 1];
  if (letzt && R.abstand(letzt, p) < Math.max(8, U.pos.gen / 2)) return;   // stehen bleiben zählt nicht als Weg
  if (letzt) a.meter += R.abstand(letzt, p);
  a.pts.push(p);
  aufzLinie.addLatLng([p.lat, p.lon]);
  if (a.pts.length > 1 && a.pause.bewegt(Date.now())) sagenBrowser('Weiter.', true);
  kmAnsagen(a.meter, a.pause, a);
  aufzZahlen();
}

// jeden vollen Kilometer der Aufzeichnung: Zeit und Tempo des letzten Kilometers (im Browser per Sprachausgabe;
// in der App sagt das der Navigationsdienst an, auch bei gesperrtem Bildschirm)
// Zeiten in Bewegungszeit (Auto-Pause: Stehen an der Ampel zählt nicht)
function kmAnsagen(meter, pause, zaehler) {
  const km = Math.floor(meter / 1000);
  if (km <= zaehler.km) return;
  const bewegung = pause.bewegungMs(Date.now());
  const text = R.kmAnsage(km, bewegung, (bewegung - zaehler.kmZeit) / (km - zaehler.km));
  zaehler.km = km; zaehler.kmZeit = bewegung;
  if ($('kmAnsage').checked) sagenBrowser(text);
}
// Sprachausgabe im Browser (die App spricht über den Dienst); nurLauf: „Pause“/„Weiter“ nur beim Laufen
function sagenBrowser(text, nurLauf) {
  if (NATIV || !window.speechSynthesis || (nurLauf && artAktuell() !== 'lauf')) return;
  try { const u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; speechSynthesis.speak(u); } catch (e) { /* ohne Sprachausgabe */ }
}
// Auto-Pause auch ohne neuen Standort erkennen (im Stehen kommen kaum Punkte)
setInterval(() => {
  const a = U.aufz;
  if (!a || !a.laeuft || !a.pause) return;
  if (a.pause.takt(Date.now())) { sagenBrowser('Pause.', true); aufzZahlen(); }
}, 5000);
$('kmAnsage').onchange = e => { SPEICHER.schreiben('kmAnsage', e.target.checked); SPEICHER.schreiben('kmAnsageGewaehlt', true); };

function aufzZahlen() {
  const a = U.aufz;
  if (!a) return;
  const pts = a.pts.map(p => Object.assign({}, p));
  const m = R.laengen(pts);
  $('aStrecke').textContent = R.kmText(m);
  const dauer = ((a.ende || Date.now()) - a.start) / 3600e3;
  const bewegung = a.pause ? a.pause.bewegungMs(a.ende || Date.now()) / 3600e3 : dauer;
  $('aDauer').textContent = R.zeitText(dauer, true);
  $('aAuf').textContent = R.hoehenmeter(pts.map(p => p.ele), 8).auf + ' m';
  bewegungZeigen(m, dauer, bewegung, a.laeuft && a.pause && a.pause.pausiert);
}
// Ø Tempo aus der Bewegungszeit; darunter Bewegungszeit und ob gerade Pause ist (auch für die App, 75-app.js)
function bewegungZeigen(meter, dauer, bewegung, pausiert) {
  $('aTempo').textContent = meter > 50 && bewegung > 0 ? R.paceText(bewegung * 60 / (meter / 1000)) : '–';
  $('aBewegung').textContent = (dauer - bewegung > 1 / 60 ? 'Bewegung ' + R.zeitText(bewegung, true) + ' · Stehen zählt nicht' : '') + (pausiert ? (dauer - bewegung > 1 / 60 ? ' · ' : '') + '⏸ Pause' : '');
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
  $('bAufzSpeichern').textContent = '✓ In „Gegangene Touren“';
  setTimeout(() => { $('bAufzSpeichern').textContent = '💾 Als Tour speichern'; }, 4000);
};
