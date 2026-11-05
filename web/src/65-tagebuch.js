// Reisetagebuch: Reisen mit Zeitraum, je Reise Einträge mit Text und Fotos; Ort, Uhrzeit und Wetter kommen von selbst.
// Texte und Reisen liegen im Speicher wie die Touren, Fotos verkleinert in IndexedDB (zu groß für localStorage).
// entwurf: Kennung des offenen Formulars; späte Antworten (Ort, Wetter, verkleinerte Fotos) gehören nur zu ihm
const TB = { ansicht: 'liste', reise: null, eintrag: null, neu: [], weg: [], ort: null, wetter: null, urls: [], entwurf: 0, laufend: [], speichert: false };

function tagebuchLesen() {
  const d = SPEICHER.lesen('tagebuch', null);
  return d && Array.isArray(d.reisen) && Array.isArray(d.eintraege) ? d : { reisen: [], eintraege: [] };
}
function tagebuchSchreiben(d) {
  if (SPEICHER.schreiben('tagebuch', d)) { tagebuchPunkte(); return true; }
  melde('Speichern ging nicht: Speicher voll oder gesperrt.', 6);
  return false;
}
const tbId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- Fotos (IndexedDB, Schlüssel = Foto-Kennung, Wert = JPEG) ----------
const FOTOS = (() => {
  let db = null;
  function oeffnen() {
    if (!db) db = new Promise((ok, nein) => {
      if (!window.indexedDB) { nein(new Error('Dieser Browser kann keine Fotos speichern.')); return; }
      const r = indexedDB.open('gug-tagebuch', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('fotos');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => nein(r.error || new Error('Fotospeicher nicht verfügbar'));
    });
    return db;
  }
  async function vorgang(modus, f) {
    const d = await oeffnen();
    return new Promise((ok, nein) => {
      const t = d.transaction('fotos', modus);
      const r = f(t.objectStore('fotos'));
      t.oncomplete = () => ok(r && r.result);
      t.onerror = t.onabort = () => nein(t.error || new Error('Fotospeicher: Vorgang abgebrochen'));
    });
  }
  return {
    holen: id => vorgang('readonly', s => s.get(id)),
    ablegen: (id, blob) => vorgang('readwrite', s => s.put(blob, id)),
    weg: id => vorgang('readwrite', s => s.delete(id))
  };
})();

// Foto auf höchstens 1600 px verkleinern (JPEG): ein Handyfoto hat sonst 3–8 MB
async function fotoVerkleinern(datei) {
  const url = URL.createObjectURL(datei);
  try {
    const bild = await new Promise((ok, nein) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => nein(new Error('Bild nicht lesbar: ' + (datei.name || 'Foto')));
      i.src = url;
    });
    const f = Math.min(1, 1600 / Math.max(bild.naturalWidth, bild.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bild.naturalWidth * f));
    c.height = Math.max(1, Math.round(bild.naturalHeight * f));
    c.getContext('2d').drawImage(bild, 0, 0, c.width, c.height);
    const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.82));
    if (!blob) throw new Error('Bild nicht verkleinerbar');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

function tbUrlsFrei() { TB.urls.forEach(u => URL.revokeObjectURL(u)); TB.urls = []; }
function tbUrl(blob) { const u = URL.createObjectURL(blob); TB.urls.push(u); return u; }

