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
async function textTeilen(text, kopiert) {
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); melde(kopiert || 'Standort kopiert: in eine SMS oder Nachricht einfügen.', 6); }
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
  U.navi = true; U.folgen = true; U.gewarnt = false; U.fortschritt = null; U.naviStart = Date.now(); U.vorgelesen = new Set(); U.alarmPunkte = null; $('bOrt').classList.add('an');
  fuehrungLaden();
  $('bNavi').textContent = '■ Folgen beenden';
  wachHalten(true);
  if (U.pos) naviNeu();
};

// ---------- vor dem Start: welche Tour folgt die Navigation (Name, Strecke, Zeit, Aufstieg) ----------
function unterwegsKarte() {
  const e = S.ergebnis, box = $('uTourKarte');
  // ohne Route hat „Route folgen“ nichts zu folgen (läuft die Navigation, bleibt der Knopf zum Beenden)
  $('bNavi').hidden = !e && !/beenden/.test($('bNavi').textContent);
  $('bBescheid').hidden = !e;
  if (!e) {
    box.innerHTML = '<span class="klein">Noch keine Route.</span><div class="knopfreihe"><button class="knopf" type="button" id="uZuPlanen">✏️ Route planen</button>' +
      '<button class="knopf" type="button" id="uZuTouren">🥾 Tour öffnen</button></div>';
    $('uZuPlanen').onclick = () => reiter('planen');
    $('uZuTouren').onclick = () => reiter('touren');
    return;
  }
  const name = (S.name || '').trim() || (S.fest ? 'Geöffnete Spur' : 'Geplante Route');
  const et = etappenAktuell();
  box.innerHTML = '<b>🥾 ' + R.esc(name) + '</b><span class="klein">' + R.esc(R.kmText(e.laenge) + ' · ' + R.zeitText(e.zeit + (S.fest ? 0 : besichtigung() / 60)) +
    (e.tief != null ? ' · ↑ ' + e.auf + ' m' : '') + (et ? ' · ' + et.length + ' Tage' : '')) + '</span>';
}

// ---------- Alpines Notsignal: Licht (App: Taschenlampe, sonst weißer Bildschirm), Ton, Vibration ----------
let notsignalUhr = null, notsignalBeginn = 0, notsignalWar = false, notsignalTon = null;
let notsignalLampe = an => { $('notsignalBlitz').hidden = !an; };   // die App ersetzt das durch die Taschenlampe (75-app.js)
function notsignalSchritt() {
  const an = R.notsignalAn(Date.now() - notsignalBeginn);
  if (an === notsignalWar) return;
  notsignalWar = an;
  notsignalLampe(an);
  if (an) {
    if (navigator.vibrate) navigator.vibrate(1500);
    try {
      notsignalTon = notsignalTon || new (window.AudioContext || window.webkitAudioContext)();
      const o = notsignalTon.createOscillator(), g = notsignalTon.createGain();
      o.frequency.value = 2800; g.gain.value = 0.6; o.connect(g); g.connect(notsignalTon.destination);
      o.start(); o.stop(notsignalTon.currentTime + 1.5);
    } catch (e) { /* ohne Ton: Licht und Vibration */ }
  }
}
function notsignal(an) {
  clearInterval(notsignalUhr); notsignalUhr = null;
  if (notsignalWar) { notsignalWar = false; notsignalLampe(false); }
  $('bNotsignal').setAttribute('aria-pressed', String(an));
  $('bNotsignal').textContent = an ? '■ Notsignal beenden' : '🔦 Notsignal geben';
  if (!an) return;
  notsignalBeginn = Date.now();
  wachHalten(true);
  notsignalSchritt();
  notsignalUhr = setInterval(notsignalSchritt, 200);
}
$('bNotsignal').onclick = () => notsignal(!notsignalUhr);

