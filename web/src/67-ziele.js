// Reiseziele: Listen mit Orten zum Sammeln (eintippen mit Ortssuche oder aus einer Datei), ⭐ auf der Karte,
// als GPX weitergeben. Gespeichert im Browser bzw. in der App (localStorage, wie die Touren), mit in der Sicherung.

function zieleLesenSp() { return R.zielePruefen(SPEICHER.lesen('ziele', null)); }
function zieleSchreibenSp(d) {
  if (SPEICHER.schreiben('ziele', d)) { zielePunkte(); return true; }
  melde('Speichern ging nicht: Speicher voll? Eine Sicherung speichern und Altes löschen.', 7);
  return false;
}
const ZL = { liste: SPEICHER.lesen('zielListe', ''), stich: new Set(), bearbeiten: null, ort: null, import: null };
const zlId = () => 'z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// erste Liste anlegen, wenn noch keine da ist
function zieleMitListe() {
  const d = zieleLesenSp();
  if (!d.listen.length) { d.listen.push({ id: zlId(), name: 'Meine Ziele' }); zieleSchreibenSp(d); }
  if (ZL.liste && !d.listen.some(l => l.id === ZL.liste)) ZL.liste = '';
  return d;
}
function listenFuellen(sel, d, mitAlle, wahl) {
  sel.innerHTML = (mitAlle ? '<option value="">Alle Listen</option>' : '') + d.listen.map(l => '<option value="' + R.esc(l.id) + '">' + R.esc(l.name) + '</option>').join('');
  sel.value = wahl || (mitAlle ? '' : d.listen[0].id);
}
function zlAnsicht(welche) { ['zlUebersicht', 'zlForm', 'zlImport'].forEach(id => { $(id).hidden = id !== welche; }); $('panel').querySelector('.inhalt').scrollTop = 0; }

// Bezugspunkt fürs Ordnen: frischer eigener Standort, sonst die Kartenmitte
function zlBezug() {
  if (typeof standortFrisch === 'function' && standortFrisch()) return { lat: U.pos.lat, lon: U.pos.lon, text: 'von dir' };
  const c = karte.getCenter();
  return { lat: c.lat, lon: c.lng, text: 'von der Kartenmitte' };
}

