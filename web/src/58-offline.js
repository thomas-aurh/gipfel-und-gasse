// Offline-Karten aus heruntergeladenen Kartenpaketen (nur in der Android-App):
// Vektorkarte (PMTiles, gezeichnet mit protomaps-leaflet), Höhenlinien und Relief aus den Höhendaten, Höhen ohne Netz,
// Routen ohne Netz (BRouter in der App), Orte und Suche ohne Netz (orte.json.gz).
// Die Dateien liefert der native KartenServer unter /_karten_/<paket>/<datei>.
const PAKET_INDEX = 'https://github.com/thomas-aurh/gipfel-und-gasse/releases/download/kartenpakete/pakete.json';
const OFF = { installiert: [], verfuegbar: null, laufend: [], hoehe: {}, uhr: null, bereit: null };

function paketGrenzen(p) { const b = p.bbox; return L.latLngBounds([b[1], b[0]], [b[3], b[2]]); }
function paketFuer(lat, lon) { return OFF.installiert.find(p => p.bbox && lon >= p.bbox[0] && lon <= p.bbox[2] && lat >= p.bbox[1] && lat <= p.bbox[3]); }
function hoehenQuelle(p) {
  if (!window.GugOffline || !(p.dateien || []).some(d => d.name === 'hoehe.pmtiles')) return null;
  if (!OFF.hoehe[p.id]) OFF.hoehe[p.id] = new window.GugOffline.PMTiles('/_karten_/' + p.id + '/hoehe.pmtiles');
  return OFF.hoehe[p.id];
}

