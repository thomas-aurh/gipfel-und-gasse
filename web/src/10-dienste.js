// Anfragen an die freien OSM-Dienste. Nur auf Handlung hin, nie im Hintergrund.
const DIENST = {
  brouter: 'https://brouter.de/brouter',
  photon: 'https://photon.komoot.io/api/',
  overpass: 'https://overpass-api.de/api/interpreter',
  wetter: 'https://api.open-meteo.com/v1/forecast',
  hoehe: 'https://api.open-meteo.com/v1/elevation'
};

// Profile: was der Nutzer wählt → BRouter-Profil und Zeitrechnung
const PROFILE = {
  wandern: { brouter: 'hiking-mountain', art: 'fuss', name: 'Wandern' },
  stadt: { brouter: 'hiking-mountain', art: 'fuss', name: 'Stadtspaziergang' },
  laufen: { brouter: 'hiking-mountain', art: 'lauf', name: 'Laufen' },
  rad: { brouter: 'trekking', art: 'rad', name: 'Fahrrad' },
  kurz: { brouter: 'shortest', art: 'fuss', name: 'Kürzester Weg' },
  linie: { brouter: null, art: 'fuss', name: 'Gerade Linie' }
};

async function holen(url, opt, sekunden) {
  const ab = new AbortController();
  const uhr = setTimeout(() => ab.abort(), (sekunden || 25) * 1000);
  // das Zeitlimit gilt bis der Inhalt vollständig gelesen ist, nicht nur bis zu den Kopfzeilen
  try {
    let r;
    try { r = await fetch(url, Object.assign({ signal: ab.signal }, opt || {})); }
    catch (e) { throw new Error(e.name === 'AbortError' ? 'Zeitüberschreitung' : 'keine Verbindung'); }
    let text;
    try { text = await r.text(); }
    catch (e) { throw new Error(e.name === 'AbortError' ? 'Zeitüberschreitung' : 'Antwort abgebrochen'); }
    if (!r.ok) throw new Error(r.status === 429 ? 'zu viele Anfragen, bitte kurz warten' : (text.slice(0, 160) || ('Fehler ' + r.status)));
    try { return JSON.parse(text); } catch (e) { throw new Error('unlesbare Antwort'); }
  } finally { clearTimeout(uhr); }
}

// höchstens drei Anfragen an BRouter gleichzeitig: ein Rundgang mit zehn Stopps soll den freien Dienst nicht fluten
let brouterAktiv = 0;
const brouterWarten = [];
async function brouterPlatz() {
  if (brouterAktiv < 3) { brouterAktiv++; return; }
  await new Promise(r => brouterWarten.push(r));
  brouterAktiv++;
}
function brouterFrei() { brouterAktiv--; const n = brouterWarten.shift(); if (n) n(); }

// ein Teilstück zwischen zwei Wegpunkten
async function teilstueck(a, b, profilKey) {
  const p = PROFILE[profilKey] || PROFILE.wandern;
  if (!p.brouter) {
    const s = R.linie(a, b);
    await hoehenFuellen(s.pts);
    return Object.assign(s, { quelle: 'linie' });
  }
  // in der App: ohne Netz rechnen, wenn ein Kartenpaket die Routendaten für beide Punkte enthält
  const offline = await routeOffline(a, b, p.brouter);
  if (offline) return offline;
  // timode=2: Abbiegehinweise (voicehints) für die Ansagen unterwegs
  const url = DIENST.brouter + '?lonlats=' + a.lon.toFixed(6) + ',' + a.lat.toFixed(6) + '|' + b.lon.toFixed(6) + ',' + b.lat.toFixed(6) +
    '&profile=' + p.brouter + '&alternativeidx=0&format=geojson&timode=2&profile:turnInstructionRoundabouts=1';
  await brouterPlatz();
  let s;
  try { s = R.brouterLesen(await holen(url, null, 30)); } finally { brouterFrei(); }
  if (s.pts.some(x => x.ele == null)) await hoehenFuellen(s.pts);
  return Object.assign(s, { quelle: 'brouter' });
}