// Foto als Kachel; groß beim Antippen
function fotoKachel(blob, weg) {
  const fig = document.createElement('figure');
  const gross = document.createElement('button');
  gross.type = 'button'; gross.className = 'gross'; gross.setAttribute('aria-label', 'Foto groß zeigen');
  const img = document.createElement('img');
  img.alt = '';
  img.src = tbUrl(blob);
  gross.appendChild(img);
  gross.onclick = () => bildZeigen(img.src, gross);
  fig.appendChild(gross);
  if (weg) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'weg'; b.title = 'Foto entfernen'; b.setAttribute('aria-label', 'Foto entfernen'); b.textContent = '✕';
    b.onclick = weg;
    fig.appendChild(b);
  }
  return fig;
}
let bildVon = null;
// GALERIE: beim Blättern (Ich › Fotos, Tourseite) die Liste aus R.fotoListe und die Stelle; sonst ein einzelnes Bild
const GALERIE = { liste: null, i: 0, urls: new Map() };
function bildZeigen(src, von) {
  bildVon = von;
  GALERIE.liste = null;
  ['tbBildVor', 'tbBildNach', 'tbBildInfo'].forEach(id => { $(id).hidden = true; });
  $('tbBild').querySelector('img').src = src;
  $('tbBild').hidden = false;
  $('tbBildZu').focus();
}
async function galerieUrl(f) {
  if (GALERIE.urls.has(f)) return GALERIE.urls.get(f);
  const b = await FOTOS.holen(f).catch(() => null);
  const u = b ? URL.createObjectURL(b) : '';
  GALERIE.urls.set(f, u);
  return u;
}
async function galerieZeigen(liste, i, von) {
  bildVon = von;
  GALERIE.liste = liste; GALERIE.i = i;
  $('tbBild').hidden = false;
  await galerieBild();
  $('tbBildZu').focus();
}
async function galerieBild() {
  const l = GALERIE.liste, x = l && l[GALERIE.i];
  if (!x) return;
  $('tbBild').querySelector('img').src = await galerieUrl(x.foto);
  $('tbBildVor').hidden = GALERIE.i <= 0;
  $('tbBildNach').hidden = GALERIE.i >= l.length - 1;
  $('tbBildInfo').hidden = false;
  const wann = new Date(x.zeit).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + R.uhr(new Date(x.zeit)) + ' Uhr';
  $('tbBildText').textContent = (GALERIE.i + 1) + '/' + l.length + ' · ' + (x.reise ? x.reise.name + ' · ' : '') + wann;
  $('tbBildReise').hidden = !x.reise;
  $('tbBildTour').hidden = !x.tour;
  if (x.tour) $('tbBildTour').textContent = '🥾 ' + x.tour.name;
}
function galerieSchritt(d) {
  if (!GALERIE.liste) return;
  const i = GALERIE.i + d;
  if (i < 0 || i >= GALERIE.liste.length) return;
  GALERIE.i = i;
  galerieBild();
}
function bildZu() {
  if ($('tbBild').hidden) return false;
  $('tbBild').hidden = true;
  $('tbBild').querySelector('img').removeAttribute('src');
  GALERIE.liste = null;
  if (bildVon && bildVon.isConnected) bildVon.focus();
  bildVon = null;
  return true;
}
$('tbBild').onclick = bildZu;
// Foto teilen: App über das Teilen-Menü von Android (75-app.js), Browser über das Teilen des Browsers, sonst herunterladen
let fotoTeilen = async function (blob, name, text) {
  const datei = new File([blob], name, { type: blob.type || 'image/jpeg' });
  if (navigator.canShare && navigator.canShare({ files: [datei] })) {
    try { await navigator.share({ files: [datei], title: name, text }); } catch (e) { if (e.name !== 'AbortError') melde('Teilen ging nicht: ' + e.message, 6); }
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  melde('Teilen kann dieser Browser nicht: Foto heruntergeladen.', 5);
};
$('tbBildTeilen').onclick = async ev => {
  ev.stopPropagation();
  const src = $('tbBild').querySelector('img').src;
  if (!src) return;
  const x = GALERIE.liste && GALERIE.liste[GALERIE.i];
  const tag = R.tagIso(x ? x.zeit : Date.now());
  const name = 'gipfel-und-gasse-' + tag + (x ? '-' + (GALERIE.i + 1) : '') + '.jpg';
  const text = x ? [x.reise && x.reise.name, x.tour && x.tour.name, new Date(x.zeit).toLocaleDateString('de-DE')].filter(Boolean).join(' · ') : '';
  try { await fotoTeilen(await (await fetch(src)).blob(), name, text); } catch (e) { melde('Teilen ging nicht: ' + e.message, 6); }
};
$('tbBildVor').onclick = ev => { ev.stopPropagation(); galerieSchritt(-1); };
$('tbBildNach').onclick = ev => { ev.stopPropagation(); galerieSchritt(1); };
$('tbBildInfo').onclick = ev => ev.stopPropagation();
// Querverweise: zum Eintrag in der Reise, zur gegangenen Tour des Tages
$('tbBildReise').onclick = async () => {
  const x = GALERIE.liste && GALERIE.liste[GALERIE.i];
  if (!x || !x.reise) return;
  bildZu();
  reiter('tagebuch');
  await reiseZeigen(x.reise.id);
  const k = document.querySelector('.tb-eintrag[data-eintrag="' + CSS.escape(x.eintrag) + '"]');
  if (k) { k.scrollIntoView({ block: 'start' }); k.classList.add('hervor'); setTimeout(() => k.classList.remove('hervor'), 2500); }
};
$('tbBildTour').onclick = () => {
  const x = GALERIE.liste && GALERIE.liste[GALERIE.i];
  if (!x || !x.tour) return;
  bildZu();
  tourAnsehen(x.tour.id);
};
// Wischen nach links und rechts blättert
(function () {
  let x0 = null;
  $('tbBild').addEventListener('touchstart', e => { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  $('tbBild').addEventListener('touchend', e => {
    if (x0 == null || !GALERIE.liste) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 50) { e.preventDefault(); galerieSchritt(dx < 0 ? 1 : -1); }
  });
})();
document.addEventListener('keydown', e => {
  if ($('tbBild').hidden || !GALERIE.liste) return;
  if (e.key === 'ArrowRight') galerieSchritt(1);
  if (e.key === 'ArrowLeft') galerieSchritt(-1);
});

// Raster aus Fotos (Ich › Fotos, Tourseite); Antippen öffnet das Bildfenster zum Blättern
function fotoRaster(box, liste) {
  box.innerHTML = '';
  liste.forEach((x, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Foto ' + (i + 1) + (x.reise ? ' aus ' + x.reise.name : ''));
    const img = document.createElement('img');
    img.alt = ''; img.loading = 'lazy';
    b.appendChild(img);
    galerieUrl(x.foto).then(u => { if (u) img.src = u; });
    b.onclick = () => galerieZeigen(liste, i, b);
    box.appendChild(b);
  });
}
function fotosZeigen() {
  const liste = R.fotoListe(tagebuchLesen(), tourenLesen());
  $('fotoStatus').textContent = liste.length ? liste.length + (liste.length === 1 ? ' Foto' : ' Fotos') + ' aus dem Reisetagebuch, neueste zuerst. Antippen zeigt groß, wischen blättert.'
    : 'Noch keine Fotos. Im Reisetagebuch einen Eintrag mit Foto schreiben, dann stehen sie hier.';
  fotoRaster($('fotoRaster'), liste);
}
// Tourseite: Fotos aus dem Tagebuch vom Tag einer gegangenen Tour
function tourFotosZeigen(t) {
  ebeneFotos.clearLayers();
  const tb = tagebuchLesen();
  const liste = t && t.art === 'aufzeichnung' ? R.fotoListe(tb, tourenLesen()).filter(x => x.tour && x.tour.id === t.id) : [];
  $('tourFotosBox').hidden = !liste.length;
  if (!liste.length) return;
  // auf der Karte: Ort aus dem Foto, sonst Zeitpunkt auf der Spur, sonst Ort des Eintrags (R.fotoOrt)
  const eintraege = new Map(tb.eintraege.map(e => [e.id, e]));
  let aufKarte = 0;
  liste.forEach((x, i) => {
    const e = eintraege.get(x.eintrag);
    const o = R.fotoOrt(e && e.fotoInfo && e.fotoInfo[x.foto], e, t.spur);
    if (!o) return;
    aufKarte++;
    const icon = L.divIcon({ className: '', html: '<div class="foto-mk"><img alt=""></div>', iconSize: [40, 40], iconAnchor: [20, 20] });
    const m = L.marker([o.lat, o.lon], { icon, title: 'Foto ' + (i + 1), zIndexOffset: 500 }).addTo(ebeneFotos);
    m.on('click', () => galerieZeigen(liste, i, null));
    galerieUrl(x.foto).then(u => { const img = m.getElement() && m.getElement().querySelector('img'); if (u && img) img.src = u; });
  });
  $('tourFotosTitel').textContent = 'Fotos von diesem Tag (' + liste.length + ')' + (aufKarte ? ', ' + (aufKarte === liste.length ? 'alle' : aufKarte) + ' auf der Karte' : '');
  fotoRaster($('tourFotos'), liste);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') bildZu(); });

// ---------- Ansichten ----------
function tbAnsicht(a) {
  TB.ansicht = a;
  $('tbUebersicht').hidden = a !== 'liste';
  $('tbReiseForm').hidden = a !== 'reiseForm';
  $('tbReise').hidden = a !== 'reise';
  $('tbEintragForm').hidden = a !== 'eintrag';
  $('panel').querySelector('.inhalt').scrollTop = 0;
}

function datumLang(tag) {
  return new Date(tag + 'T12:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function zeitraumText(r) {
  const k = t => new Date(t + 'T12:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
  const tage = Math.round((new Date(r.bis + 'T12:00') - new Date(r.von + 'T12:00')) / 864e5) + 1;
  return (r.von === r.bis ? k(r.von) : k(r.von) + ' – ' + k(r.bis)) + ' · ' + tage + (tage === 1 ? ' Tag' : ' Tage');
}

function tagebuchZeigen() {
  if (TB.ansicht === 'reise' && TB.reise) { reiseZeigen(TB.reise); return; }
  if (TB.ansicht === 'eintrag' || TB.ansicht === 'reiseForm') return;   // angefangene Eingabe nicht verwerfen
  const d = tagebuchLesen();
  const heute = R.reiseHeute(d.reisen, R.tagIso(Date.now()));
  $('tbHeute').hidden = !heute;
  if (heute) $('tbHeute').textContent = '✍️ Eintrag für heute: ' + heute.name;
  const ul = $('tbReisen');
  ul.innerHTML = '';
  const reisen = d.reisen.slice().sort((a, b) => (a.von < b.von ? 1 : -1));
  if (!reisen.length) ul.innerHTML = '<li style="cursor:default"><span class="was klein">Noch keine Reise. „＋ Neue Reise“ legt eine an, z. B. für den nächsten Urlaub.</span></li>';
  for (const r of reisen) {
    const n = d.eintraege.filter(e => e.reise === r.id).length;
    const li = document.createElement('li');
    li.innerHTML = '<span class="zeichen">📔</span><button class="was oeffnen">' + R.esc(r.name) + '<small>' + R.esc(zeitraumText(r)) + ' · ' +
      n + (n === 1 ? ' Eintrag' : ' Einträge') + '</small></button>';
    li.onclick = () => reiseZeigen(r.id);
    ul.appendChild(li);
  }
  tbAnsicht('liste');
}

async function reiseZeigen(id) {
  const d = tagebuchLesen();
  const r = d.reisen.find(x => x.id === id);
  if (!r) { TB.reise = null; TB.ansicht = 'liste'; tagebuchZeigen(); return; }
  TB.reise = id;
  tbAnsicht('reise');
  $('tbTitel').textContent = r.name;
  $('tbZeitraum').textContent = zeitraumText(r);
  delete $('tbReiseLoeschen').dataset.sicher;
  $('tbReiseLoeschen').textContent = '🗑';
  tbUrlsFrei();
  const box = $('tbEintraege');
  box.innerHTML = '';
  const tage = R.tagebuchTage(d.eintraege.filter(e => e.reise === id));
  if (!tage.length) box.innerHTML = '<p class="klein">Noch keine Einträge. „✍️ Eintrag schreiben“ hält fest, was ihr erlebt; Ort und Wetter kommen von selbst dazu.</p>';
  for (const t of tage) {
    const h = document.createElement('h4');
    h.className = 'tb-tag';
    h.textContent = datumLang(t.tag);
    box.appendChild(h);
    for (const e of t.eintraege) box.appendChild(eintragKarte(e));
  }
  listeZeigen($('tbTouren'), R.reiseTouren(tourenLesen(), r), 'Keine Aufzeichnungen in diesem Zeitraum. Unter „Unterwegs“ aufzeichnen und speichern, dann erscheinen sie hier.');
}

function ortWetterText(e) {
  const teile = [];
  if (e.ort) teile.push('📍 ' + (e.ort.name || e.ort.lat.toFixed(4) + ', ' + e.ort.lon.toFixed(4)));
  if (e.wetter) { const w = R.wetterText(e.wetter.code); teile.push(w[0] + ' ' + Math.round(e.wetter.temp) + ' °C, ' + w[1]); }
  return teile.join(' · ');
}

function eintragKarte(e) {
  const div = document.createElement('div');
  div.className = 'tb-eintrag';
  div.dataset.eintrag = e.id;
  const kopf = document.createElement('div');
  kopf.className = 'kopf';
  kopf.innerHTML = '<b>' + R.uhr(new Date(e.zeit)) + ' Uhr</b><span>' + R.esc(ortWetterText(e)) + '</span>' +
    '<span class="aktionen"><button title="Eintrag bearbeiten">✏️</button><button title="Eintrag löschen">🗑</button></span>';
  const [bB, bL] = kopf.querySelectorAll('.aktionen button');
  bB.onclick = () => eintragFormular(e.id);
  bL.onclick = () => eintragLoeschen(e.id, bL);
  div.appendChild(kopf);
  if (e.text) { const p = document.createElement('div'); p.className = 'text'; p.textContent = e.text; div.appendChild(p); }
  if (e.fotos && e.fotos.length) {
    const g = document.createElement('div');
    g.className = 'tb-fotos';
    div.appendChild(g);
    e.fotos.forEach(async f => {
      try { const b = await FOTOS.holen(f); if (b) g.appendChild(fotoKachel(b)); } catch (err) { /* Foto fehlt: Eintrag trotzdem zeigen */ }
    });
  }
  return div;
}

// ---------- Reise anlegen, bearbeiten, löschen ----------
function reiseFormular(id) {
  const r = id ? tagebuchLesen().reisen.find(x => x.id === id) : null;
  const heute = R.tagIso(Date.now());
  $('tbReiseFormTitel').textContent = r ? 'Reise bearbeiten' : 'Neue Reise';
  $('tbName').value = r ? r.name : '';
  $('tbVon').value = r ? r.von : heute;
  $('tbBis').value = r ? r.bis : heute;
  $('tbReiseForm').dataset.id = id || '';
  tbAnsicht('reiseForm');
  $('tbName').focus();
}
$('tbNeueReise').onclick = () => reiseFormular(null);
$('tbReiseBearbeiten').onclick = () => reiseFormular(TB.reise);
$('tbReiseAbbrechen').onclick = () => { if (TB.reise) reiseZeigen(TB.reise); else { TB.ansicht = 'liste'; tagebuchZeigen(); } };
$('tbReiseForm').onsubmit = ev => {
  ev.preventDefault();
  const name = $('tbName').value.trim().slice(0, 120), von = $('tbVon').value, bis = $('tbBis').value;
  if (!name || !von || !bis) { melde('Bitte Name und Zeitraum angeben.'); return; }
  if (bis < von) { melde('„bis“ liegt vor „von“.'); return; }
  const d = tagebuchLesen();
  const id = $('tbReiseForm').dataset.id;
  if (id) Object.assign(d.reisen.find(x => x.id === id) || {}, { name, von, bis });
  else d.reisen.push({ id: 'r' + tbId(), name, von, bis });
  if (!tagebuchSchreiben(d)) return;
  reiseZeigen(id || d.reisen[d.reisen.length - 1].id);
};
$('tbZurueck').onclick = () => { TB.reise = null; TB.ansicht = 'liste'; tagebuchZeigen(); };
$('tbReiseLoeschen').onclick = async () => {
  const b = $('tbReiseLoeschen');
  if (!b.dataset.sicher) {
    b.dataset.sicher = '1';
    b.textContent = 'Nochmal tippen: Reise mit allen Einträgen löschen';
    setTimeout(() => { if (b.dataset.sicher) { delete b.dataset.sicher; b.textContent = '🗑'; } }, 4000);
    return;
  }
  const d = tagebuchLesen();
  const r = d.reisen.find(x => x.id === TB.reise);
  const fotos = d.eintraege.filter(e => e.reise === TB.reise).flatMap(e => e.fotos || []);
  d.reisen = d.reisen.filter(x => x.id !== TB.reise);
  d.eintraege = d.eintraege.filter(e => e.reise !== TB.reise);
  if (!tagebuchSchreiben(d)) return;
  for (const f of fotos) await FOTOS.weg(f).catch(() => {});
  TB.reise = null; TB.ansicht = 'liste';
  tagebuchZeigen();
  if (r) melde('Gelöscht: ' + r.name);
};

// ---------- Eintrag schreiben ----------
// Ort: frischer Standort aus „Unterwegs“, sonst einmal fragen; dazu das Wetter jetzt und der Ortsname (beides nur mit Netz)
async function ortUndWetter() {
  const meins = TB.entwurf;
  const zeile = $('tbOrtWetter');
  zeile.textContent = '📍 Ort wird bestimmt …';
  let p = standortFrisch() ? { lat: U.pos.lat, lon: U.pos.lon } : null;
  if (!p && navigator.geolocation) {
    p = await new Promise(ok => navigator.geolocation.getCurrentPosition(
      x => ok({ lat: x.coords.latitude, lon: x.coords.longitude }), () => ok(null), { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }));
  }
  if (TB.entwurf !== meins) return;   // inzwischen verlassen oder ein anderer Entwurf
  if (!p) { zeile.textContent = 'Ohne Ort (kein Standort).'; return; }
  TB.ort = { lat: p.lat, lon: p.lon };
  zeile.textContent = ortWetterText({ ort: TB.ort });
  const [w, n] = await Promise.all([wetterJetzt(p.lat, p.lon).catch(() => null), ortsname(p.lat, p.lon).catch(() => null)]);
  if (TB.entwurf !== meins || !TB.ort) return;
  if (n) TB.ort.name = n;
  if (w) TB.wetter = w;
  zeile.textContent = ortWetterText({ ort: TB.ort, wetter: TB.wetter });
}

function eintragFormular(id) {
  const d = tagebuchLesen();
  const e = id ? d.eintraege.find(x => x.id === id) : null;
  TB.eintrag = e ? e.id : null;
  TB.entwurf++;
  TB.neu = []; TB.weg = []; TB.ort = null; TB.wetter = null; TB.laufend = []; TB.speichert = false;
  fotoStatus();
  $('tbEintragTitel').textContent = e ? 'Eintrag bearbeiten' : 'Neuer Eintrag';
  $('tbText').value = e ? e.text : '';
  tbAnsicht('eintrag');
  fotosNeuZeigen(e ? e.fotos : []);
  $('tbOrtWetter').textContent = e ? (ortWetterText(e) || 'Ohne Ort.') : '';
  if (!e) ortUndWetter();
  $('tbText').focus();
}

// Fotos im Formular: vorhandene (Kennung) und neue (noch nicht gespeichert)
// Jeder Aufruf zählt hoch; nur der jüngste setzt seine Kacheln ein. Vorher hängten zwei schnelle Aufrufe (Foto dazu und
// eins entfernen, während die alten noch geladen wurden) beide ihre Kacheln an: Fotos erschienen doppelt
let fotosNeuNr = 0;
async function fotosNeuZeigen(alte) {
  const nr = ++fotosNeuNr;
  const kacheln = [];
  for (const f of alte || []) {
    if (TB.weg.includes(f)) continue;
    try {
      const b = await FOTOS.holen(f);
      if (nr !== fotosNeuNr) return;
      if (b) kacheln.push(() => fotoKachel(b, () => { TB.weg.push(f); fotosNeuZeigen(alte); }));
    } catch (err) { /* fehlt */ }
  }
  if (nr !== fotosNeuNr) return;
  tbUrlsFrei();
  const g = $('tbFotosNeu');
  g.innerHTML = '';
  kacheln.forEach(k => g.appendChild(k()));
  TB.neu.forEach((n, i) => g.appendChild(fotoKachel(n.blob, () => { TB.neu.splice(i, 1); fotosNeuZeigen(alte); })));
}
const alteFotos = () => { const e = TB.eintrag && tagebuchLesen().eintraege.find(x => x.id === TB.eintrag); return e ? e.fotos : []; };

// Original eines aufgenommenen Fotos in die Galerie: setzt die App (75-app.js), im Browser gibt es das nicht
let fotoInGalerie = null;
async function inGalerie(datei) {
  if (!fotoInGalerie || !$('tbGalerieAuch').checked) return;
  try {
    const url = await new Promise((ok, nein) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => nein(r.error); r.readAsDataURL(datei); });
    const z = new Date(), zwei = n => String(n).padStart(2, '0');
    const name = 'Gipfel-und-Gasse_' + z.getFullYear() + zwei(z.getMonth() + 1) + zwei(z.getDate()) + '_' + zwei(z.getHours()) + zwei(z.getMinutes()) + zwei(z.getSeconds()) + '.jpg';
    await fotoInGalerie(String(url).split(',')[1], name, datei.type || 'image/jpeg');
    melde('Foto auch in der Galerie gespeichert (Bilder › Gipfel und Gasse).', 4);
  } catch (err) { melde((err && err.message) || 'Foto nicht in der Galerie gespeichert.', 6); }
}
$('tbGalerieAuch').onchange = e => SPEICHER.schreiben('tbGalerieAuch', e.target.checked);
$('tbGalerieAuch').checked = SPEICHER.lesen('tbGalerieAuch', true) !== false;

function fotoStatus() {
  const n = TB.laufend.length;
  $('tbFotoStatus').hidden = !n;
  $('tbFotoStatus').textContent = n ? 'Fotos werden vorbereitet …' : '';
}
$('tbKamera').onclick = () => $('tbFotoKamera').click();
$('tbGalerie').onclick = () => $('tbFotoDatei').click();
$('tbFotoKamera').onchange = $('tbFotoDatei').onchange = ev => {
  const dateien = [...ev.target.files];
  ev.target.value = '';
  // mit der Kamera aufgenommen: das Original zusätzlich in die Galerie (in der App), wie ein normales Kamerafoto
  if (ev.target.id === 'tbFotoKamera') dateien.forEach(inGalerie);
  const meins = TB.entwurf;
  const arbeit = (async () => {
    for (const f of dateien) {
      let blob, info = null;
      try { blob = await fotoVerkleinern(f); } catch (err) { melde(err.message, 5); continue; }
      // Aufnahmeort und -zeit aus dem Original (EXIF); das verkleinerte Bild hat sie nicht mehr. Android gibt den Ort
      // nur heraus, wenn die Kamera ihn speichert und die Auswahl ihn nicht entfernt
      try { info = R.exifLesen(new Uint8Array(await f.slice(0, 256 * 1024).arrayBuffer())); } catch (err) { info = null; }
      if (TB.entwurf !== meins) return;   // Formular inzwischen verlassen: Ergebnis verwerfen
      TB.neu.push({ id: 'f' + tbId(), blob, info, kamera: ev.target.id === 'tbFotoKamera', zeit: Date.now() });
    }
    if (TB.entwurf === meins) fotosNeuZeigen(alteFotos());
  })();
  TB.laufend.push(arbeit);
  fotoStatus();
  arbeit.finally(() => { TB.laufend = TB.laufend.filter(x => x !== arbeit); if (TB.entwurf === meins) fotoStatus(); });
};

$('tbNeuerEintrag').onclick = () => eintragFormular(null);
$('tbHeute').onclick = () => {
  const r = R.reiseHeute(tagebuchLesen().reisen, R.tagIso(Date.now()));
  if (!r) return;
  TB.reise = r.id;
  eintragFormular(null);
};
$('tbEintragAbbrechen').onclick = () => { TB.entwurf++; TB.neu = []; TB.laufend = []; reiseZeigen(TB.reise); };
$('tbEintragSpeichern').onclick = async () => {
  if (TB.speichert) return;
  TB.speichert = true;
  $('tbEintragSpeichern').disabled = true;
  try { await eintragSpeichern(); } finally { TB.speichert = false; $('tbEintragSpeichern').disabled = false; }
};
async function eintragSpeichern() {
  const meins = TB.entwurf;
  // noch laufendes Verkleinern abwarten, sonst fehlen diese Fotos
  while (TB.laufend.length) await Promise.allSettled(TB.laufend.slice());
  if (TB.entwurf !== meins) return;
  const text = $('tbText').value.trim();
  if (!text && !TB.neu.length && !TB.eintrag) { melde('Text oder Foto fehlt noch.'); return; }
  // Fotos zuerst ablegen: scheitert das, bleibt der Eintrag ungespeichert und nichts zeigt ins Leere
  try { for (const n of TB.neu) await FOTOS.ablegen(n.id, n.blob); } catch (err) { melde('Fotos nicht gespeichert: ' + err.message, 6); return; }
  const d = tagebuchLesen();
  let e = TB.eintrag && d.eintraege.find(x => x.id === TB.eintrag);
  if (!e) {
    e = { id: 'e' + tbId(), reise: TB.reise, zeit: Date.now(), text: '', fotos: [] };
    if (TB.ort) e.ort = TB.ort;
    if (TB.wetter) e.wetter = TB.wetter;
    d.eintraege.push(e);
  }
  e.text = text;
  e.fotos = (e.fotos || []).filter(f => !TB.weg.includes(f)).concat(TB.neu.map(n => n.id));
  // Ort und Zeit je Foto (für die Tourkarte); mit der Kamera ohne EXIF zählt der Zeitpunkt des Hinzufügens
  const info = Object.assign({}, e.fotoInfo);
  for (const f of TB.weg) delete info[f];
  for (const n of TB.neu) info[n.id] = n.info || (n.kamera ? { zeit: n.zeit } : null);
  for (const k of Object.keys(info)) if (!info[k]) delete info[k];
  if (Object.keys(info).length) e.fotoInfo = info; else delete e.fotoInfo;
  if (!tagebuchSchreiben(d)) return;
  for (const f of TB.weg) await FOTOS.weg(f).catch(() => {});
  TB.neu = []; TB.weg = []; TB.eintrag = null; TB.entwurf++;
  reiseZeigen(TB.reise);
  melde('Eintrag gespeichert.');
}

async function eintragLoeschen(id, knopf) {
  if (!knopf.dataset.sicher) {
    knopf.dataset.sicher = '1';
    knopf.textContent = 'Löschen?';
    setTimeout(() => { if (knopf.isConnected && knopf.dataset.sicher) { delete knopf.dataset.sicher; knopf.textContent = '🗑'; } }, 4000);
    return;
  }
  const d = tagebuchLesen();
  const e = d.eintraege.find(x => x.id === id);
  d.eintraege = d.eintraege.filter(x => x.id !== id);
  if (!tagebuchSchreiben(d)) return;
  for (const f of (e && e.fotos) || []) await FOTOS.weg(f).catch(() => {});
  reiseZeigen(TB.reise);
}

// ---------- Sicherung: Tagebuch mit Fotos (Blobs; in der ZIP als eigene Dateien) ----------
async function tagebuchFuerSicherung() {
  const d = tagebuchLesen();
  const fotos = {};
  let fehlen = 0;
  for (const e of d.eintraege) {
    for (const f of e.fotos || []) {
      try {
        const b = await FOTOS.holen(f);
        if (!b) { fehlen++; continue; }
        fotos[f] = b;
      } catch (err) { fehlen++; }
    }
  }
  return { tagebuch: d, fotos, fehlen };
}

async function tagebuchEinlesen(text) {
  const neu = R.sicherungTagebuch(text);
  const d = tagebuchLesen();
  const reisen = new Set(d.reisen.map(r => r.id)), eintraege = new Set(d.eintraege.map(e => e.id));
  const rDazu = neu.reisen.filter(r => !reisen.has(r.id)), eDazu = neu.eintraege.filter(e => !eintraege.has(e.id));
  if (!rDazu.length && !eDazu.length) return 0;
  // Fotos zuerst; scheitert eines, bleibt das Tagebuch unverändert und das Laden lässt sich wiederholen
  try {
    for (const e of eDazu) {
      for (const f of e.fotos) {
        const x = neu.fotos[f];
        await FOTOS.ablegen(f, typeof x === 'string' ? await (await fetch(x)).blob() : new Blob([x], { type: R.bildArt(x) }));
      }
    }
  } catch (err) { throw new Error('Fotos nicht gespeichert (' + (err.message || err) + '), Tagebuch nicht übernommen'); }
  d.reisen = d.reisen.concat(rDazu);
  d.eintraege = d.eintraege.concat(eDazu);
  return tagebuchSchreiben(d) ? eDazu.length + rDazu.length : 0;
}

// ---------- Einträge auf der Karte ----------
// jeder Eintrag mit Ort als 📔-Punkt; das Fenster zeigt Zeit, Ort und Textanfang, „Öffnen“ springt zum Eintrag
function tagebuchPunkte() {
  ebeneTagebuch.clearLayers();
  const d = tagebuchLesen();
  const reisen = Object.fromEntries(d.reisen.map(r => [r.id, r]));
  for (const e of d.eintraege) {
    if (!e.ort || !reisen[e.reise]) continue;
    const m = L.marker([e.ort.lat, e.ort.lon], { title: reisen[e.reise].name,
      icon: L.divIcon({ className: '', html: '<div class="tb-mk">📔</div>', iconSize: [28, 28], iconAnchor: [14, 14] }) });
    m.bindPopup(() => {
      const box = document.createElement('div');
      const anfang = e.text.length > 140 ? e.text.slice(0, 140) + '…' : e.text;
      box.innerHTML = '<b>' + R.esc(reisen[e.reise].name) + '</b><br><span class="klein">' +
        R.esc(new Date(e.zeit).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + R.uhr(new Date(e.zeit)) + ' Uhr · ' + ortWetterText(e)) +
        '</span>' + (anfang ? '<p style="margin:6px 0">' + R.esc(anfang) + '</p>' : '<br>');
      const b = document.createElement('button');
      b.className = 'knopf'; b.textContent = 'Öffnen';
      b.onclick = () => { karte.closePopup(); eintragZeigen(e.reise, e.id); };
      box.appendChild(b);
      return box;
    });
    m.addTo(ebeneTagebuch);
  }
}

// zu einem Eintrag springen: Reise öffnen, Eintrag ins Bild und kurz hervorheben
async function eintragZeigen(reiseId, eintragId) {
  TB.ansicht = 'reise';
  TB.reise = reiseId;
  reiter('tagebuch');
  await reiseZeigen(reiseId);
  const el = document.querySelector('.tb-eintrag[data-eintrag="' + eintragId + '"]');
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  el.classList.add('hervor');
  setTimeout(() => el.classList.remove('hervor'), 2500);
}

// ---------- Reise als Heft (Drucken oder „Als PDF speichern“) ----------
let heftUrls = [];

async function heftBauen(reiseId) {
  const d = tagebuchLesen();
  const r = d.reisen.find(x => x.id === reiseId);
  if (!r) return false;
  heftUrls.forEach(u => URL.revokeObjectURL(u)); heftUrls = [];
  const eintraege = d.eintraege.filter(e => e.reise === reiseId).sort((a, b) => a.zeit - b.zeit);
  const touren = R.reiseTouren(tourenLesen(), r);
  // Nummern für Einträge mit Ort, gleich in Skizze und Text
  let nr = 0;
  const nummer = new Map(eintraege.filter(e => e.ort).map(e => [e.id, ++nr]));
  const skizze = R.heftSkizze(eintraege.filter(e => e.ort).map(e => ({ lat: e.ort.lat, lon: e.ort.lon, nr: nummer.get(e.id) })),
    touren.flatMap(t => R.spurTeile(spurEntpacken(t.spur))), 700, 380);
  const fotos = eintraege.reduce((n, e) => n + (e.fotos || []).length, 0);
  const km = touren.reduce((s, t) => s + (+t.kurz.laenge || 0), 0);
  const h = $('tbHeft');
  h.innerHTML = '<h1>' + R.esc(r.name) + '</h1><p class="unter">' + R.esc(zeitraumText(r)) + '</p>' +
    '<div class="heft-zahlen"><span><b>' + eintraege.length + '</b>' + (eintraege.length === 1 ? 'Eintrag' : 'Einträge') + '</span><span><b>' + fotos + '</b>Fotos</span>' +
    (touren.length ? '<span><b>' + touren.length + '</b>' + (touren.length === 1 ? 'Tour' : 'Touren') + '</span><span><b>' + R.kmText(km) + '</b>unterwegs</span>' : '') + '</div>' + skizze;
  const warten = [];
  for (const t of R.tagebuchTage(eintraege).reverse()) {
    const h2 = document.createElement('h2');
    h2.textContent = datumLang(t.tag);
    h.appendChild(h2);
    for (const e of t.eintraege) {
      const div = document.createElement('div');
      div.className = 'heft-eintrag';
      div.innerHTML = '<div class="heft-kopf">' + (nummer.has(e.id) ? '<span class="nr">' + nummer.get(e.id) + '</span>' : '') +
        R.esc(R.uhr(new Date(e.zeit)) + ' Uhr' + (ortWetterText(e) ? ' · ' + ortWetterText(e) : '')) + '</div>';
      if (e.text) { const p = document.createElement('div'); p.className = 'heft-text'; p.textContent = e.text; div.appendChild(p); }
      if (e.fotos && e.fotos.length) {
        const g = document.createElement('div');
        g.className = 'heft-fotos';
        for (const f of e.fotos) {
          const b = await FOTOS.holen(f).catch(() => null);
          if (!b) continue;
          const img = document.createElement('img');
          img.alt = '';
          const u = URL.createObjectURL(b); heftUrls.push(u);
          img.src = u;
          warten.push(img.decode().catch(() => {}));
          g.appendChild(img);
        }
        div.appendChild(g);
      }
      h.appendChild(div);
    }
  }
  const fuss = document.createElement('p');
  fuss.className = 'heft-fuss';
  fuss.textContent = 'Reisetagebuch aus Gipfel & Gasse, erstellt am ' + new Date().toLocaleDateString('de-DE') + '.';
  h.appendChild(fuss);
  await Promise.all(warten);
  return true;
}

function heftEnde() {
  if (!document.documentElement.classList.contains('heft')) return;
  document.documentElement.classList.remove('heft');
  $('tbHeft').hidden = true;
  // Fotos des Hefts freigeben (bei fotoreichen Reisen sonst bis zum nächsten Heft im Speicher)
  $('tbHeft').innerHTML = '';
  heftUrls.forEach(u => URL.revokeObjectURL(u)); heftUrls = [];
  druckName = null;
  themaSetzen(thema, false);   // Darstellung zurück (fürs Heft auf hell gestellt)
  karte.invalidateSize();
}
window.addEventListener('afterprint', heftEnde);

$('tbHeftKnopf').onclick = async () => {
  const b = $('tbHeftKnopf');
  if (b.disabled) return;
  b.disabled = true;
  try {
    if (!(await heftBauen(TB.reise))) return;
    document.documentElement.dataset.thema = 'hell';   // Papier ist weiß
    $('tbHeft').hidden = false;
    document.documentElement.classList.add('heft');
    druckName = 'Reisetagebuch ' + $('tbTitel').textContent;
    try {
      const r = window.print();
      if (r && typeof r.then === 'function') { r.then(heftEnde, err => { heftEnde(); melde('Drucken ging nicht: ' + (err.message || err)); }); return; }
    } catch (err) { melde('Drucken ging nicht: ' + err.message); }
    setTimeout(heftEnde, 500);
  } finally { b.disabled = false; }
};

tagebuchPunkte();