// ---------- Höhendaten lesen ----------
const demSpeicher = new Map();   // zuletzt gelesene Kacheln: Schlüssel → Promise<{g, h}|null>
function demRoh(p, z, x, y) {
  const k = p.id + '/' + z + '/' + x + '/' + y;
  if (demSpeicher.has(k)) { const v = demSpeicher.get(k); demSpeicher.delete(k); demSpeicher.set(k, v); return v; }
  const v = (async () => {
    const q = hoehenQuelle(p);
    if (!q) return null;
    const r = await q.getZxy(z, x, y);
    if (!r || !r.data) return null;
    // ohne Farbumrechnung, sonst verfälscht der Browser die Höhenwerte
    const bild = await createImageBitmap(new Blob([r.data], { type: 'image/png' }), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const cv = document.createElement('canvas');
    cv.width = bild.width; cv.height = bild.height;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(bild, 0, 0);
    return { g: bild.width, h: R.terrariumGitter(g.getImageData(0, 0, bild.width, bild.height).data) };
  })().catch(() => null);
  demSpeicher.set(k, v);
  if (demSpeicher.size > 96) demSpeicher.delete(demSpeicher.keys().next().value);
  return v;
}

// Höhengitter mit 1 Pixel Rand (258×258) für eine Kartenkachel; über der höchsten Stufe des Pakets hochgerechnet
async function demGitter(p, z, x, y) {
  const s = Math.min(z, p.hoehe_maxzoom || 12);
  if (z - s > 8) return null;
  const quellen = R.randKacheln(x, y, z, s);
  const geladen = {};
  await Promise.all(quellen.map(async ([tx, ty]) => {
    const r = await demRoh(p, s, tx, ty);
    if (r && r.g === 256) geladen[tx + ',' + ty] = r.h;
  }));
  if (!geladen[Math.floor(x / Math.pow(2, z - s)) + ',' + Math.floor(y / Math.pow(2, z - s))]) return null;
  return R.randGitter((tx, ty) => geladen[tx + ',' + ty] || null, x, y, z, s);
}

// Höhe eines Punkts aus dem Paket (bilinear), null wenn kein Paket ihn abdeckt
async function hoeheOffline(lat, lon) {
  const p = paketFuer(lat, lon);
  if (!p) return null;
  const z = p.hoehe_maxzoom || 12, kp = R.kachelPixel(lat, lon, z);
  const r = await demRoh(p, z, kp.x, kp.y);
  if (!r) return null;
  const f = r.g / 256, sx = Math.max(0, Math.min(r.g - 1, kp.px * f - 0.5)), sy = Math.max(0, Math.min(r.g - 1, kp.py * f - 0.5));
  const x0 = Math.floor(sx), y0 = Math.floor(sy), x1 = Math.min(r.g - 1, x0 + 1), y1 = Math.min(r.g - 1, y0 + 1), tx = sx - x0, ty = sy - y0;
  const v = (a, b) => r.h[b * r.g + a];
  return (v(x0, y0) * (1 - tx) + v(x1, y0) * tx) * (1 - ty) + (v(x0, y1) * (1 - tx) + v(x1, y1) * tx) * ty;
}

// fehlende Höhen aus dem Paket füllen (vor der Anfrage an Open-Meteo, in 10-dienste.js)
async function hoehenOffline(pts) {
  if (OFF.bereit) await OFF.bereit;   // beim Start: erst wissen, welche Pakete auf dem Handy liegen
  if (!OFF.installiert.length) return;
  for (const p of pts) {
    if (p.ele != null) continue;
    const h = await hoeheOffline(p.lat, p.lon);
    if (h != null && isFinite(h)) p.ele = h;
  }
}

// ---------- Routen ohne Netz (BRouter in der App, Routendaten aus dem Kartenpaket) ----------
const RoutingNativ = NATIV ? window.Capacitor.registerPlugin('Routing') : null;

function routenKachelnDa() {
  const k = new Set();
  for (const p of OFF.installiert) for (const d of p.dateien || []) if (d.kachel) k.add(d.kachel);
  return k;
}

// Teilstück a → b offline rechnen; null, wenn dafür keine Routendaten auf dem Handy liegen (dann fragt die App online).
// Schlägt die Rechnung offline fehl, wird online versucht, sofern Netz da ist; sonst kommt die Fehlermeldung von BRouter.
async function routeOffline(a, b, profil) {
  if (!RoutingNativ) return null;
  if (OFF.bereit) await OFF.bereit;
  const da = routenKachelnDa();
  if (!da.has(R.routenKachel(a.lon, a.lat)) || !da.has(R.routenKachel(b.lon, b.lat))) return null;
  try {
    const r = await RoutingNativ.route({ punkte: [[a.lon, a.lat], [b.lon, b.lat]], profil });
    const s = R.brouterLesen(JSON.parse(r.geojson));
    if (s.pts.some(x => x.ele == null)) await hoehenFuellen(s.pts);
    return Object.assign(s, { quelle: 'brouter', offline: true });
  } catch (e) {
    if (navigator.onLine) return null;
    throw new Error((e && e.message) || String(e));
  }
}

// ---------- Orte und Suche ohne Netz (orte.json.gz, gebaut von karten/orte.py) ----------
const orteSpeicher = {};   // Paket-ID und Prüfsumme der Datei → Promise der gelesenen Datei

function mitOrten() { return OFF.installiert.filter(p => (p.dateien || []).some(d => d.name === 'orte.json.gz')); }

function orteLaden(p) {
  // mit Prüfsumme: ein aktualisiertes Paket mit gleichem Datenstand liest die neue Datei
  const d = (p.dateien || []).find(f => f.name === 'orte.json.gz'), k = p.id + ':' + ((d && d.sha256) || '');
  if (!orteSpeicher[k]) {
    orteSpeicher[k] = (async () => {
      const r = await fetch('/_karten_/' + p.id + '/orte.json.gz');
      if (!r.ok || !r.body || typeof DecompressionStream !== 'function') throw new Error('Orte-Datei nicht lesbar');
      return JSON.parse(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text());
    })();
    orteSpeicher[k].catch(() => { delete orteSpeicher[k]; });
  }
  return orteSpeicher[k];
}

// Pakete mit Orten für ein Suchgebiet: alle, die es schneiden. Deckt die Pakete das Gebiet nicht ganz ab (Rand einer
// Region), fragt die App mit Netz online (null); ohne Netz antwortet sie mit dem, was die Pakete haben.
// stellen: Punkte, deren Umgebung (radius Meter) abgedeckt sein muss
async function ortePakete(stellen, radius) {
  if (OFF.bereit) await OFF.bereit;
  const ps = mitOrten().filter(p => p.bbox);
  if (!ps.length) return null;
  const r = R.streckenRahmen(stellen, radius);
  const schneidet = ps.filter(p => p.bbox[0] <= r[3] && p.bbox[2] >= r[1] && p.bbox[1] <= r[2] && p.bbox[3] >= r[0]);
  if (!schneidet.length) return null;
  const drin = q => schneidet.some(p => q.lon >= p.bbox[0] && q.lon <= p.bbox[2] && q.lat >= p.bbox[1] && q.lat <= p.bbox[3]);
  const ganz = R.ausduennen(stellen, 250).every(q => {
    const e = R.streckenRahmen([q], radius);
    return [[e[0], e[1]], [e[0], e[3]], [e[2], e[1]], [e[2], e[3]]].every(([lat, lon]) => drin({ lat, lon }));
  });
  return ganz || navigator.onLine === false ? schneidet : null;
}

// Orte entlang der Strecke aus dem Paket, im Format der Overpass-Antwort; null ohne passendes Paket
async function orteOffline(pts, radius) {
  const ps = await ortePakete(pts, radius);
  if (!ps) return null;
  try {
    const els = [];
    for (const p of ps) els.push(...R.orteUmkreis((await orteLaden(p)).orte, pts, radius, 1500 - els.length).elements);
    return { elements: els, offline: true };
  } catch (e) { return null; }
}

// Sehenswürdigkeiten im Ausschnitt [süd, west, nord, ost] aus dem Paket; null, wenn kein Paket die Mitte abdeckt
async function stadtOffline(bbox) {
  const ps = await ortePakete([{ lat: bbox[0], lon: bbox[1] }, { lat: bbox[2], lon: bbox[3] }, { lat: bbox[0], lon: bbox[3] }, { lat: bbox[2], lon: bbox[1] }], 0);
  if (!ps) return null;
  try {
    const els = [];
    for (const p of ps) els.push(...R.orteAusschnitt((await orteLaden(p)).orte, bbox, 2000 - els.length).elements);
    return { elements: els, offline: true };
  } catch (e) { return null; }
}

// Suche in allen Paketen mit Orten; [] ohne Paket
async function sucheOfflineAlle(text, nahe) {
  if (OFF.bereit) await OFF.bereit;
  const listen = [];
  for (const p of mitOrten()) { try { listen.push(...(await orteLaden(p)).suche); } catch (e) { /* Datei fehlt: online */ } }
  return listen.length ? R.sucheOffline(listen, text, nahe, 7) : [];
}

// ---------- Relief und Höhenlinien als Kartenebene ----------
const Relief = L.GridLayer.extend({
  createTile(c, fertig) {
    const kachel = document.createElement('canvas');
    kachel.width = kachel.height = 256;
    reliefZeichnen(kachel, c).then(() => fertig(null, kachel), e => fertig(e, kachel));
    return kachel;
  }
});

async function reliefZeichnen(kachel, c) {
  const n = Math.pow(2, c.z);
  const lonW = c.x / n * 360 - 180, lonO = (c.x + 1) / n * 360 - 180;
  const breite = t => Math.atan(Math.sinh(Math.PI * (1 - 2 * t / n))) / RAD_GRAD;
  const latN = breite(c.y), latS = breite(c.y + 1);
  const p = OFF.installiert.find(q => q.bbox && lonO >= q.bbox[0] && lonW <= q.bbox[2] && latN >= q.bbox[1] && latS <= q.bbox[3]);
  if (!p) return;
  const h = await demGitter(p, c.z, c.x, c.y);
  if (!h) return;
  const g = kachel.getContext('2d');
  // Schummerung: Schatten dunkel, Sonnenseiten leicht aufgehellt. Über der Auflösung der Höhendaten wird in der
  // Originalauflösung schattiert und das Ergebnis weich vergrößert; sonst entstehen Klötzchen (die Neigung eines
  // hochgerechneten Gitters ist je Datenzelle konstant).
  const sz = Math.min(c.z, p.hoehe_maxzoom || 12), dz = c.z - sz;
  let s;
  if (dz === 0) {
    const s258 = R.schummerung(h, 258, 258, R.meterJePixel(c.z, (latN + latS) / 2), c.z < 11 ? 3 : 1.6);
    s = new Float32Array(65536);
    for (let j = 0; j < 256; j++) s.set(s258.subarray((j + 1) * 258 + 1, (j + 1) * 258 + 257), j * 256);
  } else {
    const px = c.x >> dz, py = c.y >> dz;
    const eltern = await demGitter(p, sz, px, py);
    if (!eltern) return;
    const s258 = R.schummerung(eltern, 258, 258, R.meterJePixel(sz, (latN + latS) / 2), 1.6);
    const teil = 256 / Math.pow(2, dz);
    s = R.aufziehen(s258, 258, 1 + (c.x - (px << dz)) * teil, 1 + (c.y - (py << dz)) * teil, teil, 256);
  }
  const bild = g.createImageData(256, 256);
  for (let i = 0; i < s.length; i++) {
    const schatten = Math.max(0, 0.72 - s[i]) * 0.9, licht = Math.max(0, s[i] - 0.86) * 0.9;
    const a = Math.min(0.6, schatten + licht);
    const hell = licht > schatten ? 255 : 30;
    bild.data[4 * i] = hell; bild.data[4 * i + 1] = hell; bild.data[4 * i + 2] = hell + (hell < 100 ? 10 : 0);
    bild.data[4 * i + 3] = Math.round(a * 255);
  }
  g.putImageData(bild, 0, 0);
  // Höhenlinien ab Zoomstufe 11, jede fünfte als dickere Zähllinie, ab 13 mit Höhenangabe
  if (c.z < 11) return;
  const [abstand, zaehl] = R.linienAbstand(c.z);
  // auf dem Gitter mit Rand gerechnet, um 1 Pixel zurückverschoben: Linien laufen über Kachelgrenzen weiter
  const striche = R.hoehenlinien(h, 258, 258, abstand).map(st => [st[0] - 1, st[1] - 1, st[2] - 1, st[3] - 1, st[4]]);
  const pfad = (dick) => {
    g.beginPath();
    for (const st of striche) {
      if ((st[4] % (abstand * zaehl) === 0) !== dick) continue;
      g.moveTo(st[0] + 0.5, st[1] + 0.5); g.lineTo(st[2] + 0.5, st[3] + 0.5);
    }
    g.strokeStyle = 'rgba(140,90,40,' + (dick ? 0.75 : 0.5) + ')';
    g.lineWidth = dick ? 1.3 : 0.7;
    g.stroke();
  };
  pfad(false); pfad(true);
  if (c.z >= 13) {
    g.font = '600 10px sans-serif'; g.fillStyle = 'rgba(120,75,30,0.9)'; g.textAlign = 'center';
    const gesehen = new Set();
    for (const st of striche) {
      if (st[4] % (abstand * zaehl) !== 0 || gesehen.has(st[4])) continue;
      const mx = (st[0] + st[2]) / 2, my = (st[1] + st[3]) / 2;
      if (mx < 20 || mx > 236 || my < 12 || my > 244) continue;
      gesehen.add(st[4]);
      g.save(); g.translate(mx, my); g.rotate(R.lesbarerWinkel(Math.atan2(st[3] - st[1], st[2] - st[0])));
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3; g.strokeText(st[4], 0, 3); g.fillText(st[4], 0, 3);
      g.restore();
    }
  }
}
const RAD_GRAD = Math.PI / 180;

// ---------- Ebenen aufbauen, wenn sich die installierten Pakete ändern ----------
function offlineEbenen() {
  for (const k of ['offline', 'relief']) if (LAGEN[k]) { LAGEN[k].remove(); delete LAGEN[k]; }
  OFF.hoehe = {};
  demSpeicher.clear();
  for (const k in orteSpeicher) delete orteSpeicher[k];
  const da = OFF.installiert.length > 0;
  document.querySelectorAll('.nur-offline').forEach(e => { e.hidden = !da; });
  if (da && window.GugOffline) {
    const hinweis = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-Mitwirkende</a>, <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a>';
    LAGEN.offline = L.layerGroup(OFF.installiert.filter(p => (p.dateien || []).some(d => d.name === 'karte.pmtiles')).map(p =>
      window.GugOffline.leafletLayer({
        url: '/_karten_/' + p.id + '/karte.pmtiles', flavor: 'light', lang: 'de', maxDataZoom: p.maxzoom || 15,
        bounds: paketGrenzen(p), attribution: hinweis, maxZoom: 19
      })));
    LAGEN.relief = new Relief({ maxZoom: 19, zIndex: 2, attribution: 'Höhen: Mapzen Terrain Tiles (SRTM, EU-DEM u. a.)' });
  }
  lagenAnwenden();
}

// ohne Netz: auf die Offline-Karte wechseln, wenn ein Paket die Kartenmitte abdeckt
function ohneNetzUmschalten() {
  if (navigator.onLine !== false) return;
  const c = karte.getCenter();
  if (LAGEN.offline && lagenWahl.basis !== 'offline' && paketFuer(c.lat, c.lng)) {
    lagenWahl.basis = 'offline'; lagenWahl.relief = true; lagenAnwenden();
    melde('Kein Netz: Offline-Karte eingeschaltet.');
  }
}

// ---------- Paketverwaltung (Reiter Touren) ----------
const Karten = NATIV ? window.Capacitor.registerPlugin('Karten') : null;

async function paketeLaden(mitListe) {
  if (!Karten) return;
  try {
    const r = await Karten.liste({ index: mitListe ? PAKET_INDEX : null });
    const vorher = OFF.installiert.map(p => p.id + p.stand).join();
    OFF.installiert = r.installiert || [];
    if (r.verfuegbar) OFF.verfuegbar = r.verfuegbar;
    OFF.frei = r.frei;
    if (r.fehler) $('paketStatus').textContent = r.fehler;
    if (vorher !== OFF.installiert.map(p => p.id + p.stand).join()) offlineEbenen();
    // letztes Paket gelöscht: gespeicherte Wahl „Offline-Karte“ zurück auf topografisch
    if (!OFF.installiert.length && lagenWahl.basis === 'offline') { lagenWahl.basis = 'topo'; lagenAnwenden(); }
    ohneNetzUmschalten();
    paketListe();
  } catch (e) {
    $('paketStatus').textContent = 'Kartenpakete nicht lesbar: ' + (e.message || e);
  }
}

// neuere Daten: späterer Stand oder andere Dateien (Prüfsummen), z. B. Routendaten bei gleichem Kartenstand ergänzt
function neuerAls(neu, da) {
  if (!neu || !da) return false;
  if (neu.stand && da.stand && neu.stand > da.stand) return true;
  const sig = p => (p.dateien || []).map(d => d.name + ':' + (d.sha256 || '')).sort().join('|');
  return sig(neu) !== sig(da);
}

function mb(b) { return b ? (b / 1048576 >= 1024 ? (b / 1073741824).toFixed(1).replace('.', ',') + ' GB' : Math.round(b / 1048576) + ' MB') : '–'; }

function paketListe() {
  const ul = $('paketliste');
  ul.innerHTML = '';
  const angebot = (OFF.verfuegbar && OFF.verfuegbar.pakete) || [];
  // auch laufende Downloads zeigen (z. B. nach einem Neustart ohne Netz, wenn die Angebotsliste fehlt)
  const ids = [...new Set(angebot.map(p => p.id).concat(OFF.installiert.map(p => p.id), OFF.laufend.map(l => l.id)))];
  if (!ids.length) { ul.innerHTML = '<li style="cursor:default"><span class="was klein">Noch keine Liste geladen. Mit Netz öffnen.</span></li>'; return; }
  for (const id of ids) {
    const neu = angebot.find(p => p.id === id), da = OFF.installiert.find(p => p.id === id), lauf = OFF.laufend.find(l => l.id === id);
    const p = neu || da || { id, name: lauf && lauf.name || id, dateien: [] }, groesse = (p.dateien || []).reduce((s, d) => s + (d.groesse || 0), 0);
    const li = document.createElement('li');
    li.style.cursor = 'default';
    let text = '<b>' + R.esc(p.name || id) + '</b><small>' + mb(groesse) + (p.stand ? ' · Daten vom ' + R.esc(p.stand) : '');
    if (da) text += ' · <b>auf dem Handy</b>' + (neuerAls(neu, da) ? ' · neuere Daten verfügbar' : '');
    text += '</small>';
    if (lauf) {
      const anteil = lauf.gesamt ? lauf.geladen / lauf.gesamt : 0;
      text += '<small>' + ({ laedt: 'lädt …', pruefen: 'wird geprüft …', fehler: 'Fehler' }[lauf.zustand] || lauf.zustand) + ' ' + mb(lauf.geladen) + ' von ' + mb(lauf.gesamt) +
        (lauf.meldung ? ' · ' + R.esc(lauf.meldung) : '') + '</small><div class="paket-balken"><i style="width:' + Math.round(anteil * 100) + '%"></i></div>';
    }
    li.innerHTML = '<span class="zeichen">🗺️</span><span class="was">' + text + '</span><span class="aktionen"></span>';
    const akt = li.querySelector('.aktionen');
    const knopf = (zeichen, titel, f) => { const b = document.createElement('button'); b.textContent = zeichen; b.title = titel; b.onclick = f; akt.appendChild(b); return b; };
    if (neu && (!da || neuerAls(neu, da)) && (!lauf || lauf.zustand === 'fehler')) knopf('⬇', da ? 'Aktualisieren' : 'Herunterladen', () => paketHolen(neu));
    if (da || lauf) {
      const b = knopf('🗑', 'Löschen', () => {
        if (!b.dataset.sicher) { b.dataset.sicher = '1'; b.textContent = '✓?'; b.title = 'Nochmal tippen löscht das Paket'; setTimeout(() => paketListe(), 4000); return; }
        Karten.loeschen({ id }).then(() => { melde('Kartenpaket gelöscht.'); paketeLaden(false); statusFragen(); });
      });
    }
    ul.appendChild(li);
  }
  if (OFF.frei) $('paketStatus').textContent = 'Frei auf dem Handy: ' + mb(OFF.frei) + '.';
}

async function paketHolen(p) {
  try {
    await Karten.laden({ id: p.id, dateien: p.dateien, meta: p, mobil: $('offlineMobil').checked });
    melde('Download gestartet. Er läuft im Hintergrund weiter, auch bei gesperrtem Bildschirm.', 6);
    statusFragen();
  } catch (e) {
    melde(e.message || String(e), 7);
  }
}

// Fortschritt abfragen, solange etwas lädt
async function statusFragen() {
  if (!Karten) return;
  clearTimeout(OFF.uhr);
  try {
    const r = await Karten.status();
    const warLaufend = OFF.laufend.length;
    OFF.laufend = r.laufend || [];
    paketListe();
    if (OFF.laufend.some(l => l.zustand === 'laedt' || l.zustand === 'pruefen')) OFF.uhr = setTimeout(statusFragen, 1500);
    else if (warLaufend && !OFF.laufend.length) paketeLaden(false);
  } catch (e) { /* nächster Versuch beim Öffnen */ }
}

if (Karten) {
  $('offlineBox').hidden = false;
  Karten.addListener('fertig', async () => {
    const erstes = !OFF.installiert.length;
    await paketeLaden(false);
    melde('Kartenpaket fertig: Die Karte geht jetzt auch ohne Netz.', 6);
    if (erstes && LAGEN.offline) { lagenWahl.basis = 'offline'; lagenWahl.relief = true; lagenAnwenden(); }
  });
  window.addEventListener('offline', ohneNetzUmschalten);
  // wieder Netz: Angebotsliste nachladen, falls sie beim Start fehlte
  window.addEventListener('online', () => { if (!OFF.verfuegbar) paketeLaden(true); });
  document.querySelector('nav.reiter [data-reiter=touren]').addEventListener('click', () => { if (!OFF.verfuegbar && navigator.onLine) paketeLaden(true); });
  // erst die Pakete auf dem Handy (schnell, ohne Netz), danach die Angebotsliste aus dem Netz
  OFF.bereit = paketeLaden(false);
  OFF.bereit.then(() => { statusFragen(); return paketeLaden(true); });
}
