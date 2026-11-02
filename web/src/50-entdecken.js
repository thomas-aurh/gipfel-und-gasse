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
    m.bindPopup(() => ortPopup(o, kat));
    m.addTo(ebeneOrte);
    const li = document.createElement('li');
    li.innerHTML = '<span class="zeichen">' + kat.zeichen + '</span><span class="was">' + R.esc(o.name) +
      '<small>' + (o.d != null ? 'bei ' + R.kmText(o.d) + (o.abw > 40 ? ' · ' + Math.round(o.abw / 10) * 10 + ' m abseits' : ' · an der Route') : kat.name) + '</small></span>';
    li.onclick = () => { karte.setView([o.lat, o.lon], Math.max(karte.getZoom(), 15)); m.openPopup(); };
    liste.appendChild(li);
  }
}

function ortPopup(o, kat) {
  const t = o.tags, z = [];
  z.push('<b>' + kat.zeichen + ' ' + R.esc(o.name) + '</b>');
  if (t.opening_hours) z.push('Geöffnet: ' + R.esc(t.opening_hours));
  if (t.ele && t.natural !== 'peak') z.push(Math.round(parseFloat(t.ele)) + ' m');
  if (t.operator) z.push(R.esc(t.operator));
  if (t.website || t['contact:website']) {
    const url = t.website || t['contact:website'];
    if (/^https?:\/\//.test(url)) z.push('<a href="' + R.esc(url) + '" target="_blank" rel="noopener">Webseite</a>');
  }
  if (o.d != null) z.push('<span class="klein">bei ' + R.kmText(o.d) + ' der Route</span>');
  z.push('<a href="https://www.openstreetmap.org/' + o.id + '" target="_blank" rel="noopener" class="klein">in OpenStreetMap ansehen</a>');
  return z.join('<br>');
}

// ---------- Wetter ----------
let wetterFuer = '';
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
  if (wetterWahl === 'ort' && !wetterPlatz) { $('wetter').textContent = 'Einen Gipfel, eine Stadt oder eine Hütte suchen.'; $('wetterSuchfeld').focus(); return; }
  wetterLaden(true);
};
$('wetterSuche').onsubmit = async ev => {
  ev.preventDefault();
  const text = $('wetterSuchfeld').value.trim();
  if (text.length < 2) return;
  const ul = $('wetterTreffer');
  ul.hidden = false;
  ul.innerHTML = '<li style="cursor:default"><span class="was klein">Suche …</span></li>';
  let treffer;
  try { treffer = await suchen(text, karte.getCenter()); } catch (err) { ul.innerHTML = '<li style="cursor:default"><span class="was klein">' + R.esc('Suche nicht möglich: ' + err.message) + '</span></li>'; return; }
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
  const p = await wetterPunkt();
  if (!p) { $('wetter').textContent = 'Einen Gipfel, eine Stadt oder eine Hütte suchen.'; return; }
  const k = wetterWahl + ':' + p.lat.toFixed(2) + ',' + p.lon.toFixed(2);
  if (k === wetterFuer && !neu) return;
  wetterFuer = k;
  $('wetter').textContent = 'Wetter wird geladen …';
  try {
    // Ortsname nur, wo er nicht schon bekannt ist (nur mit Netz; sonst bleiben die Koordinaten)
    const [j, name] = await Promise.all([wetterHolen(p.lat, p.lon), p.name ? Promise.resolve(p.name) : ortsname(p.lat, p.lon).catch(() => null)]);
    if (k !== wetterFuer) return;   // inzwischen anderer Ort gewählt
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
    const hoehe = typeof j.elevation === 'number' ? ' auf ' + Math.round(j.elevation) + ' m' : '';
    $('wetter').innerHTML = html + '<p class="klein">' + R.esc((p.hinweis || '') + 'Vorhersage für ' + wo + ', ' + p.art + hoehe +
      ' (Open-Meteo). Gerechnet für die Geländehöhe an diesem Punkt; je 100 m höher etwa 0,65 °C kälter.') + '</p>';
  } catch (err) {
    wetterFuer = '';
    $('wetter').textContent = 'Wetter nicht erreichbar: ' + err.message;
  }
}
