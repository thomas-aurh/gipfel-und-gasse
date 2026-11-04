// Planen: Wegpunkte setzen, Teilstücke holen, Ergebnis zeigen
const S = {
  wps: [],            // [{lat, lon, name?, min?}]: name und Besichtigungszeit (Minuten) bei Stopps
  modus: 'berg',      // berg oder stadt
  profil: 'wandern',
  tempo: 1,
  pace: 6,            // Lauftempo in min/km (nur beim Laufen)
  name: '',
  tourId: null,       // gespeicherte Tour, die gerade offen ist
  fest: null,         // importierte oder aufgezeichnete Spur: {pts} (nicht über Wegpunkte geplant)
  stuecke: [],
  ergebnis: null,
  verlauf: [],        // für Rückgängig: frühere Wegpunkt-Listen
  stueckeFuer: ''     // zu welchen Wegpunkten die Teilstücke gehören (für den Entwurf)
};
const cache = new Map();   // Teilstücke nach Profil und Koordinaten
const laufend = new Map(); // Anfragen, die gerade unterwegs sind: dasselbe Stück nicht doppelt anfragen
const ersatz = new Map();  // gespeicherte Teilstücke ohne Abbiegehinweise (vor Stufe 4): Ersatz, falls neu rechnen scheitert
let lauf = 0;              // jede Neuberechnung bekommt eine Nummer; ältere Antworten werden verworfen

function schluessel(a, b, p) { return p + ':' + a.lat.toFixed(6) + ',' + a.lon.toFixed(6) + '>' + b.lat.toFixed(6) + ',' + b.lon.toFixed(6); }

// Rückgängig merkt sich Wegpunkte und Wegewahl (ein geteilter Link kann beides ändern)
function merken() {
  S.verlauf.push(JSON.stringify({ wps: S.wps, profil: S.profil }));
  if (S.verlauf.length > 60) S.verlauf.shift();
}

function wegpunktDazu(lat, lon, index, extra) {
  if (S.fest) { melde('Das ist eine geöffnete Spur. Für eine neue Planung „✕ Neu“ tippen.'); return; }
  merken();
  const w = Object.assign({ lat, lon }, extra || {});
  if (index == null) S.wps.push(w); else S.wps.splice(index, 0, w);
  neuBerechnen();
}

function wegpunktWeg(i) {
  merken();
  S.wps.splice(i, 1);
  neuBerechnen();
}

karte.on('click', e => {
  if (Date.now() - popupZuSeit < 400) return;
  if (!$('lagenwahl').hidden) return;
  // mit Fadenkreuz setzt ein Tipp nichts, er holt die Stelle unter das Kreuz
  if (kreuzAn) { kreuzHin(e.latlng); return; }
  // Info-Modus (52-info.js): Antippen zeigt, was dort ist, statt einen Punkt zu setzen
  if (infoAn) { infoZeigen(e.latlng); return; }
  wegpunktDazu(e.latlng.lat, e.latlng.lng);
});

// Fadenkreuz wie in Locus: steht in der Mitte des sichtbaren Kartenteils (am Telefon über dem Blatt)
let kreuzAn = false;
function kreuzPunkt() {
  const k = $('karte').getBoundingClientRect();
  const tel = window.innerWidth <= 760;
  const unten = tel ? Math.min(k.bottom, $('panel').getBoundingClientRect().top) : k.bottom;
  return L.point(k.width / 2, Math.max(60, (unten - k.top) / 2));
}
function kreuzHin(ll) {
  // die angetippte Stelle unter das Kreuz schieben
  const p = kreuzPunkt(), mitte = karte.getSize().divideBy(2);
  karte.panTo(karte.containerPointToLatLng(karte.latLngToContainerPoint(ll).subtract(p.subtract(mitte))));
}
function kreuzZeigen() {
  if (!kreuzAn) return;
  const p = kreuzPunkt(), k = $('karte').getBoundingClientRect(), ll = karte.containerPointToLatLng(p);
  const x = k.left + p.x, y = k.top + p.y;
  // großes Blatt am Telefon: kein Platz über dem Blatt, dann Kreuz und Feld ausblenden, bis es wieder kleiner ist
  const platz = window.innerWidth > 760 || y + 36 + 52 <= $('panel').getBoundingClientRect().top;
  $('kreuz').hidden = $('kreuzFeld').hidden = !platz;
  if (!platz) return;
  Object.assign($('kreuz').style, { left: x + 'px', top: y + 'px' });
  Object.assign($('kreuzFeld').style, { left: x + 'px', top: (y + 36) + 'px' });
  const letzter = S.wps[S.wps.length - 1];
  $('kreuzText').textContent = ll.lat.toFixed(5) + ', ' + ll.lng.toFixed(5) +
    (letzter ? ' · ' + R.kmText(R.abstand(letzter, { lat: ll.lat, lon: ll.lng })) : '');
  $('bKreuzSetzen').textContent = S.wps.length ? '📍 Punkt hier' : '📍 Start hier';
}
function kreuz(an) {
  kreuzAn = an;
  $('kreuz').hidden = $('kreuzFeld').hidden = !an;
  $('bKreuz').classList.toggle('an', an);
  $('bKreuz').setAttribute('aria-pressed', String(an));
  kreuzZeigen();
}
$('bKreuz').onclick = () => kreuz(!kreuzAn);
$('bKreuzSetzen').onclick = () => {
  const ll = karte.containerPointToLatLng(kreuzPunkt());
  wegpunktDazu(ll.lat, ll.lng);
  kreuzZeigen();
};
karte.on('move zoom resize', kreuzZeigen);
window.addEventListener('resize', kreuzZeigen);

function zeichenWegpunkte() {
  kreuzZeigen();   // Abstand und „Start/Punkt hier“ hängen an den Wegpunkten (Neu, Rückgängig, Ziehen)
  ebenePunkte.clearLayers();
  const n = S.wps.length;
  S.wps.forEach((w, i) => {
    const art = i === 0 ? 'start' : (i === n - 1 && n > 1 ? 'ziel' : '');
    const text = i === 0 ? 'S' : (art === 'ziel' ? 'Z' : String(i));
    // Rundtour: Ziel liegt auf dem Start, darum leicht versetzt zeigen, damit beide greifbar bleiben
    const rund = art === 'ziel' && R.abstand(w, S.wps[0]) < 30;
    const m = L.marker([w.lat, w.lon], {
      draggable: true, autoPan: true, zIndexOffset: i === 0 ? 1000 : 0,
      icon: L.divIcon({ className: '', html: '<div class="wp ' + art + '">' + text + '</div>', iconSize: [26, 26], iconAnchor: rund ? [-2, 30] : [13, 13] })
    });
    if (w.name || w.nacht) m.bindTooltip((w.nacht ? '🛏 ' : '') + R.esc(w.name || 'Übernachtung') + (w.nacht ? ' · Tag ' + (stueckTag(i) + 1) + ' ab hier' : ''), { permanent: true, direction: 'right', offset: [14, 0], className: 'wp-name' });
    m.on('dragend', () => {
      const p = m.getLatLng();
      merken();
      // Rundtour: wer den Start verschiebt, verschiebt das Ziel mit
      const letzt = S.wps.length - 1;
      if (i === 0 && letzt >= 2 && R.abstand(S.wps[0], S.wps[letzt]) < 30) S.wps[letzt] = Object.assign({}, S.wps[letzt], { lat: p.lat, lon: p.lng });
      S.wps[i] = Object.assign({}, S.wps[i], { lat: p.lat, lon: p.lng });
      neuBerechnen();
    });
    m.on('click', () => {
      const box = document.createElement('div');
      box.innerHTML = '<b>' + (w.name ? R.esc(w.name) : i === 0 ? 'Start' : art === 'ziel' ? 'Ziel' : 'Zwischenziel ' + i) + '</b><br>';
      const k = document.createElement('button');
      k.className = 'popup-knopf'; k.textContent = 'Punkt entfernen';
      k.onclick = () => { karte.closePopup(); wegpunktWeg(i); };
      box.appendChild(k);
      // Mehrtagestour: an einem Zwischenziel übernachten teilt die Tour in Etappen
      if (i > 0 && i < S.wps.length - 1) {
        const n = document.createElement('button');
        n.className = 'popup-knopf'; n.textContent = w.nacht ? '🛏 Keine Übernachtung' : '🛏 Hier übernachten';
        n.onclick = () => { karte.closePopup(); nachtUmschalten(i); };
        box.appendChild(document.createTextNode(' ')); box.appendChild(n);
      }
      L.popup({ offset: [0, -8] }).setLatLng(m.getLatLng()).setContent(box).openOn(karte);
    });
    m.addTo(ebenePunkte);
  });
}

