// Planen: Wegpunkte setzen, Teilstücke holen, Ergebnis zeigen
const S = {
  wps: [],            // [{lat, lon, name?, min?}]: name und Besichtigungszeit (Minuten) bei Stopps
  modus: 'berg',      // berg oder stadt
  profil: 'wandern',
  tempo: 1,
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
  wegpunktDazu(e.latlng.lat, e.latlng.lng);
});

function zeichenWegpunkte() {
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
    if (w.name) m.bindTooltip(R.esc(w.name), { permanent: true, direction: 'right', offset: [14, 0], className: 'wp-name' });
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
      L.popup({ offset: [0, -8] }).setLatLng(m.getLatLng()).setContent(box).openOn(karte);
    });
    m.addTo(ebenePunkte);
  });
}

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
    const linie = L.polyline(teil, { color: '#e5532d', weight: 5, opacity: 0.95, dashArray: s.quelle === 'linie' ? '8 8' : null });
    linie.on('click', ev => {
      L.DomEvent.stop(ev);
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
  zeichenWegpunkte();
  if (S.fest) { auswertenUndZeigen(); return; }
  if (S.wps.length < 2) {
    S.stuecke = []; S.ergebnis = null;
    zeichenRoute(); zeigen();
    $('status').textContent = S.wps.length === 1 ? 'Start gesetzt. Jetzt das Ziel antippen.' : '';
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

function auswertenUndZeigen() {
  const art = (PROFILE[S.profil] || PROFILE.wandern).art;
  S.ergebnis = S.stuecke.length ? R.auswerten(S.stuecke, S.tempo, art) : null;
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

function zeigen() {
  const e = S.ergebnis;
  $('leerHinweis').hidden = S.wps.length > 0 || !!S.fest;
  $('ergebnis').hidden = !e;
  $('bZurueck').disabled = !S.verlauf.length || !!S.fest;
  $('bRund').disabled = S.wps.length < 2 || !!S.fest;
  $('bUmkehren').disabled = S.wps.length < 2 && !S.fest;
  $('bNeu').disabled = !S.wps.length && !S.fest;
  $('bOrdnen').hidden = S.wps.length < 4 || !!S.fest;
  $('bDrucken').disabled = !e || !!S.rechnet;
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
  $('zZeitText').textContent = besicht ? 'inkl. ' + R.zeitText(besicht / 60) + ' Besichtigung' : art === 'rad' ? 'Fahrzeit (grob)' : 'Gehzeit ohne Pausen';
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
  profilZeichnen();
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

// Liste der Stopps mit Besichtigungszeit (sobald ein Punkt einen Namen hat oder im Stadtmodus)
const MINUTEN = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180];
function stoppsZeigen() {
  const box = $('stopps');
  box.innerHTML = '';
  if (S.fest || S.wps.length < 2 || !(S.modus === 'stadt' || S.wps.some(w => w.name))) return;
  const n = S.wps.length;
  S.wps.forEach((w, i) => {
    const rund = i === n - 1 && n > 2 && R.abstand(w, S.wps[0]) < 30;
    const d = document.createElement('div');
    d.className = 'stopp';
    const nr = i === 0 ? 'S' : rund ? 'S' : i === n - 1 ? 'Z' : String(i);
    d.innerHTML = '<span class="nr' + (nr === 'S' ? ' s' : '') + '">' + nr + '</span><span class="name">' +
      R.esc(w.name || (i === 0 ? 'Start' : rund ? 'zurück zum Start' : i === n - 1 ? 'Ziel' : 'Punkt ' + i)) + '</span>';
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
    const x = document.createElement('button');
    x.title = 'Entfernen'; x.textContent = '✕';
    x.onclick = () => wegpunktWeg(i);
    d.appendChild(x);
    box.appendChild(d);
  });
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
$('bUmkehren').onclick = () => {
  if (S.fest) { S.fest.pts.reverse(); S.stuecke = [{ pts: S.fest.pts, abschnitte: S.fest.abschnitte ? S.fest.abschnitte.slice().reverse() : [], quelle: 'spur' }]; auswertenUndZeigen(); return; }
  merken(); S.wps.reverse(); neuBerechnen();
};
$('bNeu').onclick = () => {
  if (S.wps.length) merken();
  S.wps = []; S.fest = null; S.tourId = null; S.name = ''; $('tourname').value = '';
  ebeneOrte.clearLayers();
  neuBerechnen();
};
$('profilwahl').onchange = e => { S.profil = e.target.value; SPEICHER.schreiben('profil', S.profil); neuBerechnen(); };
$('tempowahl').onchange = e => { S.tempo = +e.target.value; SPEICHER.schreiben('tempo', S.tempo); if (S.stuecke.length) auswertenUndZeigen(); };
$('tourname').oninput = e => { S.name = e.target.value; entwurfSichern(); };
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); rueckgaengig(); }
});

// Entwurf: die gerade offene Planung übersteht ein Neuladen, samt berechneter Teilstücke,
// damit beim Neuladen nichts neu angefragt werden muss
function entwurfSichern() {
  if (S.fest) return;
  const ent = { wps: S.wps, name: S.name, tourId: S.tourId, modus: S.modus };
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