function zieleZeigen() {
  const d = zieleMitListe();
  zlAnsicht('zlUebersicht');
  listenFuellen($('zlListe'), d, true, ZL.liste);
  $('zlListeUm').disabled = $('zlListeWeg').disabled = !ZL.liste;
  // Stichworte als Filter (alle müssen passen)
  const chips = $('zlStichFilter');
  chips.innerHTML = '';
  for (const s of R.ZIEL_STICHWORTE) {
    if (!d.ziele.some(z => z.stich.includes(s))) continue;
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = s; b.classList.toggle('aus', !ZL.stich.has(s));
    b.onclick = () => { if (ZL.stich.has(s)) ZL.stich.delete(s); else ZL.stich.add(s); zieleZeigen(); };
    chips.appendChild(b);
  }
  const bezug = zlBezug(), stand = $('zlFilterStand').value;
  let liste = d.ziele.filter(z => (!ZL.liste || z.liste === ZL.liste) && (!stand || z.stand === stand) && [...ZL.stich].every(s => z.stich.includes(s)));
  liste.forEach(z => { z.d = R.abstand(bezug, z); });
  const ord = $('zlOrdnen').value;
  liste.sort(ord === 'name' ? (a, b) => a.name.localeCompare(b.name, 'de') : ord === 'neu' ? (a, b) => (b.neu || '').localeCompare(a.neu || '') : (a, b) => a.d - b.d);
  const alle = d.ziele.filter(z => !ZL.liste || z.liste === ZL.liste).length;
  $('zlStatus').textContent = alle ? (liste.length === alle ? alle + ' Ziele' : liste.length + ' von ' + alle + ' Zielen') + (ord === 'nah' ? ', Entfernung ' + bezug.text : '') + '.'
    : 'Noch keine Ziele in dieser Liste. „＋ Ziel“ oder „📂 Datei laden“ (eine Zeile je Ziel, CSV, GPX, KML aus Google My Maps, GeoJSON).';
  const listen = Object.fromEntries(d.listen.map(l => [l.id, l.name]));
  const ul = $('zlZiele');
  ul.innerHTML = '';
  for (const z of liste) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="zeichen">' + (z.stand === 'besucht' ? '✅' : '⭐') + '</span><span class="was">' + R.esc(z.name) + '<small>' +
      R.esc([z.wo, R.kmText(z.d), R.ZIEL_STAND[z.stand]].concat(z.stich, ZL.liste ? [] : [listen[z.liste]]).filter(Boolean).join(' · ')) + '</small></span>' +
      '<span class="aktionen"><button type="button" title="Bearbeiten">✏️</button><button type="button" title="Löschen">🗑</button></span>';
    li.onclick = () => zielAufKarte(z.id);
    const [bb, bl] = li.querySelectorAll('button');
    bb.onclick = ev => { ev.stopPropagation(); zielForm(z.id); };
    bl.onclick = ev => {
      ev.stopPropagation();
      if (!bl.dataset.sicher) { bl.dataset.sicher = '1'; bl.textContent = 'Löschen?'; setTimeout(() => { if (bl.isConnected) { delete bl.dataset.sicher; bl.textContent = '🗑'; } }, 4000); return; }
      const d2 = zieleLesenSp();
      d2.ziele = d2.ziele.filter(x => x.id !== z.id);
      if (zieleSchreibenSp(d2)) { melde('Gelöscht: ' + z.name); zieleZeigen(); }
    };
    ul.appendChild(li);
  }
}
$('zlListe').onchange = e => { ZL.liste = e.target.value; SPEICHER.schreiben('zielListe', ZL.liste); zieleZeigen(); };
$('zlFilterStand').onchange = zieleZeigen;
$('zlOrdnen').onchange = zieleZeigen;
$('zlListeNeu').onclick = () => {
  const name = (prompt('Name der neuen Liste', 'Sommer ' + (new Date().getFullYear() + 1)) || '').trim();
  if (!name) return;
  const d = zieleMitListe(), l = { id: zlId(), name: name.slice(0, 120) };
  d.listen.push(l);
  if (zieleSchreibenSp(d)) { ZL.liste = l.id; SPEICHER.schreiben('zielListe', l.id); zieleZeigen(); }
};
$('zlListeUm').onclick = () => {
  const d = zieleMitListe(), l = d.listen.find(x => x.id === ZL.liste);
  if (!l) return;
  const name = (prompt('Neuer Name der Liste', l.name) || '').trim();
  if (!name) return;
  l.name = name.slice(0, 120);
  if (zieleSchreibenSp(d)) zieleZeigen();
};
$('zlListeWeg').onclick = () => {
  const b = $('zlListeWeg'), d = zieleMitListe(), l = d.listen.find(x => x.id === ZL.liste);
  if (!l) return;
  const n = d.ziele.filter(z => z.liste === l.id).length;
  if (!b.dataset.sicher) { b.dataset.sicher = '1'; b.textContent = n ? 'Mit ' + n + ' Zielen löschen?' : 'Löschen?'; setTimeout(() => { delete b.dataset.sicher; b.textContent = '🗑'; }, 4000); return; }
  delete b.dataset.sicher; b.textContent = '🗑';
  d.listen = d.listen.filter(x => x.id !== l.id);
  d.ziele = d.ziele.filter(z => z.liste !== l.id);
  if (zieleSchreibenSp(d)) { ZL.liste = ''; SPEICHER.schreiben('zielListe', ''); melde('Liste gelöscht: ' + l.name); zieleZeigen(); }
};