// fehlende Höhen von Open-Meteo (Copernicus-Höhenmodell, 90 m); höchstens 100 Punkte je Anfrage,
// dazwischen wird linear gefüllt
async function hoehenFuellen(pts) {
  // zuerst aus einem heruntergeladenen Kartenpaket (geht ohne Netz), danach Open-Meteo für den Rest
  if (pts.some(p => p.ele == null)) await hoehenOffline(pts);
  const fehlt = pts.map((p, i) => p.ele == null ? i : -1).filter(i => i >= 0);
  if (!fehlt.length) return;
  const schritt = Math.max(1, Math.ceil(fehlt.length / 300));
  const proben = fehlt.filter((_, k) => k % schritt === 0);
  if (proben[proben.length - 1] !== fehlt[fehlt.length - 1]) proben.push(fehlt[fehlt.length - 1]);
  try {
    for (let k = 0; k < proben.length; k += 100) {
      const teil = proben.slice(k, k + 100);
      const j = await holen(DIENST.hoehe + '?latitude=' + teil.map(i => pts[i].lat.toFixed(5)).join(',') +
        '&longitude=' + teil.map(i => pts[i].lon.toFixed(5)).join(','), null, 20);
      (j.elevation || []).forEach((e, n) => { if (e != null && !isNaN(e)) pts[teil[n]].ele = e; });
    }
  } catch (e) { return; }  // ohne Höhen geht es auch, nur ohne Profil
  // Lücken linear füllen
  let letzte = -1;
  for (let i = 0; i < pts.length; i++) {
    if (pts[i].ele == null) continue;
    if (letzte >= 0 && i - letzte > 1) for (let k = letzte + 1; k < i; k++) pts[k].ele = pts[letzte].ele + (pts[i].ele - pts[letzte].ele) * (k - letzte) / (i - letzte);
    letzte = i;
  }
}

// in der App mit Kartenpaket: zuerst im Paket suchen (geht ohne Netz), dann online; die Treffer werden gemischt
async function suchen(text, nahe) {
  const off = await sucheOfflineAlle(text, nahe);
  if (navigator.onLine === false && mitOrten().length) return off;   // ohne Netz: auch „nichts gefunden“ kommt aus dem Paket
  let online;
  try { online = await sucheOnline(text, nahe, off.length ? 6 : 12); }
  catch (e) { if (off.length) return off; throw e; }
  // online zuerst (findet auch Vertipptes), dann was nur das Paket kennt; derselbe Ort nur einmal
  const neu = off.filter(o => !online.some(x => R.suchNorm(x.name) === R.suchNorm(o.name) && R.abstand(x, o) < 300));
  return online.slice(0, Math.max(4, 7 - neu.length)).concat(neu).slice(0, 8);
}

async function sucheOnline(text, nahe, sekunden) {
  let url = DIENST.photon + '?q=' + encodeURIComponent(text) + '&lang=de&limit=7';
  if (nahe) url += '&lat=' + nahe.lat.toFixed(4) + '&lon=' + nahe.lng.toFixed(4) + '&location_bias_scale=0.3';
  const j = await holen(url, null, sekunden);
  return (j.features || []).map(f => {
    const p = f.properties || {}, c = f.geometry.coordinates;
    const wo = [p.city || p.town || p.village || p.county, p.state, p.country].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
    let art = '';
    if (p.osm_key === 'natural' && p.osm_value === 'peak') art = 'Gipfel';
    else if (p.osm_value === 'alpine_hut' || p.osm_value === 'wilderness_hut') art = 'Hütte';
    else if (p.osm_key === 'place') art = { city: 'Stadt', town: 'Stadt', village: 'Dorf', hamlet: 'Weiler', suburb: 'Ortsteil' }[p.osm_value] || '';
    else if (p.osm_key === 'natural' && p.osm_value === 'water') art = 'See';
    return { name: p.name || wo[0] || 'Ort', wo: [art].concat(wo).filter(Boolean).join(' · '), lat: c[1], lon: c[0], extent: p.extent };
  });
}

// in der App mit Kartenpaket aus dessen Orte-Datei (schnell, geht ohne Netz), sonst Overpass
async function orteHolen(pts, radius) {
  const off = await orteOffline(pts, radius);
  if (off) return off;
  const q = R.overpassAbfrage(pts, radius);
  return holen(DIENST.overpass, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 35);
}

async function stadtHolen(bbox) {
  const off = await stadtOffline(bbox);
  if (off) return off;
  const q = R.stadtAbfrage(bbox);
  return holen(DIENST.overpass, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, 35);
}

async function wetterHolen(lat, lon) {
  const url = DIENST.wetter + '?latitude=' + lat.toFixed(3) + '&longitude=' + lon.toFixed(3) +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunset&timezone=auto&forecast_days=3';
  return holen(url, null, 15);
}
