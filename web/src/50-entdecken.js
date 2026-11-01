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
  else karte.setView([x.lat, x.lon], 15);
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
async function wetterLaden() {
  const e = S.ergebnis;
  const p = e && e.pts.length ? e.pts[0] : (() => { const c = karte.getCenter(); return { lat: c.lat, lon: c.lng }; })();
  const k = p.lat.toFixed(2) + ',' + p.lon.toFixed(2);
  if (k === wetterFuer) return;
  wetterFuer = k;
  $('wetter').textContent = 'Wetter wird geladen …';
  try {
    const j = await wetterHolen(p.lat, p.lon);
    const d = j.daily, tage = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    let html = '<div class="wetter">', gewitter = false;
    for (let i = 0; i < d.time.length; i++) {
      const [zeichen, text] = R.wetterText(d.weather_code[i]);
      if (d.weather_code[i] >= 95) gewitter = true;
      const tag = i === 0 ? 'Heute' : i === 1 ? 'Morgen' : tage[new Date(d.time[i] + 'T12:00').getDay()];
      html += '<div>' + tag + '<b>' + zeichen + '</b>' + text + '<br>' + Math.round(d.temperature_2m_min[i]) + '° / ' + Math.round(d.temperature_2m_max[i]) + '°' +
        '<br><span class="klein">Regen ' + (d.precipitation_probability_max[i] ?? '–') + ' % · Wind ' + Math.round(d.wind_speed_10m_max[i]) + ' km/h' +
        '<br>Sonne bis ' + String(d.sunset[i]).slice(11, 16) + '</span></div>';
    }
    html += '</div>';
    if (gewitter) html = '<div class="warnung">⛈️ Gewitter angesagt: In den Bergen früh starten und Grate am Nachmittag meiden.</div>' + html;
    $('wetter').innerHTML = html + '<p class="klein">Vorhersage für ' + p.lat.toFixed(3) + ', ' + p.lon.toFixed(3) + ' (Open-Meteo). Am Gipfel ist es kälter und windiger: je 100 m etwa 0,65 °C weniger.</p>';
  } catch (err) {
    wetterFuer = '';
    $('wetter').textContent = 'Wetter nicht erreichbar: ' + err.message;
  }
}