// ---------- Ziel anlegen und bearbeiten ----------
// vorlage: { name, wo, lat, lon, wikipedia, wikidata } (aus dem Info-Fenster oder der Suche)
function zielForm(id, vorlage) {
  const d = zieleMitListe(), z = id ? d.ziele.find(x => x.id === id) : null;
  ZL.bearbeiten = z ? z.id : null;
  const v = z || vorlage || {};
  ZL.ort = v.lat != null ? { lat: v.lat, lon: v.lon, wo: v.wo || '', wikipedia: v.wikipedia || '', wikidata: v.wikidata || '' } : null;
  $('zlFormTitel').textContent = z ? 'Ziel bearbeiten' : 'Neues Ziel';
  $('zlSuche').value = ''; $('zlTreffer').hidden = true;
  $('zlName').value = v.name || ''; $('zlNotiz').value = v.notiz || ''; $('zlLink').value = v.link || '';
  $('zlStand').value = v.stand || 'idee';
  listenFuellen($('zlFormListe'), d, false, (z && z.liste) || ZL.liste || d.listen[0].id);
  const chips = $('zlStich');
  chips.innerHTML = '';
  for (const s of R.ZIEL_STICHWORTE) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = s; b.dataset.stich = s;
    b.classList.toggle('aus', !(v.stich || []).includes(s));
    b.onclick = () => b.classList.toggle('aus');
    chips.appendChild(b);
  }
  zlOrtText();
  if (seite !== 'ziele') reiter('ziele');
  zlAnsicht('zlForm');
  if (!ZL.ort) $('zlSuche').focus();
}
function zlOrtText() {
  $('zlOrt').textContent = ZL.ort ? '📍 ' + (ZL.ort.wo ? ZL.ort.wo + ' · ' : '') + ZL.ort.lat.toFixed(4) + ', ' + ZL.ort.lon.toFixed(4) : 'Noch kein Ort: oben suchen.';
}
let zlSuchNr = 0;
async function zlSuchen() {
  const text = $('zlSuche').value.trim();
  if (text.length < 2) return;
  const nr = ++zlSuchNr, ul = $('zlTreffer');
  ul.hidden = false;
  ul.innerHTML = '<li style="cursor:default"><span class="was klein">Suche …</span></li>';
  let treffer;
  try { treffer = await suchen(text, karte.getCenter()); } catch (err) { if (nr === zlSuchNr) ul.innerHTML = '<li style="cursor:default"><span class="was klein">' + R.esc('Suche nicht möglich: ' + err.message) + '</span></li>'; return; }
  if (nr !== zlSuchNr) return;
  ul.innerHTML = treffer.length ? '' : '<li style="cursor:default"><span class="was klein">Nichts gefunden.</span></li>';
  for (const t of treffer) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="zeichen">📍</span><button type="button" class="was oeffnen">' + R.esc(t.name) + '<small>' + R.esc(t.wo || '') + '</small></button>';
    li.onclick = () => {
      ZL.ort = { lat: t.lat, lon: t.lon, wo: t.wo || '' };
      if (!$('zlName').value.trim()) $('zlName').value = t.name;
      ul.hidden = true; zlOrtText();
    };
    ul.appendChild(li);
  }
}
$('zlSucheLos').onclick = zlSuchen;
$('zlSuche').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); zlSuchen(); } });
$('zlNeu').onclick = () => zielForm(null);
$('zlAbbrechen').onclick = () => zieleZeigen();
$('zlForm').onsubmit = ev => {
  ev.preventDefault();
  if (!ZL.ort) { melde('Erst einen Ort suchen und antippen.'); $('zlSuche').focus(); return; }
  const name = $('zlName').value.trim();
  if (!name) return;
  const d = zieleMitListe();
  const alt = ZL.bearbeiten ? d.ziele.find(x => x.id === ZL.bearbeiten) : null;
  const z = Object.assign(alt || { id: zlId(), neu: new Date().toISOString() }, {
    name, liste: $('zlFormListe').value, lat: ZL.ort.lat, lon: ZL.ort.lon, wo: ZL.ort.wo || '', notiz: $('zlNotiz').value.trim(), link: $('zlLink').value.trim(),
    stand: $('zlStand').value, stich: [...$('zlStich').querySelectorAll('button:not(.aus)')].map(b => b.dataset.stich),
    wikipedia: (alt && alt.wikipedia) || ZL.ort.wikipedia || '', wikidata: (alt && alt.wikidata) || ZL.ort.wikidata || '' });
  if (!alt) d.ziele.push(z);
  if (!zieleSchreibenSp(R.zielePruefen(d))) return;
  melde((alt ? 'Gespeichert: ' : 'Neues Ziel: ') + name);
  ZL.liste = ZL.liste && ZL.liste !== z.liste ? z.liste : ZL.liste;
  zieleZeigen();
};