// ---------- Bescheid geben: Tour und geplante Rückkehr an eine vertraute Person (ohne Server: über das Teilen-Menü) ----------
const PAGES = 'https://thomas-aurh.github.io/gipfel-und-gasse/';
// in der App: Mitteilung von Android zur geplanten Rückkehr (auch bei geschlossener App); im Browser nur die Anzeige hier
let bescheidMitteilung = () => {}, bescheidMitteilungAus = () => {};
function bescheidGeben() {
  const plan = naviPlan(), e = plan.e;
  if (!e) { melde('Erst eine Route planen oder eine Tour öffnen.'); return; }
  const pause = (+$('pausewahl').value || 0) / 60;
  const stunden = e.zeit + pause + (S.fest || plan.tag != null ? 0 : besichtigung() / 60);
  // Start: geplante Startzeit, wenn sie heute noch kommt, sonst jetzt
  const geplant = zeitplanStart(), jetzt = new Date();
  const start = geplant && geplant > jetzt && geplant.toDateString() === jetzt.toDateString() ? geplant : jetzt;
  const ankunft = new Date(start.getTime() + stunden * 3600e3);
  const et = etappenAktuell();
  const name = ((S.name || '').trim() || (S.fest ? 'Spur' : 'Tour')) + (plan.tag != null ? ', Tag ' + (plan.tag + 1) : '');
  const text = R.bescheidText({ name, meter: e.laenge, stunden, auf: e.tief != null ? e.auf : 0, tage: plan.tag == null && et ? et.length : 1, ankunft,
    start: e.pts[0], link: S.fest ? '' : PAGES + '#' + R.linkSchreiben(S.profil, plan.wps) });
  SPEICHER.schreiben('bescheid', { name, bis: ankunft.getTime(), erinnert: false });
  bescheidMitteilung(ankunft.getTime(), name);
  textTeilen(text, 'Nachricht kopiert: in WhatsApp, SMS oder Mail an deine Kontaktperson einfügen.');
  bescheidZeigen();
}
function bescheidZeigen() {
  const b = SPEICHER.lesen('bescheid', null), box = $('bescheidBox');
  if (!b || !b.bis) { box.hidden = true; return; }
  const ueber = Date.now() > b.bis;
  box.hidden = false;
  box.classList.toggle('warnung', ueber);
  $('bescheidText').textContent = ueber ? '⏰ Geplante Rückkehr (' + R.uhr(new Date(b.bis)) + ' Uhr) ist vorbei: Bist du gut angekommen? Dann gib kurz Bescheid.'
    : '📣 Bescheid gegeben: ' + b.name + ', zurück geplant gegen ' + R.uhr(new Date(b.bis)) + ' Uhr.';
  // einmal erinnern, wenn die Zeit vorbei ist (beim nächsten Blick in die App)
  if (ueber && !b.erinnert) {
    SPEICHER.schreiben('bescheid', Object.assign({}, b, { erinnert: true }));
    melde('Geplante Rückkehr vorbei: Bist du gut angekommen? Unter Unterwegs „✅ Ankunft melden“.', 10);
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  }
}
$('bBescheid').onclick = bescheidGeben;
$('bBescheidPlan').onclick = bescheidGeben;
$('bAnkunft').onclick = () => {
  const b = SPEICHER.lesen('bescheid', null);
  SPEICHER.schreiben('bescheid', null);
  bescheidMitteilungAus();
  bescheidZeigen();
  textTeilen(R.ankunftText(b && b.name, new Date()), 'Nachricht kopiert: an deine Kontaktperson schicken.');
};
$('bBescheidSpaeter').onclick = () => {
  const b = SPEICHER.lesen('bescheid', null);
  if (!b) return;
  const bis = Math.max(b.bis, Date.now()) + 3600e3;
  SPEICHER.schreiben('bescheid', Object.assign({}, b, { bis, erinnert: false }));
  bescheidMitteilung(bis, b.name);
  bescheidZeigen();
  melde('Erinnerung eine Stunde später. Die Nachricht an deine Kontaktperson ändert das nicht: sag ihr Bescheid, wenn es später wird.', 7);
};
$('bBescheidAus').onclick = () => { SPEICHER.schreiben('bescheid', null); bescheidMitteilungAus(); bescheidZeigen(); };
setInterval(bescheidZeigen, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) bescheidZeigen(); });
setTimeout(bescheidZeigen, 0);

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
  punktAlarmPruefen(e, lage);
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
    aufzSichern(true);
    gpsFreigeben();
    return;
  }
  if (!gpsFuer()) return;
  U.aufz = { laeuft: true, start: Date.now(), ende: null, pts: [], meter: 0, km: 0, kmZeit: 0 };
  U.aufz.pause = R.autoPause(U.aufz.start, 0);
  aufzSichern(true);
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
  aufzSichern(false);
  if (a.pts.length > 1 && a.pause.bewegt(Date.now())) sagenBrowser('Weiter.', true);
  kmAnsagen(a.meter, a.pause, a);
  aufzZahlen();
}

// Aufzeichnung im Browser sichern: Chrome verwirft Tabs im Hintergrund, ein Neuladen nähme sonst die ganze Spur mit.
// Höchstens alle 15 s (und beim Verlassen der Seite) in den Speicher; die App zeichnet im Navigationsdienst auf
let aufzGesichert = 0;
function aufzSichern(sofort) {
  const a = U.aufz;
  if (NATIV || !a || (!sofort && Date.now() - aufzGesichert < 15000)) return;
  aufzGesichert = Date.now();
  const r6 = x => Math.round(x * 1e6) / 1e6;
  SPEICHER.schreiben('aufzSicherung', { laeuft: a.laeuft, start: a.start, ende: a.ende, meter: a.meter, km: a.km, kmZeit: a.kmZeit,
    pauseMs: a.pause ? a.pause.pauseMs : 0, gesichert: Date.now(),
    pts: a.pts.map(p => ({ lat: r6(p.lat), lon: r6(p.lon), ele: p.ele == null ? null : Math.round(p.ele * 10) / 10, t: p.t })) });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) aufzSichern(true); });