// Farbe je Tag einer Mehrtagestour (Tag 1 wie bisher rot)
const TAG_FARBEN = ['#e5532d', '#1f6fd1', '#8e44ad', '#16a085', '#c48a00', '#d6336c'];
const tagFarbe = k => TAG_FARBEN[k % TAG_FARBEN.length];
// Tag (0, 1, …) des Teilstücks k (von Punkt k nach k+1): Zahl der Übernachtungen bis Punkt k
function stueckTag(k) { let t = 0; for (let i = 1; i <= k && i < S.wps.length - 1; i++) if (S.wps[i] && S.wps[i].nacht) t++; return t; }

function zeichenRoute() {
  ebeneRoute.clearLayers();
  ebeneHervor.clearLayers();
  const e = S.ergebnis;
  if (!e || e.pts.length < 2) return;
  const ll = [[]];
  e.pts.forEach(p => { if (p.luecke && ll[ll.length - 1].length) ll.push([]); ll[ll.length - 1].push([p.lat, p.lon]); });
  L.polyline(ll, { color: '#fff', weight: 9, opacity: 0.9, interactive: false }).addTo(ebeneRoute);
  // gerade Linien (Fallback oder weglos) gestrichelt
  let d0 = 0;
  S.stuecke.forEach((s, k) => {
    const d1 = e.stueckEnde[k];
    // Lücken (mehrere Abschnitte einer GPX-Datei) als getrennte Linien
    const teil = [[]];
    e.pts.filter(p => p.d >= d0 - 0.01 && p.d <= d1 + 0.01).forEach(p => { if (p.luecke && teil[teil.length - 1].length) teil.push([]); teil[teil.length - 1].push([p.lat, p.lon]); });
    const linie = L.polyline(teil, { color: S.fest ? '#e5532d' : tagFarbe(stueckTag(k)), weight: 5, opacity: 0.95, dashArray: s.quelle === 'linie' ? '8 8' : null });
    linie.on('click', ev => {
      L.DomEvent.stop(ev);
      if (kreuzAn) { kreuzHin(ev.latlng); return; }
      if (infoAn) { infoZeigen(ev.latlng); return; }
      if (S.fest) return;
      wegpunktDazu(ev.latlng.lat, ev.latlng.lng, k + 1);
    });
    linie.addTo(ebeneRoute);
    d0 = d1;
  });
  if (S.fest) {
    const p0 = e.pts[0], p1 = e.pts[e.pts.length - 1];
    L.marker([p0.lat, p0.lon], { interactive: false, icon: L.divIcon({ className: '', html: '<div class="wp start">S</div>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(ebeneRoute);
    L.marker([p1.lat, p1.lon], { interactive: false, icon: L.divIcon({ className: '', html: '<div class="wp ziel">Z</div>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(ebeneRoute);
  }
}

async function neuBerechnen() {
  const nr = ++lauf;
  nachtAnRaendernWeg();
  zeichenWegpunkte();
  // ein früher Rücksprung beendet auch eine laufende Berechnung: deren Ergebnis wird verworfen (nr !== lauf),
  // ohne dass sie S.rechnet zurücksetzt, sonst blieben Speichern, GPX, Link und Drucken gesperrt
  if (S.fest) { S.rechnet = false; auswertenUndZeigen(); return; }
  if (S.wps.length < 2) {
    S.rechnet = false;
    S.stuecke = []; S.ergebnis = null;
    zeichenRoute(); zeigen();
    $('status').textContent = S.wps.length === 1 ? 'Start gesetzt. Jetzt das Ziel antippen.' : '';
    if (seite === 'karte' && S.wps.length === 1) melde('Start gesetzt. Jetzt das Ziel antippen.', 4);   // ohne Blatt sähe man den Status nicht
    entwurfSichern();
    return;
  }
  const paare = [];
  for (let i = 0; i < S.wps.length - 1; i++) paare.push([S.wps[i], S.wps[i + 1]]);
  const offen = paare.filter(([a, b]) => !cache.has(schluessel(a, b, S.profil))).length;
  // bis das neue Ergebnis da ist: altes Ergebnis nicht speichern, exportieren oder in den Entwurf packen
  S.stueckeFuer = '';
  if (offen) { $('status').textContent = 'Route wird berechnet …'; S.rechnet = true; zeigen(); }
  const fehler = [];
  const stuecke = await Promise.all(paare.map(async ([a, b], i) => {
    const k = schluessel(a, b, S.profil);
    if (cache.has(k)) return cache.get(k);
    try {
      if (!laufend.has(k)) {
        const p = S.profil;
        laufend.set(k, teilstueck(a, b, p).then(s => { cache.set(k, s); return s; }).finally(() => laufend.delete(k)));
      }
      return await laufend.get(k);
    } catch (err) {
      if (ersatz.has(k)) return ersatz.get(k);   // alte gespeicherte Linie ist besser als eine gerade Ersatzlinie
      fehler.push('Abschnitt ' + (i + 1) + ': ' + kuerzen(err.message));
      const s = R.linie(a, b);
      s.quelle = 'linie';
      return s;
    }
  }));
  if (nr !== lauf) return;   // inzwischen neu geplant
  S.stuecke = stuecke;
  S.stueckeFuer = stueckSignatur();
  S.rechnet = false;
  auswertenUndZeigen();
  // erste Route am Telefon: Blatt halb öffnen, sonst sieht man nur den Kopf und keine Funktionen
  if (window.innerWidth <= 760 && $('panel').classList.contains('klein') && S.wps.length === 2) blatt('mittel');
  // auf der reinen Karte geplant (Start der App am Telefon): mit der ersten Route zum Planen, sonst sähe man das Ergebnis nicht
  if (seite === 'karte' && S.wps.length === 2) reiter('planen');
  $('status').innerHTML = fehler.length
    ? '<div class="fehler">Kein Weg gefunden, dort gerade Linie (gestrichelt). ' + R.esc(fehler.join(' · ')) + '</div>'
    : '';
  entwurfSichern();
}

function kuerzen(t) {
  t = String(t || '');
  if (/island|not mapped|position not/i.test(t)) return 'Punkt liegt nicht an einem Weg';
  if (/Failed to fetch|keine Verbindung/i.test(t)) return 'keine Verbindung zum Routendienst';
  return t.length > 90 ? t.slice(0, 90) + '…' : t;
}

// Tempo für die Zeitrechnung: beim Laufen das Lauftempo (min/km), sonst der Faktor
function artAktuell() { return (PROFILE[S.profil] || PROFILE.wandern).art; }
function tempoAktuell() { return artAktuell() === 'lauf' ? S.pace : S.tempo; }
// Laufen zeigt die Auswahl des Lauftempos statt „Zügig … Mit Kind“
function tempoFelder() {
  const lauf = artAktuell() === 'lauf';
  $('pacewahlFeld').hidden = !lauf;
  $('tempowahlFeld').hidden = lauf;
}

function auswertenUndZeigen() {
  tempoFelder();
  $('familie').textContent = '';   // Familien-Check gilt für die alte Route
  // Marke vom Antippen des Höhenprofils gehört zur alten Route (am Touchscreen gibt es kein „Maus weg“, das sie entfernt)
  profilWeg();
  S.ergebnis = S.stuecke.length ? R.auswerten(S.stuecke, tempoAktuell(), artAktuell()) : null;
  zeichenRoute();
  zeigen();
}

function balken(ziel, eintraege, farben, fn) {
  const ges = eintraege.reduce((s, x) => s + x[1], 0) || 1;
  ziel.innerHTML = '';
  for (const [name, m] of eintraege) {
    if (m < 1) continue;
    const div = document.createElement('div');
    div.className = 'eintrag';
    div.innerHTML = '<span>' + R.esc(name) + '</span><span>' + R.kmText(m) + ' · ' + Math.max(1, Math.round(m / ges * 100)) + ' %</span>' +
      '<div class="spur"><i style="width:' + (m / ges * 100).toFixed(1) + '%;background:' + (farben[name] || '#9aa59c') + '"></i></div>';
    div.onclick = () => {
      const an = !div.classList.contains('an');
      document.querySelectorAll('.balken .eintrag.an').forEach(x => x.classList.remove('an'));
      ebeneHervor.clearLayers();
      if (an) { div.classList.add('an'); hervorheben(a => fn(a.tags) === name, farben[name] || '#333'); }
    };
    ziel.appendChild(div);
  }
}

function hervorheben(test, farbe) {
  const e = S.ergebnis;
  if (!e) return;
  const stuecke = [];
  for (const a of e.abschnitte) {
    if (!test(a)) continue;
    const teil = e.pts.filter(p => p.d >= a.von - 1 && p.d <= a.bis + 1).map(p => [p.lat, p.lon]);
    if (teil.length > 1) stuecke.push(teil);
  }
  if (!stuecke.length) return;
  L.polyline(stuecke, { color: '#111', weight: 11, opacity: 0.35, interactive: false }).addTo(ebeneHervor);
  L.polyline(stuecke, { color: farbe, weight: 6, opacity: 1, interactive: false }).addTo(ebeneHervor);
}

const FARBE_WEG = { 'Pfad': '#8b5a2b', 'Forst- und Feldweg': '#c49a5a', 'Fußweg': '#5c9d6a', 'Nebenstraße': '#9aa3ad', 'Straße': '#5f6b78', 'Radweg': '#3d7fc4', 'Treppe': '#b03a2e', 'Fähre': '#2c7fb8', 'Sonstiges': '#a0a0a0', 'Unbekannt': '#cfcfcf' };
const FARBE_BODEN = { 'Befestigt': '#6d7884', 'Schotter': '#c9a66b', 'Naturboden': '#8b5a2b', 'Fels': '#7b7b7b', 'Unbekannt': '#cfcfcf' };

// ---------- Planen in Reitern: Route · Überblick · Vorbereiten (ohne Route nur der Teil „Route“ mit den Einstiegen) ----------
let planTeil = 'route';
function planReiterZeigen() {
  const mitRoute = !!S.ergebnis;
  const teil = mitRoute ? planTeil : 'route';
  $('planReiter').hidden = !mitRoute;
  document.querySelectorAll('#planReiter [data-plan]').forEach(b => {
    const an = b.dataset.plan === teil;
    b.classList.toggle('an', an); b.setAttribute('aria-selected', String(an));
  });
  document.querySelectorAll('section[data-reiter=planen] .planteil').forEach(d => { d.hidden = d.dataset.planteil !== teil; });
  // Punkt am Reiter „Vorbereiten“: der Zeitplan warnt (knapp vor Sonnenuntergang, Stopp geschlossen)
  $('planWarnPunkt').hidden = !mitRoute || teil === 'vorbereiten' || !$('zeitplan').classList.contains('warnung');
}
function planTeilWaehlen(t) {
  planTeil = t;
  planReiterZeigen();
  $('panel').querySelector('.inhalt').scrollTop = 0;
  if (t === 'ueberblick' && typeof profilZeichnen === 'function' && S.ergebnis) profilZeichnen();   // Leinwand war verborgen
}
document.querySelectorAll('#planReiter [data-plan]').forEach(b => { b.onclick = () => planTeilWaehlen(b.dataset.plan); });
$('bPlanLos').onclick = () => {
  if (!S.ergebnis) return;
  const laeuft = /beenden/.test($('bNavi').textContent);
  reiter('unterwegs');
  if (!laeuft) $('bNavi').click();
};

function zeigen() {
  const e = S.ergebnis;
  $('einstiege').hidden = S.wps.length > 0 || !!S.fest;
  if (!$('einstiege').hidden) letzteTourZeigen();
  if (!e) profilWeg();   // ohne Route keine Marke vom Höhenprofil
  $('ergebnisRoute').hidden = !e;
  planReiterZeigen();
  einstellTextSetzen(); planDetailsTextSetzen();
  if (seite === 'tour') tourSeiteZeigen();   // Kennzahlen einer eben geöffneten Tour kommen nach dem Rechnen
  // Tipp zu Zwischenpunkten nur, bis man es einmal gemacht hat (drei Punkte)
  if (S.wps.length >= 3 && !SPEICHER.lesen('tippGesehen', false)) SPEICHER.schreiben('tippGesehen', true);
  $('planHinweis').hidden = S.wps.length < 2 || !!S.fest || SPEICHER.lesen('tippGesehen', false);
  $('ergebnis').hidden = !e;
  $('bZurueck').disabled = !S.verlauf.length || !!S.fest;
  $('bRund').disabled = S.wps.length < 2 || !!S.fest;
  $('bUmkehren').disabled = S.wps.length < 2 && !S.fest;
  $('bNeu').disabled = !S.wps.length && !S.fest;
  $('bOrdnen').hidden = S.wps.length < 4 || !!S.fest;
  $('bDrucken').disabled = !e || !!S.rechnet;
  $('bPlanLos').disabled = !e || !!S.rechnet;
  ['bSpeichern', 'bGpx', 'bTeilen'].forEach(id => { $(id).disabled = !e || !!S.rechnet; });
  $('bTeilen').disabled = !e || !!S.fest || !!S.rechnet;
  // Kopfzeile: Kennzahlen, sonst der nächste Schritt (am Telefon ist anfangs nur der Kopf zu sehen)
  $('kopfZahlen').textContent = e ? R.kmText(e.laenge) + ' · ' + R.zeitText(e.zeit + besichtigung() / 60) + (e.tief != null ? ' · ↑ ' + e.auf + ' m' : '')
    : S.wps.length === 1 ? 'Jetzt das Ziel antippen' : 'Auf die Karte tippen: Start';
  stoppsZeigen();
  if (!e) { profilZeichnen(); return; }
  const art = (PROFILE[S.profil] || PROFILE.wandern).art;
  const besicht = besichtigung();
  $('zLaenge').textContent = R.kmText(e.laenge);
  $('zZeit').textContent = R.zeitText(e.zeit + besicht / 60);
  $('zZeitText').textContent = besicht ? 'inkl. ' + R.zeitText(besicht / 60) + ' Besichtigung' : art === 'rad' ? 'Fahrzeit (grob)' : art === 'lauf' ? 'Laufzeit bei ' + R.paceText(S.pace) : 'Gehzeit ohne Pausen';
  $('zAuf').textContent = e.tief == null ? '–' : e.auf + ' m';
  $('zAb').textContent = e.tief == null ? '–' : e.ab + ' m';
  $('zHoch').textContent = e.hoch == null ? '–' : e.hoch + ' m';
  $('zSchwer').textContent = e.sac ? 'T' + e.sac.stufe : '–';
  $('zSchwer').parentNode.title = e.sac ? e.sac.text + ' (auf ' + R.kmText(e.sac.meter) + ')' : 'In OSM nicht erfasst';
  const kw = e.kinderwagen;
  const zeichen = { ja: '✅', 'mit Mühe': '⚠️', nein: '⛔', unklar: '❔' }[kw.urteil];
  const text = { ja: 'Kinderwagen: wahrscheinlich gut machbar', 'mit Mühe': 'Kinderwagen: nur mit geländegängigem Wagen', nein: 'Kinderwagen: eher nicht, besser Trage', unklar: 'Kinderwagen: unklar' }[kw.urteil];
  $('kinderwagen').innerHTML = '<span class="gross">' + zeichen + '</span><div><b>' + text + '</b>' +
    (kw.gruende.length ? '<br><span class="klein">' + R.esc(kw.gruende.join(' · ')) + '</span>' : '') +
    (e.sac ? '<br><span class="klein">Schwierigste Stelle: ' + R.esc(e.sac.text) + '</span>' : '') + '</div>';
  $('kinderwagen').hidden = !e.abschnitte.some(a => Object.keys(a.tags).length);
  balken($('wege'), e.wege, FARBE_WEG, R.wegtyp);
  balken($('boden'), e.boden, FARBE_BODEN, R.untergrund);
  zeitplanZeigen();
  profilZeichnen();
}

// Zeitplan: Tag, Startzeit und Pausen gegen den Sonnenuntergang am Ziel (ohne Netz gerechnet)
function zeitplanZeigen() {
  const e = S.ergebnis, box = $('zeitplan');
  $('anreise').hidden = !e || !e.pts.length;
  if (!e || !e.pts.length) { box.hidden = true; return; }
  // Anreise zum Start (Fahrplan und Weg rechnet Google Maps; am Telefon öffnet sich die App)
  $('anreiseOepnv').href = R.anreiseLink(e.pts[0].lat, e.pts[0].lon, 'oepnv');
  $('anreiseAuto').href = R.anreiseLink(e.pts[0].lat, e.pts[0].lon, 'auto');
  const tag = $('startTag').value ? new Date($('startTag').value + 'T12:00') : new Date();
  const ziel = e.pts[e.pts.length - 1];
  const unter = R.sonnenuntergang(tag, ziel.lat, ziel.lon);
  const pause = +$('pausewahl').value || 0;
  const [h, m] = ($('startZeit').value || '').split(':').map(Number);
  const start = $('startZeit').value ? new Date(tag.getFullYear(), tag.getMonth(), tag.getDate(), h, m) : null;
  const z = R.zeitplan(start, e.zeit + besichtigung() / 60, pause, unter);
  const sonne = unter ? 'Sonnenuntergang ' + R.uhr(unter) + ' Uhr' : '';
  // liegt eine Uhrzeit an einem anderen Tag als der Tourtag (sehr lange Touren), steht das Datum dabei
  const amTag = d => d.toDateString() === tag.toDateString() ? '' : ' (' + d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' }) + ')';
  let text;
  if (start) {
    text = 'Start ' + R.uhr(start) + ' → Ankunft etwa ' + R.uhr(z.ankunft) + ' Uhr' + amTag(z.ankunft) + (pause ? ' (mit ' + R.zeitText(pause / 60) + ' Pause)' : '') + (sonne ? ' · ' + sonne : '');
    if (unter) text += z.knapp ? '. ⚠️ Knapp: spätestens um ' + R.uhr(z.spaetestens) + ' Uhr' + amTag(z.spaetestens) + ' losgehen (30 min Reserve).' : ' · ' + R.zeitText(z.puffer / 60) + ' Reserve.';
  } else {
    text = sonne ? sonne + ': spätestens um ' + R.uhr(z.spaetestens) + ' Uhr' + amTag(z.spaetestens) + ' losgehen' + (pause ? ' (mit ' + R.zeitText(pause / 60) + ' Pause)' : '') + ', mit 30 min Reserve. Startzeit eintragen zeigt die Ankunft.' : '';
  }
  // Mehrtagestour: Zeitplan je Tag in den Etappen statt eines Tages
  const et = etappenAktuell();
  let etKnapp = false;
  if (et) {
    etKnapp = etappenZeigen(et, tag, start ? [h, m] : null, pause);
    text = et.length + ' Etappen, ' + R.kmText(e.laenge) + ' in ' + R.zeitText(e.zeit + besichtigung() / 60) + ' Gehzeit: Zeitplan je Tag unter „Etappen“.' +
      (etKnapp ? ' ⚠️ An mindestens einem Tag wird es vor Sonnenuntergang knapp.' : '');
  } else { $('etappen').hidden = true; $('etappen').innerHTML = ''; }
  if (typeof naviEtappenFeld === 'function') naviEtappenFeld();
  tageSchalterZeigen();
  // Stopps mit Öffnungszeiten: geschlossen oder knapp bei Ankunft?
  const probleme = start ? besuchProbleme() : 0;
  if (probleme) text += ' ⚠️ ' + (probleme === 1 ? 'Ein Stopp ist' : probleme + ' Stopps sind') + ' bei Ankunft geschlossen oder knapp (siehe Stopps).';
  else if (!start && S.wps.some(w => w.info && w.info.oh)) text += (text ? ' ' : '') + 'Mit Startzeit prüft die App, ob die Stopps bei Ankunft geöffnet sind.';
  if (typeof tourWetterPruefen === 'function') tourWetterPruefen();
  if (typeof packlisteNeu === 'function') packlisteNeu();   // offene Packliste folgt Zeitplan und Route
  planReiterZeigen();
  box.textContent = text;
  box.classList.toggle('warnung', !!((et ? etKnapp : z.knapp) || probleme || (!et && !start && z.spaetestens && z.spaetestens < new Date() && !$('startTag').value)));
  box.hidden = !text;
}
// Startzeit und Pausen verschieben auch die Ankunft an den Stopps (Öffnungszeiten)
['startTag', 'startZeit', 'pausewahl'].forEach(id => $(id).addEventListener('change', () => { zeitplanZeigen(); stoppsZeigen(); entwurfSichern(); planDetailsTextSetzen(); }));
// Zeitplan der Planung (Tag, Startzeit, Pausen): gehört zu Entwurf und Tour
function zeitplanLesen() {
  const z = { tag: $('startTag').value || '', start: $('startZeit').value || '', pause: +$('pausewahl').value || 0 };
  const tage = (S.tagesStart || []).slice();
  while (tage.length && !tage[tage.length - 1]) tage.pop();
  if (tage.length) z.tage = tage;
  return z.tag || z.start || z.pause || z.tage ? z : null;
}
// Startzeit an Tag k+1 einer Mehrtagestour ('HH:MM'): eigene, sonst die von Tag 1; '' ohne Startzeit
function tagStart(k) { return (k > 0 && S.tagesStart && S.tagesStart[k]) || $('startZeit').value || ''; }
const minutenAus = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
function zeitplanSetzen(z) {
  S.tagesStart = z && Array.isArray(z.tage) ? z.tage.slice() : [];
  $('startTag').value = (z && z.tag) || '';
  $('startZeit').value = (z && z.start) || '';
  $('pausewahl').value = String((z && z.pause) || 0);
  if (!$('pausewahl').value) $('pausewahl').value = '0';
}

// Besichtigungszeit aller Stopps in Minuten (das Ziel einer Rundtour ist der Start und zählt nicht doppelt)
function besichtigung(abIndex) {
  let min = 0;
  const n = S.wps.length;
  S.wps.forEach((w, i) => {
    if (i < (abIndex || 0)) return;
    if (i === n - 1 && n > 2 && R.abstand(w, S.wps[0]) < 30) return;
    min += +w.min || 0;
  });
  return min;
}

// Startzeit des Zeitplans als Date, sonst null
function zeitplanStart() {
  if (!$('startZeit').value) return null;
  const tag = $('startTag').value ? new Date($('startTag').value + 'T12:00') : new Date();
  const [h, m] = $('startZeit').value.split(':').map(Number);
  return new Date(tag.getFullYear(), tag.getMonth(), tag.getDate(), h, m);
}
// Ankunft an jedem Wegpunkt (Date, null ohne Startzeit): Weg bis dorthin nach derselben Formel wie die ganze Tour,
// davor liegende Besichtigungen und ein Anteil der Pausen (verteilt nach Gehzeit)
function stoppAnkunft() {
  const e = S.ergebnis, start = zeitplanStart();
  // während einer Neuberechnung gehört das alte Ergebnis noch zu den alten Wegpunkten: dann keine Ankunft
  if (!e || !start || S.fest || !e.stueckEnde || S.rechnet || e.stueckEnde.length !== S.wps.length - 1) return S.wps.map(() => null);
  const pause = (+$('pausewahl').value || 0) / 60;
  // Mehrtagestour: jede Etappe beginnt am nächsten Tag (eigene Startzeit oder die von Tag 1); Pausen gelten je Tag
  const et = etappenAktuell() || [{ von: 0, bis: S.wps.length - 1, vonD: 0, zeit: e.zeit }];
  let besicht = 0, k = 0;
  return S.wps.map((w, i) => {
    let h = 0;
    if (i > 0) {
      // Weg seit dem Morgen dieses Tages, für sich gerechnet (wie die Etappe selbst)
      const t = R.zeitZwischen(e.pts, et[k].vonD, e.stueckEnde[i - 1], tempoAktuell(), artAktuell());
      // an Tag k+1 ab dessen eigener Startzeit (gegen die von Tag 1 verschoben)
      const versatz = k && tagStart(k) ? (minutenAus(tagStart(k)) - minutenAus($('startZeit').value)) / 60 : 0;
      h = k * 24 + versatz + t + besicht / 60 + (et[k].zeit ? pause * t / et[k].zeit : 0);
    }
    besicht += +w.min || 0;
    const an = new Date(start.getTime() + h * 3600e3);
    // hier übernachtet: der nächste Tag zählt von hier
    if (i === et[k].bis && k < et.length - 1) { k++; besicht = 0; }
    return an;
  });
}

// ---------- Mehrtagestour: Schalter „1 Tag | Mehrere Tage“ und Zahl der Tage ----------
function tageSchalterZeigen() {
  const e = S.ergebnis, et = etappenAktuell();
  $('tageBox').hidden = !e || !!S.fest || S.wps.length < 2;
  if ($('tageBox').hidden) return;
  const mehr = !!et;
  document.querySelectorAll('#tageBox [data-tage]').forEach(b => {
    const an = (b.dataset.tage === 'mehr') === mehr;
    b.classList.toggle('an', an); b.setAttribute('aria-pressed', String(an));
  });
  $('tageHinweis').hidden = !mehr;
  const box = $('tageZahl');
  box.hidden = !mehr;
  box.innerHTML = '';
  if (!mehr) return;
  for (const z of [2, 3, 4, 5]) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip' + (et.length === z ? ' an' : ''); b.dataset.zahl = z;
    b.textContent = z + ' Tage';
    b.onclick = () => tageTeilen(z);
    box.appendChild(b);
  }
}
// Tour in z Tage teilen: vorhandene Punkte nutzen, sonst neue (automatische) Punkte auf der Route; z = 1 nimmt alles zurück
function tageTeilen(z) {
  const e = S.ergebnis;
  if (!e || S.fest || S.rechnet || !e.stueckEnde || e.stueckEnde.length !== S.wps.length - 1) return;
  merken();
  const auf = z > 1 ? R.tagesAufteilung(e.pts, e.stueckEnde, S.wps, z, tempoAktuell(), artAktuell()) : { nacht: [], neu: [] };
  const nacht = new Set(auf.nacht);
  // automatisch gesetzte Punkte, die nicht mehr gebraucht werden, fallen weg; benannte und eigene Punkte bleiben
  let wps = S.wps.map((w, i) => { const x = Object.assign({}, w); delete x.nacht; if (nacht.has(i)) x.nacht = true; x._i = i; return x; });
  for (const p of auf.neu.slice().sort((a, b) => b.vor - a.vor)) wps.splice(wps.findIndex(w => w._i === p.vor), 0, { lat: p.lat, lon: p.lon, nacht: true, auto: true });
  wps = wps.filter((w, i) => !(w.auto && !w.nacht && i > 0 && i < wps.length - 1));
  wps.forEach(w => delete w._i);
  const neuePunkte = wps.length !== S.wps.length || wps.some((w, i) => w.lat !== S.wps[i].lat || w.lon !== S.wps[i].lon);
  S.wps = wps;
  if (neuePunkte) neuBerechnen(); else { zeichenWegpunkte(); zeichenRoute(); zeigen(); entwurfSichern(); }
  melde(z > 1 ? 'Tour in ' + z + ' Tage geteilt (nach Gehzeit)' + (auf.neu.length ? ', ' + (auf.neu.length === 1 ? 'ein Übernachtungspunkt' : auf.neu.length + ' Übernachtungspunkte') + ' auf der Route gesetzt' : '') + '. Ziehen verschiebt sie.' : 'Wieder eine Tagestour.', 5);
}
document.querySelectorAll('#tageBox [data-tage]').forEach(b => {
  b.onclick = () => {
    const mehr = b.dataset.tage === 'mehr', ist = !!etappenAktuell();
    if (mehr === ist) return;
    tageTeilen(mehr ? 2 : 1);
  };
});

// ---------- Mehrtagestour: Etappen an den Übernachtungen ----------
function etappenAktuell() {
  const e = S.ergebnis;
  if (!e || S.fest || S.rechnet || !e.stueckEnde) return null;
  return R.etappen(e.pts, e.stueckEnde, S.wps, tempoAktuell(), artAktuell());
}
// Start oder Ziel mit Übernachtung (das Ziel wurde entfernt, die Reihenfolge verkürzt): Übernachtung streichen, sonst hinge
// sie unsichtbar am Rand und käme später ungefragt zurück
function nachtAnRaendernWeg() {
  const n = S.wps.length;
  for (const i of n ? [0, n - 1] : []) {
    if (!S.wps[i] || !S.wps[i].nacht) continue;
    const w = Object.assign({}, S.wps[i]); delete w.nacht; S.wps[i] = w;
    melde('Die Übernachtung lag jetzt am ' + (i === 0 ? 'Start' : 'Ziel') + ' und ist entfernt.', 5);
  }
}
function nachtUmschalten(i) {
  if (i <= 0 || i >= S.wps.length - 1) return;
  merken();
  const w = Object.assign({}, S.wps[i]);
  if (w.nacht) delete w.nacht; else w.nacht = true;
  S.wps[i] = w;
  zeichenWegpunkte(); zeichenRoute(); zeigen(); entwurfSichern();
  melde(w.nacht ? 'Übernachtung eingetragen: Tag ' + (stueckTag(i) + 1) + ' beginnt hier (siehe Reiter Route).' : 'Übernachtung entfernt.', 5);
}
// je Tag: Strecke, Höhenmeter, Gehzeit, Ziel; mit Startzeit Ankunft gegen den Sonnenuntergang am Etappenziel
function etappenZeigen(et, tag, startZeit, pause) {
  const box = $('etappen');
  box.innerHTML = '';
  let knapp = false;
  et.forEach((s, k) => {
    const d = new Date(tag.getFullYear(), tag.getMonth(), tag.getDate() + k, 12);
    let besicht = 0;
    for (let i = k === 0 ? 0 : s.von + 1; i <= s.bis; i++) besicht += +S.wps[i].min || 0;   // Tag 1 mit der Besichtigung am Start
    const zeit = s.zeit + besicht / 60;
    const unter = s.ziel ? R.sonnenuntergang(d, s.ziel.lat, s.ziel.lon) : null;
    const sz = k && S.tagesStart && S.tagesStart[k] ? S.tagesStart[k].split(':').map(Number) : startZeit;
    const start = sz ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), sz[0], sz[1]) : null;
    const z = R.zeitplan(start, zeit, pause, unter);
    if (z.knapp) knapp = true;
    const ziel = S.wps[s.bis].name || (k === et.length - 1 ? 'Ziel' : 'Übernachtung ' + (k + 1));
    let plan = '';
    if (start && unter) plan = 'Start ' + R.uhr(start) + ', Ankunft etwa ' + R.uhr(z.ankunft) + ' Uhr · Sonnenuntergang ' + R.uhr(unter) + (z.knapp ? ' · ⚠️ knapp, spätestens ' + R.uhr(z.spaetestens) + ' Uhr los' : ' · ' + R.zeitText(z.puffer / 60) + ' Reserve');
    else if (unter) plan = 'spätestens um ' + R.uhr(z.spaetestens) + ' Uhr losgehen (Sonnenuntergang ' + R.uhr(unter) + ')';
    const div = document.createElement('div');
    div.className = 'etappe' + (z.knapp ? ' knapp' : '');
    div.style.setProperty('--tagfarbe', tagFarbe(k));
    div.innerHTML = '<b>Tag ' + (k + 1) + '</b> · ' + R.esc(d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' })) +
      ' · bis ' + R.esc(ziel) + (k < et.length - 1 ? ' 🛏' : '') + '<br><span class="klein">' + R.kmText(s.meter) + ' · ↑ ' + s.auf + ' m · ↓ ' + s.ab + ' m · ' +
      R.zeitText(zeit) + (s.hoch != null ? ' · höchster Punkt ' + s.hoch + ' m' : '') + (plan ? '<br>' + R.esc(plan) : '') + '</span>';
    // ab Tag 2 eine eigene Startzeit (z. B. Frühstück auf der Hütte erst um 7); leer = wie Tag 1
    if (k > 0) {
      const lab = document.createElement('label');
      lab.className = 'klein etappe-start';
      lab.textContent = 'Start an Tag ' + (k + 1) + ' ';
      const inp = document.createElement('input');
      inp.type = 'time'; inp.step = 300; inp.value = (S.tagesStart && S.tagesStart[k]) || ''; inp.dataset.tag = k;
      inp.title = 'leer: wie an Tag 1' + ($('startZeit').value ? ' (' + $('startZeit').value + ')' : '');
      inp.onchange = () => {
        S.tagesStart = (S.tagesStart || []).slice();
        while (S.tagesStart.length <= k) S.tagesStart.push('');
        S.tagesStart[k] = /^\d{2}:\d{2}$/.test(inp.value) ? inp.value : '';
        entwurfSichern(); zeitplanZeigen();
        if (typeof stoppsZeigen === 'function') stoppsZeigen();
      };
      lab.appendChild(inp);
      div.appendChild(lab);
    }
    box.appendChild(div);
  });
  const b = document.createElement('button');
  b.className = 'knopf'; b.id = 'bEtappenReise'; b.textContent = '📔 Als Reise ins Tagebuch';
  b.onclick = () => etappenAlsReise(et.length, tag);
  box.appendChild(b);
  box.hidden = false;
  return knapp;
}
// Reise im Tagebuch über die Tage der Etappen anlegen (gegangene Touren dieser Tage zeigt das Tagebuch von selbst)
function etappenAlsReise(tage, tag) {
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const von = iso(tag), bis = iso(new Date(tag.getFullYear(), tag.getMonth(), tag.getDate() + tage - 1));
  const name = ((S.name || '').trim() || 'Mehrtagestour').slice(0, 120);
  const d = tagebuchLesen();
  if (d.reisen.some(r => r.name === name && r.von === von && r.bis === bis)) { melde('Diese Reise steht schon im Tagebuch.'); return; }
  d.reisen.push({ id: 'r' + tbId(), name, von, bis });
  if (!tagebuchSchreiben(d)) return;
  melde('Reise „' + name + '“ (' + tage + ' Tage) im Tagebuch angelegt.', 5);
  reiter('tagebuch');
  reiseZeigen(d.reisen[d.reisen.length - 1].id);
}
// Zeile unter einem Stopp: geöffnet bei Ankunft? (nur mit Öffnungszeiten aus OSM)
function besuchHtml(w, an) {
  const oh = w.info && w.info.oh;
  if (!oh) return an && w.name ? '<small>an ' + R.uhr(an) + ' Uhr</small>' : '';
  const quelle = ohQuelleHtml(w);
  if (!an) return '<small>' + oeffnungKurz(oh) + '</small>' + quelle;
  const b = R.oeffnungBesuch(oh, an, +w.min || 0);
  if (b.zustand === 'unbekannt') return '<small>an ' + R.uhr(an) + ' Uhr · Öffnungszeiten: ' + R.esc(oh) + '</small>' + quelle;
  // vage: laut OSM wohl geöffnet, aber ohne sichere Uhrzeit (keine Warnung, aber auch kein grünes „geöffnet“)
  const zeichen = { offen: '●', knapp: '⚠️', zu: '⛔', vage: '❔' }[b.zustand];
  return '<small>an ' + R.uhr(an) + ' Uhr · <span class="oh oh-' + ({ offen: 'offen', knapp: 'bald', zu: 'zu', vage: 'vage' }[b.zustand]) + '">' + zeichen + ' ' + R.esc(b.text) + '</span></small>' + quelle;
}
// woher die Zeiten stammen, wie alt sie sind, und wo man nachsieht (OSM irrt bei Sanierung und Saisonpause, Abgleich 03.11.)
function ohQuelleHtml(w) {
  const i = w.info || {}, stand = R.ohStand(i.ohd, new Date());
  return '<small class="oh-quelle">laut OpenStreetMap' + (stand ? ', ' + R.esc(stand.text) + (stand.alt ? ' ⚠️ über 2 Jahre alt' : '') : '') + ' · ' +
    (i.web ? '<a href="' + R.esc(i.web) + '" target="_blank" rel="noopener">Webseite</a> · ' : '') +
    '<a href="' + R.esc(R.googleOrtLink(w.name || '', i.adr || '', w.lat, w.lon)) + '" target="_blank" rel="noopener">Google Maps</a></small>';
}
// Stopps, die bei Ankunft zu sind oder knapp werden (für den Hinweis im Zeitplan)
function besuchProbleme() {
  const an = stoppAnkunft();
  return S.wps.map((w, i) => w.info && w.info.oh && an[i] ? R.oeffnungBesuch(w.info.oh, an[i], +w.min || 0).zustand : '')
    .filter(z => z === 'zu' || z === 'knapp').length;
}

// Liste der Stopps mit Besichtigungszeit (sobald ein Punkt einen Namen hat oder im Stadtmodus)
const MINUTEN = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180];
function stoppsZeigen() {
  const box = $('stopps');
  box.innerHTML = '';
  // Liste in der Stadt, mit benannten Stopps oder ab einem Zwischenpunkt (dann lässt sich umsortieren)
  if (S.fest || S.wps.length < 2 || !(S.modus === 'stadt' || S.wps.length >= 3 || S.wps.some(w => w.name || w.nacht))) return;
  const n = S.wps.length, ankunft = stoppAnkunft();
  // verschiebbar ist alles außer dem Start und, bei einer Rundtour, dem Schluss (der Start bleibt, „⇄ Umkehren“ dreht die Tour)
  const rundTour = n > 2 && R.abstand(S.wps[n - 1], S.wps[0]) < 30, letzter = rundTour ? n - 2 : n - 1;
  const mehrtags = S.wps.some(w => w.nacht);
  const tagKopf = k => {
    const h = document.createElement('div');
    h.className = 'stopp-tag'; h.style.setProperty('--tagfarbe', tagFarbe(k)); h.textContent = 'Tag ' + (k + 1);
    box.appendChild(h);
  };
  if (mehrtags) tagKopf(0);
  S.wps.forEach((w, i) => {
    const rund = i === n - 1 && n > 2 && R.abstand(w, S.wps[0]) < 30;
    const d = document.createElement('div');
    d.className = 'stopp';
    const nr = i === 0 ? 'S' : rund ? 'S' : i === n - 1 ? 'Z' : String(i);
    d.innerHTML = '<span class="nr' + (nr === 'S' ? ' s' : '') + '">' + nr + '</span><span class="name">' +
      R.esc(w.name || (i === 0 ? 'Start' : rund ? 'zurück zum Start' : i === n - 1 ? 'Ziel' : 'Punkt ' + i)) + (w.nacht ? ' 🛏' : '') + besuchHtml(w, ankunft[i]) + '</span>';
    if (!rund) {
      const sel = document.createElement('select');
      sel.title = 'Besichtigungszeit';
      const wert = +w.min || 0;
      MINUTEN.concat(MINUTEN.includes(wert) ? [] : [wert]).sort((a, b) => a - b).forEach(m => {
        const o = document.createElement('option'); o.value = m; o.textContent = m ? m + ' min' : '– min'; if (m === wert) o.selected = true; sel.appendChild(o);
      });
      sel.onchange = () => { S.wps[i] = Object.assign({}, S.wps[i], { min: +sel.value }); entwurfSichern(); zeigen(); };
      d.appendChild(sel);
    }
    if (i >= 1 && i <= letzter && letzter >= 2) {
      for (const [zeichen, d2, titel] of [['▲', -1, 'Nach oben'], ['▼', 1, 'Nach unten']]) {
        const b = document.createElement('button');
        b.className = 'schieben'; b.textContent = zeichen; b.title = titel; b.setAttribute('aria-label', titel);
        b.disabled = i + d2 < 1 || i + d2 > letzter;
        b.onclick = () => stoppVerschieben(i, d2);
        d.appendChild(b);
      }
    }
    // Mehrtagestour: an jedem Zwischenpunkt den Tag beenden (oder die Übernachtung wieder weg)
    if (mehrtags && i > 0 && i < n - 1) {
      const b = document.createElement('button');
      b.className = 'nacht-knopf' + (w.nacht ? ' an' : '');
      b.textContent = '🛏'; b.title = w.nacht ? 'Übernachtung entfernen' : 'Tag hier beenden';
      b.setAttribute('aria-label', b.title); b.setAttribute('aria-pressed', String(!!w.nacht));
      b.onclick = () => nachtUmschalten(i);
      d.appendChild(b);
    }
    const x = document.createElement('button');
    x.title = 'Entfernen'; x.textContent = '✕';
    x.onclick = () => wegpunktWeg(i);
    d.appendChild(x);
    box.appendChild(d);
    if (mehrtags && w.nacht && i > 0 && i < n - 1) {
      const t = document.createElement('div');
      t.className = 'stopp-nacht'; t.textContent = '🛏 Übernachtung';
      box.appendChild(t);
      tagKopf(stueckTag(i));
    }
  });
  if (S.wps.some(w => w.info && w.info.oh)) {
    const hinweis = document.createElement('p');
    hinweis.className = 'klein oh-hinweis';
    hinweis.textContent = 'Öffnungszeiten aus OpenStreetMap, von Freiwilligen eingetragen und nicht immer aktuell (Sanierung, Saisonpause). ' +
      'In einer Stichprobe stimmten 11 von 19 mit Google überein, keine Quelle war durchweg richtig: vor dem Besuch über Webseite oder Google Maps nachsehen.';
    box.appendChild(hinweis);
  }
}

// Stopp eine Stelle nach oben oder unten; Rückgängig holt die alte Reihenfolge
function stoppVerschieben(i, d) {
  const j = i + d;
  if (j < 1 || j >= S.wps.length) return;
  merken();
  const w = S.wps.slice();
  [w[i], w[j]] = [w[j], w[i]];
  S.wps = w;
  neuBerechnen();
}

// Reihenfolge der Stopps verkürzen; Start bleibt, eine Rundtour bleibt eine Rundtour
$('bOrdnen').onclick = () => {
  const n = S.wps.length;
  if (n < 4) return;
  const rund = R.abstand(S.wps[0], S.wps[n - 1]) < 30;
  const mitte = rund ? S.wps.slice(1, -1) : S.wps.slice(1);
  const vorher = R.wegLaenge(S.wps[0], mitte, rund);
  const neu = R.wegOrdnen(S.wps[0], mitte, rund);
  const nachher = R.wegLaenge(S.wps[0], neu, rund);
  if (nachher >= vorher - 1) { melde('Die Reihenfolge ist schon kurz.'); return; }
  merken();
  S.wps = [S.wps[0]].concat(neu, rund ? [S.wps[n - 1]] : []);
  melde('Reihenfolge geändert: etwa ' + R.kmText(vorher - nachher) + ' kürzer (Luftlinie).');
  neuBerechnen();
};

// Bedienknöpfe
$('bZurueck').onclick = rueckgaengig;
function rueckgaengig() {
  if (!S.verlauf.length || S.fest) return;
  const v = JSON.parse(S.verlauf.pop());
  S.wps = Array.isArray(v) ? v : v.wps;
  if (v.profil && PROFILE[v.profil] && v.profil !== S.profil) { S.profil = v.profil; $('profilwahl').value = v.profil; }
  neuBerechnen();
}
$('bRund').onclick = () => { if (S.wps.length >= 2) wegpunktDazu(S.wps[0].lat, S.wps[0].lon); };

// Runde mit Wunschlänge: Dreieck ab dem Start (sonst Standort, sonst Kartenmitte), über Wege geroutet; ist die Länge
// mehr als 12 % daneben, wird das Dreieck mit dem gemessenen Umweg neu bemessen (höchstens dreimal)
let rundRichtung = Math.floor(Math.random() * 360), rundLaeuft = false;
$('bRunde').onclick = () => {
  const auf = $('rundFeld').hidden;
  $('rundFeld').hidden = !auf;
  $('bRunde').setAttribute('aria-expanded', String(auf));
};
async function rundkurs(andereRichtung) {
  if (rundLaeuft) return;
  if (S.fest) { melde('Das ist eine geöffnete Spur. Für eine neue Planung „✕ Neu“ tippen.'); return; }
  const soll = +$('rundLaenge').value * 1000;
  let start = S.wps[0], woher = '';
  if (!start) {
    if (standortFrisch()) { start = { lat: U.pos.lat, lon: U.pos.lon }; woher = ' ab deinem Standort'; }
    else { const c = karte.getCenter(); start = { lat: c.lat, lon: c.lng }; woher = ' ab der Kartenmitte'; }
  }
  if (andereRichtung) rundRichtung = (rundRichtung + 72) % 360;
  rundLaeuft = true;
  $('bRundeLos').disabled = $('bRundeAnders').disabled = true;
  merken();
  try {
    let umweg = 1.3;
    for (let versuch = 0; versuch < 3; versuch++) {
      const [p1, p2] = R.rundkursPunkte(start, soll, rundRichtung, umweg);
      const meine = [{ lat: start.lat, lon: start.lon }, p1, p2, { lat: start.lat, lon: start.lon }];
      S.wps = meine;
      const rechnung = neuBerechnen(), meinLauf = lauf;
      await rechnung;
      // inzwischen anders geplant (Punkt gesetzt oder gezogen, umgekehrt, Tour geöffnet, Neu): diese Runde nicht weiter
      // verfolgen; Punkt setzen und ziehen ändern dasselbe Feld, darum zählt die Laufnummer der Berechnung
      if (S.wps !== meine || lauf !== meinLauf) return;
      if (!S.ergebnis || S.stuecke.some(s => s.quelle === 'linie')) break;
      const ist = S.ergebnis.laenge;
      if (Math.abs(ist - soll) / soll <= 0.12) break;
      umweg = Math.min(3, Math.max(1, umweg * ist / soll));
    }
    if (S.ergebnis) {
      einpassen(L.latLngBounds(S.ergebnis.pts.map(p => [p.lat, p.lon])));
      melde('Runde' + woher + ': ' + R.kmText(S.ergebnis.laenge) + ' (gewünscht ' + R.kmText(soll) + '). Punkte lassen sich ziehen.', 6);
    }
  } finally {
    rundLaeuft = false;
    $('bRundeLos').disabled = false;
    $('bRundeAnders').disabled = !S.ergebnis;
  }
}
$('bRundeLos').onclick = () => rundkurs(false);
$('bRundeAnders').onclick = () => rundkurs(true);
$('bUmkehren').onclick = () => {
  if (S.fest) { spurUmkehren(S.fest.pts); S.stuecke = [{ pts: S.fest.pts, abschnitte: S.fest.abschnitte ? S.fest.abschnitte.slice().reverse() : [], quelle: 'spur' }]; auswertenUndZeigen(); return; }
  merken(); S.wps.reverse(); neuBerechnen();
};
// Spur umkehren: eine Lücke steht am ersten Punkt nach dem Sprung; umgekehrt ist das der Punkt, der vorher davor lag
function spurUmkehren(pts) {
  const luecke = pts.map(p => !!p.luecke);
  pts.forEach((p, i) => { if (luecke[i + 1]) p.luecke = true; else delete p.luecke; });
  pts.reverse();
}
$('bNeu').onclick = () => {
  ebeneDateiPunkte.clearLayers();   // Wegpunkte einer geöffneten GPX-Tour (60-touren.js)
  ebeneFotos.clearLayers();
  if (S.wps.length) merken();
  S.wps = []; S.fest = null; S.tourId = null; S.name = ''; $('tourname').value = ''; zeitplanSetzen(null);
  ebeneOrte.clearLayers();
  neuBerechnen();
};
$('profilwahl').onchange = e => {
  S.profil = e.target.value; SPEICHER.schreiben('profil', S.profil);
  tempoFelder();
  einstellTextSetzen();
  // wer laufen geht, will meist die Kilometer hören: einmal einschalten, abschalten bleibt möglich
  if (artAktuell() === 'lauf' && !SPEICHER.lesen('kmAnsageGewaehlt', false)) { $('kmAnsage').checked = true; SPEICHER.schreiben('kmAnsage', true); }
  neuBerechnen();
};
$('pacewahl').onchange = e => { S.pace = +e.target.value; einstellTextSetzen(); SPEICHER.schreiben('pace', S.pace); if (S.stuecke.length) auswertenUndZeigen(); };
// „Mehr“ in der Aktionsleiste (nur am Telefon sichtbar): weitere Funktionen auf- und zuklappen
$('bMehr').onclick = () => {
  const offen = !$('aktionen').classList.contains('offen');
  $('aktionen').classList.toggle('offen', offen);
  $('bMehr').setAttribute('aria-expanded', String(offen));
  $('bMehr').innerHTML = offen ? '▴<span class="txt"> Weniger</span>' : '⋯<span class="txt"> Mehr</span>';
  $('bMehr').setAttribute('aria-label', offen ? 'Weniger' : 'Mehr');
};
$('tempowahl').onchange = e => { S.tempo = +e.target.value; einstellTextSetzen(); SPEICHER.schreiben('tempo', S.tempo); if (S.stuecke.length) auswertenUndZeigen(); };
$('tourname').oninput = e => { S.name = e.target.value; entwurfSichern(); planDetailsTextSetzen(); };

// Aufklappbare Zeilen im Planen (am Telefon; am PC ist der Inhalt immer offen, die Kopfzeile versteckt)
function klapp(box, auf) {
  box.classList.toggle('offen', auf);
  box.querySelector('.klapp-kopf').setAttribute('aria-expanded', String(auf));
}
document.querySelectorAll('.klapp-kopf').forEach(b => { b.onclick = () => klapp(b.parentElement, !b.parentElement.classList.contains('offen')); });
// Art und Tempo in einer Zeile: „🥾 Wandern · Normal“ (Werte auch nach Tour öffnen oder Rundgang, darum aus den Feldern)
const ART_ZEICHEN = { wandern: '🥾', stadt: '🚶', laufen: '🏃', rad: '🚲', kurz: '📏', linie: '📐' };
function gewaehlt(id) { const s = $(id); return s.selectedIndex >= 0 ? s.options[s.selectedIndex].text : ''; }
function einstellTextSetzen() {
  const p = $('profilwahl').value;
  $('einstellText').textContent = (ART_ZEICHEN[p] || '🥾') + ' ' + gewaehlt('profilwahl') + ' · ' + gewaehlt(artAktuell() === 'lauf' ? 'pacewahl' : 'tempowahl');
}
// Name und Zeitplan in einer Zeile: was eingetragen ist, sonst wozu die Zeile da ist
function planDetailsTextSetzen() {
  const teile = [];
  if ((S.name || '').trim()) teile.push(S.name.trim());
  if ($('startTag').value) teile.push(new Date($('startTag').value + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' }));
  if ($('startZeit').value) teile.push('ab ' + $('startZeit').value);
  if (+$('pausewahl').value) teile.push(gewaehlt('pausewahl') + ' Pause');
  $('planDetailsText').textContent = '🗓 ' + (teile.length ? teile.join(' · ') : 'Name, Tag und Startzeit');
}
// Einstiege ohne Route
$('eRunde').onclick = () => {
  $('rundFeld').hidden = false;
  $('bRunde').setAttribute('aria-expanded', 'true');
  $('rundFeld').scrollIntoView({ block: 'nearest' });
};
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); rueckgaengig(); }
});

// Entwurf: die gerade offene Planung übersteht ein Neuladen, samt berechneter Teilstücke,
// damit beim Neuladen nichts neu angefragt werden muss
function entwurfSichern() {
  if (S.fest) return;
  const ent = { wps: S.wps, name: S.name, tourId: S.tourId, modus: S.modus, zeit: zeitplanLesen() };
  if (S.stuecke.length && S.stueckeFuer === stueckSignatur()) Object.assign(ent, planPacken());
  if (!SPEICHER.schreiben('entwurf', ent)) SPEICHER.schreiben('entwurf', { wps: S.wps, name: S.name, tourId: S.tourId });
}
// wozu die berechneten Teilstücke gehören: Wegewahl und Koordinaten (Namen und Besichtigungszeiten ändern nichts am Weg)
function stueckSignatur() { return S.profil + '|' + S.wps.map(w => w.lat.toFixed(6) + ',' + w.lon.toFixed(6)).join(';'); }
function planPacken() {
  return {
    profil: S.profil,
    spur: spurPacken(R.auswerten(S.stuecke, 1).pts),
    stuecke: S.stuecke.map(s => ({ n: s.pts.length, q: s.quelle, a: s.abschnitte.map(a => [Math.round(a.m), tagsText(a.tags)]),
      h: (s.hinweise || []).map(x => [x.i, x.cmd, x.exit]) }))
  };
}
// Gegenstück: Teilstücke aus gepackter Spur zurückbauen und in den Speicher legen.
// Gerade Linien, die nur Ersatz für einen fehlgeschlagenen Abschnitt waren, kommen nicht in den Speicher:
// beim nächsten Ändern wird dort neu gefragt.
function planEntpacken(wps, profil, spur, stuecke) {
  const pts = spurEntpacken(spur), out = [];
  let i = 0;
  stuecke.forEach((s, k) => {
    const st = { pts: pts.slice(i, i + s.n), abschnitte: s.a.map(a => ({ m: a[0], tags: R.tagsLesen(a[1]) })), quelle: s.q,
      hinweise: (s.h || []).map(x => ({ i: x[0], cmd: x[1], exit: x[2] })) };
    i += s.n - 1;
    out.push(st);
    const sch = schluessel(wps[k], wps[k + 1], profil);
    // vor Stufe 4 gespeichert (kein Feld h): nicht in den Speicher, damit neu gerechnet wird; die Linie bleibt als Ersatz
    if (s.q === 'brouter' && !s.h) ersatz.set(sch, st);
    else if (s.q !== 'linie' || profil === 'linie') cache.set(sch, st);
  });
  return out;
}