// ---------- Karte: ⭐ je Ziel, Fenster mit Notiz, Wetter, Anreise, „Tour hier planen“ ----------
const zielMarken = new Map();
function zielePunkte() {
  ebeneZiele.clearLayers();
  zielMarken.clear();
  const d = zieleLesenSp(), listen = Object.fromEntries(d.listen.map(l => [l.id, l.name]));
  for (const z of d.ziele) {
    const m = L.marker([z.lat, z.lon], { title: z.name, zIndexOffset: 300,
      icon: L.divIcon({ className: '', html: '<div class="zl-mk' + (z.stand === 'besucht' ? ' besucht' : '') + '">' + (z.stand === 'besucht' ? '✅' : '⭐') + '</div>', iconSize: [28, 28], iconAnchor: [14, 14] }) });
    m.bindPopup(lage => zielPopup(z, listen[z.liste], lage));
    m.addTo(ebeneZiele);
    zielMarken.set(z.id, m);
  }
}
function zielPopup(z, liste, lage) {
  const box = document.createElement('div'), t = [];
  t.push('<b>' + (z.stand === 'besucht' ? '✅ ' : '⭐ ') + R.esc(z.name) + '</b>', '<span class="klein">' + R.esc([z.wo, liste, R.ZIEL_STAND[z.stand]].concat(z.stich).filter(Boolean).join(' · ')) + '</span>');
  if (z.notiz) t.push('<span>' + R.esc(z.notiz).replace(/\n/g, '<br>') + '</span>');
  if (z.link) t.push('<a href="' + R.esc(z.link) + '" target="_blank" rel="noopener">' + R.esc(z.link.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)) + '</a>');
  t.push(googleLinkHtml(z.name, {}, z.lat, z.lon));
  t.push('<span class="klein">Anreise: <a href="' + R.esc(R.anreiseLink(z.lat, z.lon, 'oepnv')) + '" target="_blank" rel="noopener">🚆 Bus und Bahn</a> · <a href="' +
    R.esc(R.anreiseLink(z.lat, z.lon, 'auto')) + '" target="_blank" rel="noopener">🚗 Auto</a></span>');
  box.innerHTML = t.join('<br>');
  const f = document.createElement('div');
  f.className = 'info-fuss';
  const knopf = (text, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'popup-knopf'; b.textContent = text; b.onclick = ev => { ev.stopPropagation(); fn(); }; f.appendChild(b); };
  knopf(S.wps.length ? '➕ Als Stopp' : '📍 Hier starten', () => { karte.closePopup(); stoppDazu({ lat: z.lat, lon: z.lon, name: z.name }); });
  knopf('🌦 Wetter', () => {
    karte.closePopup();
    wetterPlatz = { name: z.name, wo: z.wo || '', lat: z.lat, lon: z.lon };
    SPEICHER.schreiben('wetterPlatz', wetterPlatz);
    wetterWahl = 'ort'; SPEICHER.schreiben('wetterOrt', 'ort'); $('wetterOrt').value = 'ort'; $('wetterSuche').hidden = false; $('wetterSuchfeld').value = z.name;
    reiter('entdecken'); wetterLaden(true);
  });
  knopf('✏️', () => { karte.closePopup(); zielForm(z.id); });
  box.appendChild(f);
  // Wikipedia, wenn das Ziel aus dem Info-Fenster kam (Merkmale aus OpenStreetMap)
  if (z.wikipedia || z.wikidata) wikiAnhaengen(box, { wikipedia: z.wikipedia, wikidata: z.wikidata }, lage);
  return box;
}
function zielAufKarte(id) {
  const m = zielMarken.get(id);
  if (!m) return;
  if (!lagenWahl.ziele) { lagenWahl.ziele = true; lagenAnwenden(); }
  reiter('karte');
  karte.once('moveend', () => m.openPopup());
  karte.setView(m.getLatLng(), Math.max(karte.getZoom(), 13));
}