window.addEventListener('pagehide', () => aufzSichern(true));
// beim Start: eine gesicherte Aufzeichnung zurückholen. Lief sie noch, zeichnet die Seite weiter (die Lücke zählt als
// Pause); nach mehr als 12 h ohne Sicherung gilt sie als beendet und lässt sich nur noch speichern
function aufzWiederholen() {
  if (NATIV || U.aufz) return;
  const s = SPEICHER.lesen('aufzSicherung', null);
  if (!s || !Array.isArray(s.pts) || !s.start) return;
  const weiter = s.laeuft && Date.now() - (s.gesichert || 0) < 12 * 3600e3;
  const ende = weiter ? null : (s.ende || s.gesichert || Date.now());
  U.aufz = { laeuft: weiter, start: s.start, ende, pts: s.pts, meter: s.meter || 0, km: s.km || 0, kmZeit: s.kmZeit || 0 };
  U.aufz.pause = R.autoPause(s.start, (s.pauseMs || 0) + (weiter ? Math.max(0, Date.now() - (s.gesichert || Date.now())) : 0));
  if (aufzLinie) aufzLinie.remove();
  aufzLinie = L.polyline(s.pts.map(p => [p.lat, p.lon]), { color: '#1a73e8', weight: 4, opacity: 0.85, interactive: false }).addTo(karte);
  const uhrzeit = new Date(s.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (weiter && gpsFuer()) {
    U.folgen = true; $('bOrt').classList.add('an');
    $('bAufz').textContent = '■ Aufzeichnung beenden';
    $('bAufzSpeichern').disabled = true;
    wachHalten(true);
    melde('Aufzeichnung von ' + uhrzeit + ' Uhr läuft weiter (die Seite war geschlossen).', 7);
  } else {
    U.aufz.laeuft = false; U.aufz.ende = ende || Date.now();
    $('bAufz').textContent = '⏺ Neue Aufzeichnung';
    $('bAufzSpeichern').disabled = s.pts.length < 2;
    if (s.pts.length >= 2) melde('Aufzeichnung von ' + uhrzeit + ' Uhr wiederhergestellt: unter Unterwegs als Tour speichern.', 7);
  }
  aufzZahlen();
  balkenZeigen();
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
// ---------- Punkt-Alarm ----------
$('punktAlarm').value = String(SPEICHER.lesen('punktAlarm', 300));
if (!$('punktAlarm').value) $('punktAlarm').value = '300';
$('punktAlarm').addEventListener('change', e => { SPEICHER.schreiben('punktAlarm', +e.target.value); U.alarmPunkte = null; });
const punktAlarmAbstand = () => +$('punktAlarm').value || 0;
// Punkte für den Alarm: benannte Wegpunkte (ohne Start), Wegpunkte der GPX-Datei, Hütten/Gipfel/Brunnen der Orte-Liste
function alarmQuellen(mitWegpunkten) {
  const plan = naviPlan(), out = [];
  if (mitWegpunkten && !S.fest) plan.wps.forEach((w, i) => { if (i && w.name) out.push({ lat: w.lat, lon: w.lon, name: w.name }); });
  const t = S.tourId && tourenLesen().find(x => x.id === S.tourId);
  for (const p of (t && t.punkte) || []) out.push({ lat: p[0], lon: p[1], name: p[2] || 'Wegpunkt' });
  for (const o of orte || []) if (['huette', 'gipfel', 'wasser'].includes(o.kat) && o.name) out.push({ lat: o.lat, lon: o.lon, name: o.name });
  return out;
}
// im Browser: einmal je Punkt melden (Text, Sprache, Vibration), sobald er höchstens den gewählten Abstand vor einem liegt
function punktAlarmPruefen(e, lage) {
  const weit = punktAlarmAbstand();
  if (!weit || NATIV || lage.abw > 80) return;
  if (!U.alarmPunkte || U.alarmPlan !== e) { U.alarmPlan = e; U.alarmPunkte = R.alarmPunkte(e.pts, alarmQuellen(true), 150); U.alarmGemeldet = new Set(); }
  for (const p of U.alarmPunkte) {
    const bis = p.d - lage.d, k = p.name + '@' + p.d;
    if (bis > 30 && bis <= weit && !U.alarmGemeldet.has(k)) {
      U.alarmGemeldet.add(k);
      const text = 'In ' + R.kmText(bis) + ': ' + p.name + '.';
      melde('🔔 ' + text, 8); sagenBrowser(text);
      if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
    }
  }
}

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
  if (!a.laeuft) SPEICHER.schreiben('aufzSicherung', null);   // gespeichert: die Sicherung wird nicht mehr gebraucht
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
