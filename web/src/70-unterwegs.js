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
// GPS für Folgen oder Aufzeichnen: schaltet es eines davon ein, geht es mit dem Ende beider wieder aus; wer es über 📍
// selbst eingeschaltet oder dort zum Mitziehen angetippt hat, behält es (Durchsicht 03.11.: GPS blieb bis 📍 aus an)
function gpsFuer() {
  const neu = U.watch == null;
  if (!gpsAn()) return false;
  if (neu) U.gpsNurFuer = true;
  return true;
}
function gpsFreigeben() {
  if (U.gpsNurFuer && !U.navi && !aufzLaeuft()) gpsAus();
}
function gpsAus() {
  U.gpsNurFuer = false;
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
  U.gpsNurFuer = false;   // 📍 angetippt: Standort ist gewollt, auch nach Folgen und Aufzeichnen
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
  setTimeout(gewitterPruefen, 60000);
  setTimeout(() => { if (!NATIV && !(U.navi || aufzLaeuft())) gewitterZeigen(null); }, 0);
  if (U.navi) { U.navi = false; fuehrungAus(); $('bNavi').textContent = '▶ Route folgen'; $('abseits').hidden = true; if (!aufzLaeuft()) wachHalten(false); gpsFreigeben(); return; }
  if (!S.ergebnis) { melde('Erst eine Route planen oder eine Tour öffnen.'); return; }
  if (!gpsFuer()) return;
  U.navi = true; U.folgen = true; U.gewarnt = false; U.fortschritt = null; U.naviStart = Date.now(); U.vorgelesen = new Set(); $('bOrt').classList.add('an');
  fuehrungLaden();
  $('bNavi').textContent = '■ Folgen beenden';
  wachHalten(true);
  if (U.pos) naviNeu();
};

// ---------- vor dem Start: welche Tour folgt die Navigation (Name, Strecke, Zeit, Aufstieg) ----------
function unterwegsKarte() {
  const e = S.ergebnis, box = $('uTourKarte');
  if (!e) { box.innerHTML = '<span class="klein">Noch keine Route. Unter <b style="display:inline">Planen</b> eine Route setzen oder unter Ich › Touren eine Tour öffnen.</span>'; return; }
  const name = (S.name || '').trim() || (S.fest ? 'Geöffnete Spur' : 'Geplante Route');
  const et = etappenAktuell();
  box.innerHTML = '<b>🥾 ' + R.esc(name) + '</b><span class="klein">' + R.esc(R.kmText(e.laenge) + ' · ' + R.zeitText(e.zeit + (S.fest ? 0 : besichtigung() / 60)) +
    (e.tief != null ? ' · ↑ ' + e.auf + ' m' : '') + (et ? ' · ' + et.length + ' Tage' : '')) + '</span>';
}