// ---------- Liste einfügen oder Datei laden: lesen, Orte ohne Koordinaten suchen, ansehen, übernehmen ----------
$('zlLaden').onclick = () => $('zlDatei').click();
$('zlDatei').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  let gelesen;
  try { gelesen = R.zieleLesen(await f.text(), f.name); } catch (err) { melde('Datei nicht lesbar: ' + err.message, 6); return; }
  if (!gelesen.ziele.length) { melde('In der Datei stehen keine Ziele (' + gelesen.art + ').', 6); return; }
  zlImport(gelesen, f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 120) || 'Aus Datei', 'Aus der Datei');
};
// Liste einfügen: derselbe Weg wie eine Textdatei (Zeile je Ziel, auch „Name; Ort; Notiz“)
$('zlEinfuegen').onclick = () => {
  const auf = $('zlEinfuegenFeld').hidden;
  $('zlEinfuegenFeld').hidden = !auf;
  $('zlEinfuegen').setAttribute('aria-expanded', String(auf));
  if (auf) $('zlText').focus();
};
$('zlTextLos').onclick = () => {
  const gelesen = R.zieleLesen($('zlText').value, 'eingefuegt.txt');
  if (!gelesen.ziele.length) { melde('Erst Ziele eintragen, eine Zeile je Ziel.'); $('zlText').focus(); return; }
  $('zlText').value = ''; $('zlEinfuegenFeld').hidden = true; $('zlEinfuegen').setAttribute('aria-expanded', 'false');
  zlImport({ art: 'Eingefügt', ziele: gelesen.ziele }, 'Eingefügt ' + new Date().toLocaleDateString('de-DE'), 'Eingefügte Ziele');
};
async function zlImport(gelesen, neuName, titel) {
  const d = zieleMitListe();
  $('zlImportTitel').textContent = titel;
  ZL.import = { punkte: gelesen.ziele.map(z => Object.assign({ an: z.lat != null, status: z.lat != null ? 'ok' : 'suche' }, z)), neuName, nr: (ZL.import ? ZL.import.nr : 0) + 1 };
  $('zlImportZiel').innerHTML = '<option value="neu">Neue Liste „' + R.esc(neuName) + '“</option>' + d.listen.map(l => '<option value="' + R.esc(l.id) + '">' + R.esc(l.name) + '</option>').join('');
  zlAnsicht('zlImport');
  zlImportZeigen(gelesen.art);
  // Orte ohne Koordinaten der Reihe nach suchen (eine Anfrage je Sekunde: Photon ist ein freier Dienst)
  const imp = ZL.import;
  for (const p of imp.punkte.filter(x => x.status === 'suche')) {
    if (ZL.import !== imp) return;
    try {
      const t = (await suchen(p.suche, karte.getCenter()))[0];
      if (t) Object.assign(p, { lat: t.lat, lon: t.lon, wo: t.wo || '', treffer: t.name, status: 'ok', an: true }); else p.status = 'nicht';
    } catch (err) { p.status = 'fehler'; p.fehler = err.message; }
    if (ZL.import !== imp) return;
    zlImportZeigen(gelesen.art);
    await new Promise(r => setTimeout(r, 1000));
  }
}
function zlImportZeigen(art) {
  const imp = ZL.import, ul = $('zlImportListe');
  const offen = imp.punkte.filter(p => p.status === 'suche').length, ok = imp.punkte.filter(p => p.status === 'ok').length;
  $('zlImportStatus').textContent = art + ': ' + imp.punkte.length + ' Ziele, ' + ok + ' mit Ort' + (offen ? ', suche noch ' + offen + ' …' : '') +
    (imp.punkte.length - ok - offen ? ', ' + (imp.punkte.length - ok - offen) + ' nicht gefunden' : '') + '. Häkchen weg lässt ein Ziel aus.';
  ul.innerHTML = '';
  imp.punkte.forEach(p => {
    const li = document.createElement('li');
    const info = p.status === 'ok' ? (p.treffer && p.treffer !== p.name ? 'gefunden: ' + p.treffer + (p.wo ? ' · ' + p.wo : '') : p.wo || p.lat.toFixed(4) + ', ' + p.lon.toFixed(4))
      : p.status === 'suche' ? 'suche „' + p.suche + '“ …' : p.status === 'nicht' ? 'nicht gefunden: „' + p.suche + '“' : 'Suche ging nicht: ' + (p.fehler || '');
    li.innerHTML = '<label class="was ankreuzen"><input type="checkbox"' + (p.an ? ' checked' : '') + (p.status !== 'ok' ? ' disabled' : '') + '> ' + R.esc(p.name) +
      '<small>' + R.esc(info) + '</small></label>';
    li.querySelector('input').onchange = ev => { p.an = ev.target.checked; zlImportKnopf(); };
    ul.appendChild(li);
  });
  zlImportKnopf();
}
function zlImportKnopf() {
  const n = ZL.import.punkte.filter(p => p.an && p.status === 'ok').length;
  $('zlImportOk').disabled = !n;
  $('zlImportOk').textContent = n ? n + ' übernehmen' : 'Übernehmen';
}
$('zlImportAbbrechen').onclick = () => { ZL.import = null; zieleZeigen(); };
$('zlImportOk').onclick = () => {
  const imp = ZL.import, d = zieleMitListe();
  let liste = $('zlImportZiel').value;
  if (liste === 'neu') { liste = zlId(); d.listen.push({ id: liste, name: imp.neuName }); }
  const neu = imp.punkte.filter(p => p.an && p.status === 'ok').map(p => ({ id: zlId(), liste, name: p.name, wo: p.wo || '', lat: p.lat, lon: p.lon,
    notiz: p.notiz || '', link: p.link || '', stich: [], stand: 'idee', neu: new Date().toISOString() }));
  d.ziele = d.ziele.concat(neu);
  if (!zieleSchreibenSp(R.zielePruefen(d))) return;
  ZL.import = null; ZL.liste = liste; SPEICHER.schreiben('zielListe', liste);
  melde(neu.length + ' Ziele übernommen.');
  zieleZeigen();
};

