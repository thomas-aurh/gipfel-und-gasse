// Suche, Orte entlang der Route, Wetter
// ---------- Suche (Photon, mit Pause beim Tippen) ----------
let suchUhr = null, suchNr = 0, trefferListe = [], trefferAktiv = -1;
$('suchfeld').addEventListener('input', () => {
  clearTimeout(suchUhr);
  suchNr++; trefferListe = []; trefferAktiv = -1;
  const t = $('suchfeld').value.trim();
  if (t.length < 3) { $('treffer').innerHTML = ''; trefferListe = []; return; }
  suchUhr = setTimeout(() => sucheLos(t), 450);
});
$('suchfeld').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); if (trefferListe.length) trefferWaehlen(trefferListe[Math.max(0, trefferAktiv)]); else sucheLos($('suchfeld').value.trim()); }
  if (e.key === 'Escape') { $('treffer').innerHTML = ''; $('suchfeld').blur(); }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!trefferListe.length) return;
    trefferAktiv = (trefferAktiv + (e.key === 'ArrowDown' ? 1 : -1) + trefferListe.length) % trefferListe.length;
    [...$('treffer').children].forEach((b, i) => b.classList.toggle('aktiv', i === trefferAktiv));
  }
});
document.addEventListener('click', e => { if (!$('oben').contains(e.target)) $('treffer').innerHTML = ''; });
// Suche schließen: auch eine wartende oder laufende Anfrage verwerfen, damit die Liste nicht wieder aufgeht
function sucheSchliessen() {
  clearTimeout(suchUhr); suchNr++; trefferListe = []; trefferAktiv = -1;
  $('treffer').innerHTML = ''; $('suchfeld').blur();
}

async function sucheLos(t) {
  if (!t) return;
  const nr = ++suchNr;
  try {
    const liste = await suchen(t, karte.getCenter());
    if (nr !== suchNr) return;
    trefferListe = liste; trefferAktiv = -1;
    $('treffer').innerHTML = '';
    if (!liste.length) { $('treffer').innerHTML = '<button disabled>Nichts gefunden</button>'; return; }
    for (const x of liste) {
      const b = document.createElement('button');
      b.innerHTML = R.esc(x.name) + '<small>' + R.esc(x.wo) + '</small>';
      b.onclick = () => trefferWaehlen(x);
      $('treffer').appendChild(b);
    }
  } catch (e) {
    if (nr === suchNr) $('treffer').innerHTML = '<button disabled>Suche nicht erreichbar: ' + R.esc(e.message) + '</button>';
  }
}

let suchMarke = null;
function trefferWaehlen(x) {
  $('treffer').innerHTML = '';
  $('suchfeld').value = x.name;
  $('suchfeld').blur();
  if (x.extent) einpassen([[x.extent[1], x.extent[0]], [x.extent[3], x.extent[2]]]);
  else einpassen(L.latLng(x.lat, x.lon).toBounds(800));   // Rand für das Blatt am Telefon
  if (suchMarke) suchMarke.remove();
  const box = document.createElement('div');
  box.innerHTML = '<b>' + R.esc(x.name) + '</b><br><span class="klein">' + R.esc(x.wo) + '</span><br>';
  const knopf = (text, index) => {
    const k = document.createElement('button');
    k.className = 'popup-knopf';
    k.textContent = text;
    k.onclick = () => { karte.closePopup(); suchMarke.remove(); wegpunktDazu(x.lat, x.lon, index, { name: x.name }); };
    box.appendChild(k);
  };
  // mit Start und Ziel: vor dem Ziel einfügen oder als neues Ziel anhängen
  if (S.wps.length >= 2 && !S.fest) { knopf('Als Zwischenziel', S.wps.length - 1); box.appendChild(document.createTextNode(' ')); knopf('Als neues Ziel'); }
  else knopf(S.wps.length ? 'Als Ziel' : 'Als Start');
  suchMarke = L.circleMarker([x.lat, x.lon], { radius: 8, color: '#fff', weight: 3, fillColor: '#2f6b3a', fillOpacity: 1 }).addTo(karte).bindPopup(box).openPopup();
}