// ---------- Mehrtagestour: einem Tag folgen ----------
// Auswahl „Tag 1 … Tag n“ oder die ganze Tour; vorgewählt ist der Tag, der nach dem geplanten Starttag heute ist,
// sonst Tag 1. Die Navigation (Browser und Dienst der App) bekommt dann nur diese Etappe als Route.
let naviEtappenFuer = '';
function naviEtappenFeld() {
  const et = etappenAktuell(), feld = $('naviEtappeFeld'), sel = $('naviEtappe');
  if (!et) { feld.hidden = true; sel.innerHTML = ''; naviEtappenFuer = ''; return; }
  const kennung = et.map(s => s.von + '-' + s.bis + '-' + Math.round(s.meter)).join(',') + '|' + $('startTag').value;
  if (kennung === naviEtappenFuer) return;
  const vorher = sel.value, warDa = !!sel.options.length;
  naviEtappenFuer = kennung;
  sel.innerHTML = '';
  et.forEach((s, k) => {
    const o = document.createElement('option');
    o.value = String(k);
    o.textContent = 'Tag ' + (k + 1) + ': bis ' + (S.wps[s.bis].name || (k === et.length - 1 ? 'Ziel' : 'Übernachtung ' + (k + 1))) + ' (' + R.kmText(s.meter) + ')';
    sel.appendChild(o);
  });
  const ganz = document.createElement('option');
  ganz.value = ''; ganz.textContent = 'ganze Tour (' + et.length + ' Tage)';
  sel.appendChild(ganz);
  let wahl = '0';
  if ($('startTag').value) {
    const tage = Math.round((new Date(R.tagIso(Date.now()) + 'T12:00') - new Date($('startTag').value + 'T12:00')) / 864e5);
    if (tage >= 0 && tage < et.length) wahl = String(tage);
  }
  sel.value = warDa && [...sel.options].some(o => o.value === vorher) ? vorher : wahl;
  feld.hidden = false;
  naviTageChips();
}
// große Knöpfe je Tag (das Auswahlfeld bleibt verborgen die Quelle der Wahl)
function naviTageChips() {
  const box = $('naviTage'), sel = $('naviEtappe');
  box.innerHTML = '';
  const et = etappenAktuell();
  [...sel.options].forEach(o => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.wert = o.value;
    b.className = sel.value === o.value ? 'an' : '';
    b.setAttribute('aria-pressed', String(sel.value === o.value));
    const k = o.value === '' ? null : +o.value, s = et && k != null ? et[k] : null;
    b.innerHTML = o.value === '' ? 'Ganze Tour<small>' + R.esc(o.textContent.replace(/^ganze Tour /, '')) + '</small>'
      : '<b style="color:' + tagFarbe(k) + '">Tag ' + (k + 1) + '</b><small>' + R.esc((s ? R.kmText(s.meter) + ' · ' + R.zeitText(s.zeit) : '') + ' · bis ' + o.textContent.replace(/^Tag \d+: bis /, '').replace(/ \([^)]*\)$/, '')) + '</small>';
    b.onclick = () => { sel.value = o.value; sel.dispatchEvent(new Event('change')); naviTageChips(); };
    box.appendChild(b);
  });
}
// was die Navigation verfolgt: { e (Auswertung), wps (Wegpunkte dazu), tag (0, 1 … oder null für die ganze Tour) }
function naviPlan() {
  const v = $('naviEtappe').value;
  const et = !$('naviEtappeFeld').hidden && v !== '' ? etappenAktuell() : null;
  const s = et && et[+v];
  if (!s || !S.ergebnis) return { e: S.ergebnis, wps: S.wps, tag: null };
  return { e: R.etappeAusschnitt(S.ergebnis, s), wps: S.wps.slice(s.von, s.bis + 1), tag: +v };
}
$('naviEtappe').onchange = () => { U.fortschritt = null; U.vorgelesen = new Set(); if (U.navi && U.pos) naviNeu(); naviEtappeGewechselt(); };
// die App schickt dem Dienst dann die neue Route (75-app.js)
let naviEtappeGewechselt = () => {};