// ---------- Sicherung: Listen und Ziele, die noch fehlen (nach id), kommen dazu ----------
function zieleEinlesen(text) {
  let roh;
  try { roh = JSON.parse(text).reiseziele; } catch (e) { return 0; }
  const neu = R.zielePruefen(roh), d = zieleLesenSp();
  const lIds = new Set(d.listen.map(l => l.id)), zIds = new Set(d.ziele.map(z => z.id));
  const neueListen = neu.listen.filter(l => !lIds.has(l.id));
  d.listen = d.listen.concat(neueListen);
  const dazu = neu.ziele.filter(z => !zIds.has(z.id));
  d.ziele = d.ziele.concat(dazu);
  // auch eine leere Liste aus der Sicherung kommt mit
  if (!dazu.length && !neueListen.length) return 0;
  return zieleSchreibenSp(d) ? dazu.length : 0;
}

// ---------- Weitergeben: Liste als GPX ----------
$('zlAusgeben').onclick = () => {
  const d = zieleMitListe(), l = d.listen.find(x => x.id === ZL.liste);
  const ziele = d.ziele.filter(z => !l || z.liste === l.id);
  if (!ziele.length) { melde('Keine Ziele zum Ausgeben.'); return; }
  const name = l ? l.name : 'Reiseziele';
  dateiAusgeben(dateiname(name) + '.gpx', R.zieleGpx(name, ziele), 'application/gpx+xml');
};

zielePunkte();