// ---------- Orte ----------
let orte = [];
const orteAus = new Set(SPEICHER.lesen('orteAus', ['wc', 'parken']));

$('bOrte').onclick = async () => {
  const e = S.ergebnis;
  const radius = +$('radiuswahl').value;
  let pts, wo;
  if (e && e.pts.length > 1) { pts = e.pts; wo = 'entlang der Route'; }
  else { const c = karte.getCenter(); pts = [{ lat: c.lat, lon: c.lng }]; wo = 'rund um die Kartenmitte'; }
  $('orteStatus').textContent = 'Suche Orte ' + wo + ' …';
  $('bOrte').disabled = true;
  try {
    const json = await orteHolen(pts, pts.length > 1 ? radius : 2000);
    orte = R.orteLesen(json, pts.length > 1 ? pts : null);
    $('orteStatus').textContent = (orte.length ? orte.length + ' Orte ' + wo + '.' : 'Keine Orte ' + wo + ' gefunden.') + (json.offline ? ' Aus dem Kartenpaket.' : '');
    orteZeigen();
  } catch (err) {
    $('orteStatus').textContent = 'Orte nicht erreichbar: ' + err.message;
  } finally { $('bOrte').disabled = false; }
};

function orteZeigen() {
  ebeneOrte.clearLayers();
  const chips = $('chips'), liste = $('ortliste');
  chips.innerHTML = ''; liste.innerHTML = '';
  const zahl = {};
  orte.forEach(o => { zahl[o.kat] = (zahl[o.kat] || 0) + 1; });
  for (const k of R.ORTE) {
    if (!zahl[k.k]) continue;
    const b = document.createElement('button');
    b.textContent = k.zeichen + ' ' + k.name + ' ' + zahl[k.k];
    b.classList.toggle('aus', orteAus.has(k.k));
    b.onclick = () => { if (orteAus.has(k.k)) orteAus.delete(k.k); else orteAus.add(k.k); SPEICHER.schreiben('orteAus', [...orteAus]); orteZeigen(); };
    chips.appendChild(b);
  }
  for (const o of orte) {
    if (orteAus.has(o.kat)) continue;
    const kat = R.ORTE.find(k => k.k === o.kat);
    const m = L.marker([o.lat, o.lon], { icon: L.divIcon({ className: '', html: '<div class="ort-mk">' + kat.zeichen + '</div>', iconSize: [30, 30], iconAnchor: [15, 15] }) });
    m.bindPopup(lage => ortPopup(o, kat, lage));
    m.addTo(ebeneOrte);
    const li = document.createElement('li');
    li.innerHTML = '<span class="zeichen">' + kat.zeichen + '</span><span class="was">' + R.esc(o.name) +
      '<small>' + (o.d != null ? 'bei ' + R.kmText(o.d) + (o.abw > 40 ? ' · ' + Math.round(o.abw / 10) * 10 + ' m abseits' : ' · an der Route') : kat.name) + '</small></span>';
    li.onclick = () => { karte.setView([o.lat, o.lon], Math.max(karte.getZoom(), 15)); m.openPopup(); };
    liste.appendChild(li);
  }
}