function naviNeu() {
  const plan = naviPlan(), e = plan.e;
  if (!e || !U.pos) return;
  const lage = R.aufStrecke(e.pts, U.pos, U.fortschritt);
  if (lage.abw < 80) U.fortschritt = lage.d;
  const rest = R.rest(e.pts, lage.d, tempoAktuell(), artAktuell());
  $('uRest').textContent = R.kmText(rest.meter);
  // noch offene Stopps: deren Teilstück endet hinter der aktuellen Stelle
  const offenAb = (e.stueckEnde || []).findIndex(d => d > lage.d + 20);
  const besicht = S.fest || offenAb < 0 ? 0 : plan.tag == null ? besichtigung(offenAb + 1) : plan.wps.slice(offenAb + 1).reduce((s, w) => s + (+w.min || 0), 0);
  rest.zeit += besicht / 60;
  $('uZeit').textContent = R.zeitText(rest.zeit);
  $('uAuf').textContent = rest.auf + ' m';
  const an = new Date(Date.now() + rest.zeit * 3600e3);
  // noch nicht auf der Route (z. B. Anfahrt): der Rest gilt erst ab dem Start, darum den Weg dorthin nennen
  const weit = U.fortschritt == null && lage.abw >= 300;
  $('uAnkunft').textContent = (plan.tag != null ? 'Tag ' + (plan.tag + 1) + ': ' : '') + 'Ankunft ohne Pausen gegen ' + an.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr · ' +
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
  // Führung: am Stopp (30 m) einmal die Kurzinfo vorlesen
  if (FUEHRUNG.size && lage.abw < 40 && e.stueckEnde && !S.fest) plan.wps.forEach((w, i) => {
    const k = fuehrungSchluessel(w), text = i > 0 && FUEHRUNG.get(k), d = e.stueckEnde[i - 1];
    if (text && d != null && !U.vorgelesen.has(k) && Math.abs(d - lage.d) <= 30) { U.vorgelesen.add(k); sagenBrowser(text); }
  });
  if (rest.meter < 30 && lage.abw < 40 && lage.d > e.laenge / 2 && Date.now() - U.naviStart > 60000) { melde(plan.tag != null && plan.tag < etappenAktuell().length - 1 ? 'Etappe ' + (plan.tag + 1) + ' geschafft. Gute Nacht!' : 'Ziel erreicht. Schön war’s!', 6); $('bNavi').click(); }
}

// ---------- Führung: Kurzinfo aus Wikipedia an den Stopps ----------
// Die Texte kommen vor dem Losgehen (mit Netz); unterwegs liest die App sie am Stopp vor, in der Android-App auch bei
// gesperrtem Bildschirm (der Dienst bekommt sie mit den Stopps). Schlüssel: Name und Ort des Stopps, damit ein
// umsortierter oder verschobener Stopp seinen Text behält und kein anderer ihn bekommt.
const FUEHRUNG = new Map();
const fuehrungSchluessel = w => (w.name || '') + '@' + w.lat.toFixed(4) + ',' + w.lon.toFixed(4);
$('fuehrung').checked = SPEICHER.lesen('fuehrung', false);
$('fuehrung').onchange = e => { SPEICHER.schreiben('fuehrung', e.target.checked); if (!e.target.checked) fuehrungAus(); };
let fuehrungNr = 0;   // jedes Laden zählt: eine späte Antwort eines früheren Ladens schreibt nicht mehr hinein
async function fuehrungLaden() {
  const nr = ++fuehrungNr;
  FUEHRUNG.clear();
  if (!$('fuehrung').checked || S.fest) return;
  const n = S.wps.length, rund = n > 2 && R.abstand(S.wps[0], S.wps[n - 1]) < 30;
  const auftraege = [];
  let ohneText = 0, fehler = 0;
  S.wps.forEach((w, i) => {
    // nur Stopps mit Namen (die App kennt nur solche); Start und Rückkehr zum Start nicht
    if (i === 0 || (rund && i === n - 1) || !w.info || !w.name) return;
    const q = R.wikiQuelle({ wikipedia: w.info.wp, wikidata: w.info.wd });
    if (q) auftraege.push(wikiHolen(q).then(k => {
      if (nr !== fuehrungNr) return;
      if (k && k.text) FUEHRUNG.set(fuehrungSchluessel(w), R.fuehrungText(w.name, k.text)); else ohneText++;
    }).catch(() => { fehler++; }));
  });
  if (!auftraege.length) { melde('Führung: Keiner der Stopps hat einen Wikipedia-Artikel. Stopps aus „Entdecken“ oder der Stadt-Liste bringen ihn mit.', 7); return; }
  // nicht ewig warten: ohne Netz geht die Navigation trotzdem los, nur ohne Texte
  await Promise.race([Promise.all(auftraege), new Promise(r => setTimeout(r, 10000))]);
  if (nr !== fuehrungNr) return;
  const fehlt = auftraege.length - FUEHRUNG.size - ohneText;
  melde('Führung: Texte für ' + FUEHRUNG.size + ' von ' + auftraege.length + ' Stopps geladen' +
    (ohneText ? ', ' + ohneText + ' ohne Kurzinfo' : '') + (fehlt > 0 ? ', ' + fehlt + ' nicht erreichbar (Netz)' : '') + '.', 6);
}
// Führung beim Beenden oder Abschalten verwerfen: kein Vorlesen mehr, auch nicht aus einem noch laufenden Laden
function fuehrungAus() { fuehrungNr++; FUEHRUNG.clear(); }

// ---------- Aufzeichnen ----------
$('bAufz').onclick = () => {
  setTimeout(gewitterPruefen, 60000);
  setTimeout(() => { if (!NATIV && !(U.navi || aufzLaeuft())) gewitterZeigen(null); }, 0);   // beendet: Warnung weg
  if (U.aufz && U.aufz.laeuft) {
    U.aufz.laeuft = false; U.aufz.ende = Date.now();
    $('bAufz').textContent = '⏺ Neue Aufzeichnung';
    $('bAufzSpeichern').disabled = U.aufz.pts.length < 2;
    if (!U.navi) wachHalten(false);
    aufzZahlen();
    gpsFreigeben();
    return;
  }
  if (!gpsFuer()) return;
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

// Gewitterwarnung unterwegs (im Browser; in der App fragt der Navigationsdienst selbst, auch bei gesperrtem Bildschirm):
// beim Folgen oder Aufzeichnen alle 30 min die nächsten drei Stunden am Standort
function gewitterZeigen(text) {
  $('uWetter').hidden = !text;
  $('uWetter').textContent = text ? '⚡ ' + text + '. Schutz suchen, Grate und Gipfel meiden.' : '';
}
let gewitterGemeldet = 0;
async function gewitterPruefen() {
  if (NATIV) return;
  if (!(U.navi || aufzLaeuft())) { gewitterZeigen(null); return; }
  if (!U.pos) return;
  let ab;
  try { ab = await gewitterHolen(U.pos.lat, U.pos.lon); } catch (e) { return; }   // ohne Netz: beim nächsten Mal
  if (!(U.navi || aufzLaeuft())) { gewitterZeigen(null); return; }   // inzwischen beendet: Antwort verwerfen
  const text = ab == null ? null : ab <= Date.now() ? 'Gewitter möglich, jetzt' : 'Gewitter möglich gegen ' + new Date(ab).getHours() + ' Uhr';
  gewitterZeigen(text);
  if (text && Date.now() - gewitterGemeldet > 2 * 3600e3) {
    gewitterGemeldet = Date.now();
    melde('⚡ ' + text + '.', 8);
    try { if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance('Achtung: ' + text + '.'); u.lang = 'de-DE'; speechSynthesis.speak(u); } } catch (e) { /* stumm */ }
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  }
}
setInterval(gewitterPruefen, 30 * 60000);

// Balken über der Leiste, solange Folgen oder Aufzeichnen läuft (Browser und App: der Zustand steht an den Knöpfen)
function balkenZeigen() {
  const navi = /beenden/.test($('bNavi').textContent), aufz = /beenden/.test($('bAufz').textContent);
  const an = (navi || aufz) && seite !== 'unterwegs';
  $('laeuftBalken').hidden = !an;
  document.body.classList.toggle('mitBalken', an);
  if (!an) return;
  const rest = $('uRest').textContent, weg = $('aStrecke').textContent;
  $('laeuftBalken').textContent = (navi ? '🧭 Navigation läuft' + (rest && rest !== '–' ? ' · noch ' + rest : '') : '') + (navi && aufz ? ' · ' : '') +
    (aufz ? '⏺ Aufzeichnung' + (weg && weg !== '–' ? ' · ' + weg : '') : '') + ' ›';
}
$('laeuftBalken').onclick = () => reiter('unterwegs');
if (window.MutationObserver) {
  const beobachter = new MutationObserver(() => balkenZeigen());
  ['bNavi', 'bAufz', 'uRest', 'aStrecke'].forEach(id => beobachter.observe($(id), { childList: true, characterData: true, subtree: true }));
}