function ortPopup(o, kat, lage) {
  const t = o.tags, z = [], box = document.createElement('div');
  z.push('<b>' + kat.zeichen + ' ' + R.esc(o.name) + '</b>');
  if (t.opening_hours) z.push(oeffnungHtml(t.opening_hours));
  if (t.ele && t.natural !== 'peak') z.push(Math.round(parseFloat(t.ele)) + ' m');
  if (t.operator) z.push(R.esc(t.operator));
  if (t.website || t['contact:website']) {
    const url = t.website || t['contact:website'];
    if (/^https?:\/\//.test(url)) z.push('<a href="' + R.esc(url) + '" target="_blank" rel="noopener">Webseite</a>');
  }
  if (o.d != null) z.push('<span class="klein">bei ' + R.kmText(o.d) + ' der Route</span>');
  z.push('<a href="https://www.openstreetmap.org/' + o.id + '" target="_blank" rel="noopener" class="klein">in OpenStreetMap ansehen</a>');
  box.innerHTML = z.join('<br>');
  wikiAnhaengen(box, t, lage);
  return box;
}

// Öffnungszeiten: Stand jetzt farbig (geöffnet, schließt bald, geschlossen), darunter der Eintrag aus OSM
function oeffnungHtml(roh) {
  const j = R.oeffnungJetzt(roh, new Date());
  if (j.zustand === 'unbekannt') return 'Geöffnet: ' + R.esc(roh);
  return '<span class="oh oh-' + j.zustand + '">● ' + R.esc(j.text.charAt(0).toUpperCase() + j.text.slice(1)) + '</span><br><span class="klein">' + R.esc(roh) + '</span>';
}
// kurz für Listen: nur der Stand, ohne den Eintrag
function oeffnungKurz(roh) {
  const j = R.oeffnungJetzt(roh, new Date());
  return j.zustand === 'unbekannt' ? R.esc(roh) : '<span class="oh oh-' + j.zustand + '">● ' + R.esc(j.text.replace(/ \(Feiertage nicht berücksichtigt\)$/, '')) + '</span>';
}

// Vorlesen: im Browser die Sprachausgabe des Browsers; die App ersetzt das durch die von Android (75-app.js)
let vorlesen = function (text) {
  if (!window.speechSynthesis) { melde('Vorlesen geht in diesem Browser nicht.'); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = 'de-DE'; speechSynthesis.speak(u);
};
let vorlesenStopp = function () { if (window.speechSynthesis) speechSynthesis.cancel(); };
karte.on('popupclose', () => vorlesenStopp());

// Kurzinfo aus Wikipedia im Ort-Fenster, sobald es aufgeht (nur Orte mit Wikipedia- oder Wikidata-Eintrag in OSM)
function wikiAnhaengen(box, tags, lage) {
  const quelle = R.wikiQuelle(tags);
  if (!quelle) return;
  const w = document.createElement('div');
  w.className = 'wiki klein';
  w.textContent = 'Kurzinfo aus Wikipedia wird geladen …';
  box.appendChild(w);
  // neu ausmessen, ohne den Inhalt neu zu bauen: update() riefe sonst die Inhaltsfunktion und damit diese hier wieder auf.
  // Darum das fertige Element als Inhalt setzen und beim Schließen die Funktion zurück (nächstes Öffnen rechnet frisch).
  const neuZeichnen = () => {
    const p = lage && lage.getPopup && lage.getPopup();
    if (!p || !p.isOpen() || p.getContent() === box) { if (p && p.isOpen()) p.update(); return; }
    const fn = p.getContent();
    p.setContent(box);
    // erst nach dem Schließen tauschen: währenddessen hinge setContent noch an der Karte und zeichnete neu
    lage.once('popupclose', () => setTimeout(() => { if (!p.isOpen()) p.setContent(fn); }, 0));
  };
  wikiHolen(quelle).then(k => {
    if (!k) { w.remove(); neuZeichnen(); return; }
    w.innerHTML = (k.bild ? '<img alt="" src="' + R.esc(k.bild) + '">' : '') + '<p>' + R.esc(k.text.length > 600 ? k.text.slice(0, 600).replace(/\s\S*$/, '') + ' …' : k.text) + '</p>' +
      '<span>Aus der Wikipedia (CC BY-SA 4.0)' + (k.url ? ' · <a href="' + R.esc(k.url) + '" target="_blank" rel="noopener">Artikel lesen</a>' : '') + '</span> ' +
      '<button type="button" class="popup-knopf wiki-vor">🔊 Vorlesen</button>';
    const img = w.querySelector('img');
    if (img) img.onload = neuZeichnen;
    w.querySelector('.wiki-vor').onclick = ev => {
      const b = ev.currentTarget;
      if (b.dataset.an) { vorlesenStopp(); delete b.dataset.an; b.textContent = '🔊 Vorlesen'; return; }
      vorlesen(k.text); b.dataset.an = '1'; b.textContent = '⏹ Stopp';
    };
    neuZeichnen();
  }).catch(() => { w.textContent = 'Kurzinfo aus Wikipedia gerade nicht erreichbar.'; neuZeichnen(); });
}

// ---------- Wetter ----------
let wetterFuer = '';
let wetterPunktZuletzt = null;   // Punkt der zuletzt gezeigten Vorhersage (für „drinnen in der Nähe“)
let wetterNr = 0, wetterFuerNr = 0, wetterSuchNr = 0;   // jüngste Anfrage gewinnt; verspätete Antworten werden verworfen
// Wofür das Wetter gilt: Start der Route, eigener Standort, Kartenmitte oder ein gesuchter Ort (gespeichert)
let wetterWahl = SPEICHER.lesen('wetterOrt', 'start');
let wetterPlatz = SPEICHER.lesen('wetterPlatz', null);
if (!['start', 'standort', 'mitte', 'ort'].includes(wetterWahl)) wetterWahl = 'start';
$('wetterOrt').value = wetterWahl;
$('wetterSuche').hidden = wetterWahl !== 'ort';
$('wetterOrt').onchange = e => {
  wetterWahl = e.target.value;
  SPEICHER.schreiben('wetterOrt', wetterWahl);
  $('wetterSuche').hidden = wetterWahl !== 'ort';
  $('wetterTreffer').hidden = true;
  wetterSuchNr++;
  if (wetterWahl === 'ort' && !wetterPlatz) { wetterNr++; wetterFuer = ''; $('wetter').textContent = 'Einen Gipfel, eine Stadt oder eine Hütte suchen.'; $('wetterSuchfeld').focus(); return; }
  wetterLaden(true);
};
$('wetterSuche').onsubmit = async ev => {
  ev.preventDefault();
  const text = $('wetterSuchfeld').value.trim();
  if (text.length < 2) return;
  const ul = $('wetterTreffer');
  ul.hidden = false;
  ul.innerHTML = '<li style="cursor:default"><span class="was klein">Suche …</span></li>';
  const nr = ++wetterSuchNr;
  let treffer;
  try { treffer = await suchen(text, karte.getCenter()); } catch (err) { if (nr !== wetterSuchNr) return; ul.innerHTML = '<li style="cursor:default"><span class="was klein">' + R.esc('Suche nicht möglich: ' + err.message) + '</span></li>'; return; }
  if (nr !== wetterSuchNr) return;   // inzwischen neuer gesucht
  ul.innerHTML = treffer.length ? '' : '<li style="cursor:default"><span class="was klein">Nichts gefunden.</span></li>';
  for (const t of treffer) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="zeichen">📍</span><button class="was oeffnen">' + R.esc(t.name) + '<small>' + R.esc(t.wo || '') + '</small></button>';
    li.onclick = () => {
      wetterPlatz = { name: t.name, wo: t.wo || '', lat: t.lat, lon: t.lon };
      SPEICHER.schreiben('wetterPlatz', wetterPlatz);
      ul.hidden = true;
      $('wetterSuchfeld').value = t.name;
      wetterLaden(true);
    };
    ul.appendChild(li);
  }
};

// Punkt und Bezeichnung zur Wahl; null mit Grund, wenn es (noch) keinen gibt
async function wetterPunkt() {
  const mitte = () => { const c = karte.getCenter(); return { lat: c.lat, lon: c.lng, art: 'Kartenmitte' }; };
  if (wetterWahl === 'ort') return wetterPlatz ? { lat: wetterPlatz.lat, lon: wetterPlatz.lon, name: wetterPlatz.name, wo: wetterPlatz.wo, art: 'gesuchter Ort' } : null;
  if (wetterWahl === 'mitte') return mitte();
  if (wetterWahl === 'standort') {
    if (standortFrisch()) return { lat: U.pos.lat, lon: U.pos.lon, art: 'dein Standort' };
    const p = await new Promise(ok => navigator.geolocation ? navigator.geolocation.getCurrentPosition(
      x => ok({ lat: x.coords.latitude, lon: x.coords.longitude, art: 'dein Standort' }), () => ok(null), { timeout: 12000, maximumAge: 300000 }) : ok(null));
    return p || Object.assign(mitte(), { hinweis: 'Kein Standort verfügbar, darum die Kartenmitte. ' });
  }
  const e = S.ergebnis, w = S.wps[0];
  if (e && e.pts.length) return { lat: e.pts[0].lat, lon: e.pts[0].lon, art: 'Start der Route' };
  if (w) return { lat: w.lat, lon: w.lon, art: 'Start der Route' };
  return Object.assign(mitte(), { hinweis: 'Noch keine Route, darum die Kartenmitte. ' });
}

async function wetterLaden(neu) {
  const nr = ++wetterNr;
  const p = await wetterPunkt();
  if (nr !== wetterNr) return;   // inzwischen andere Wahl
  if (!p) { $('wetter').textContent = 'Einen Gipfel, eine Stadt oder eine Hütte suchen.'; return; }
  const k = wetterWahl + ':' + p.lat.toFixed(2) + ',' + p.lon.toFixed(2);
  if (k === wetterFuer && !neu) { wetterNr = wetterFuerNr; return; }   // derselbe Ort: die laufende Anfrage gilt weiter
  wetterFuer = k; wetterFuerNr = nr;
  $('wetter').textContent = 'Wetter wird geladen …';
  try {
    // Ortsname nur, wo er nicht schon bekannt ist (nur mit Netz; sonst bleiben die Koordinaten)
    const [j, name] = await Promise.all([wetterHolen(p.lat, p.lon), p.name ? Promise.resolve(p.name) : ortsname(p.lat, p.lon).catch(() => null)]);
    if (nr !== wetterNr) return;   // inzwischen anderer Ort gewählt
    const d = j.daily, tage = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    let html = '<div class="wetter">';
    for (let i = 0; i < d.time.length; i++) {
      const [zeichen, text] = R.wetterText(d.weather_code[i]);
      const tag = i === 0 ? 'Heute' : i === 1 ? 'Morgen' : tage[new Date(d.time[i] + 'T12:00').getDay()];
      html += '<div>' + tag + '<b>' + zeichen + '</b>' + text + '<br>' + Math.round(d.temperature_2m_min[i]) + '° / ' + Math.round(d.temperature_2m_max[i]) + '°' +
        '<br><span class="klein">Regen ' + (d.precipitation_probability_max[i] ?? '–') + ' % · Wind ' + Math.round(d.wind_speed_10m_max[i]) + ' km/h' +
        '<br>Sonne bis ' + String(d.sunset[i]).slice(11, 16) + '</span></div>';
    }
    html += '</div>';
    const gw = R.gewitterTage(d.weather_code, d.time);
    if (gw.length) html = '<div class="warnung">⛈️ Gewitter ' + gw.join(', ') + ': In den Bergen früh starten und Grate am Nachmittag meiden.</div>' + html;
    const wo = (name ? name + (p.wo ? ' (' + p.wo + ')' : '') : p.lat.toFixed(3) + ', ' + p.lon.toFixed(3));
    // Regen heute oder morgen: Hinweis und der Knopf für „drinnen in der Nähe“ hervorgehoben
    wetterPunktZuletzt = { lat: p.lat, lon: p.lon, name: name || '' };
    const regen = [0, 1].filter(i => i < d.time.length && R.regenTag(d.weather_code[i], d.precipitation_probability_max[i]));
    $('bDrinnen').classList.toggle('haupt', regen.length > 0);
    $('bDrinnen').textContent = regen.length ? '☔ Regen ' + (regen[0] === 0 ? 'heute' : 'morgen') + ': drinnen in der Nähe' : '☔ Drinnen in der Nähe';
    const hoehe = typeof j.elevation === 'number' ? ' auf ' + Math.round(j.elevation) + ' m' : '';
    $('wetter').innerHTML = html + '<p class="klein">' + R.esc((p.hinweis || '') + 'Vorhersage für ' + wo + ', ' + p.art + hoehe +
      ' (Open-Meteo). Gerechnet für die Geländehöhe an diesem Punkt; je 100 m höher etwa 0,65 °C kälter.') + '</p>';
  } catch (err) {
    if (nr !== wetterNr) return;
    wetterFuer = '';
    $('wetter').textContent = 'Wetter nicht erreichbar: ' + err.message;
  }
}

// ---------- Regenplan: Museen, Bäder, Kino und Ähnliches rund um den Wetterort ----------
const ebeneDrinnen = L.layerGroup().addTo(karte);
let drinnenNr = 0;
$('bDrinnen').onclick = async () => {
  const c = karte.getCenter(), p = wetterPunktZuletzt || { lat: c.lat, lon: c.lng, name: '' };
  const nr = ++drinnenNr, st = $('drinnenStatus'), ul = $('drinnenListe');
  st.hidden = false; st.textContent = 'Suche drinnen rund um ' + (p.name || 'den Wetterort') + ' …'; ul.innerHTML = '';
  let liste;
  try { liste = R.regenLesen(await drinnenHolen(p.lat, p.lon, 6000), p); }
  catch (e) { if (nr === drinnenNr) st.textContent = 'Nicht erreichbar: ' + e.message + ' (braucht Netz).'; return; }
  if (nr !== drinnenNr) return;
  ebeneDrinnen.clearLayers();
  if (!liste.length) { st.textContent = 'Im Umkreis von 6 km ist nichts eingetragen.'; return; }
  st.textContent = liste.length + ' Orte im Umkreis von 6 km' + (liste.length > 25 ? ', die 25 nächsten' : '') + '. Antippen zeigt Infos.';
  for (const o of liste.slice(0, 25)) {
    const kat = R.DRINNEN.find(k => k.k === o.kat);
    const m = L.marker([o.lat, o.lon], { icon: L.divIcon({ className: '', html: '<div class="ort-mk">' + kat.zeichen + '</div>', iconSize: [30, 30], iconAnchor: [15, 15] }) });
    m.bindPopup(lage => drinnenPopup(o, kat, lage));
    m.addTo(ebeneDrinnen);
    const li = document.createElement('li');
    li.innerHTML = '<span class="zeichen">' + kat.zeichen + '</span><span class="was">' + R.esc(o.name) + '<small>' + R.esc(kat.name) + ' · ' + R.kmText(o.d) +
      (o.tags.opening_hours ? ' · ' + oeffnungKurz(o.tags.opening_hours) : '') + '</small></span><span class="aktionen"><button title="Als Stopp in die Tour">➕</button></span>';
    li.onclick = () => { karte.setView([o.lat, o.lon], Math.max(karte.getZoom(), 15)); m.openPopup(); };
    li.querySelector('button').onclick = ev => { ev.stopPropagation(); stoppDazu(o); };
    ul.appendChild(li);
  }
};
function drinnenPopup(o, kat, lage) {
  const t = o.tags, box = document.createElement('div'), z = ['<b>' + kat.zeichen + ' ' + R.esc(o.name) + '</b>', '<span class="klein">' + R.esc(kat.name) + ' · ' + R.kmText(o.d) + ' entfernt</span>'];
  if (t.opening_hours) z.push(oeffnungHtml(t.opening_hours));
  const web = t.website || t['contact:website'];
  if (web && /^https?:\/\//.test(web)) z.push('<a href="' + R.esc(web) + '" target="_blank" rel="noopener">Webseite</a>');
  z.push('<a href="https://www.openstreetmap.org/' + o.id + '" target="_blank" rel="noopener" class="klein">in OpenStreetMap ansehen</a>');
  box.innerHTML = z.join('<br>');
  wikiAnhaengen(box, t, lage);
  const k = document.createElement('button');
  k.className = 'popup-knopf'; k.textContent = '➕ Als Stopp';
  k.onclick = () => { karte.closePopup(); stoppDazu(o); };
  box.appendChild(document.createElement('br')); box.appendChild(k);
  return box;
}
