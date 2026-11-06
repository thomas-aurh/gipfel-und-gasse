// Probe der Orte-Dateien mit den echten Daten: Suche und Orte entlang einer Strecke mit denselben Rechnungen wie die App.
// Aufruf: node karten/orte-probe.js <ausgabeordner>   (nach karten/bauen.py; prüft nur Regionen aus gebaut.json)
// Schlägt fehl, wenn bekannte Orte nicht gefunden werden oder an der falschen Stelle liegen.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const R = require('../web/src/00-rechnen.js');

const aus = process.argv[2];
if (!aus) { console.error('Aufruf: node karten/orte-probe.js <ausgabeordner>'); process.exit(2); }

// je Region: Suchbegriffe mit erwarteter Lage (erster Treffer höchstens `km` entfernt), Strecken mit erwarteten Arten
const PROBEN = {
  oberbayern: {
    suche: [
      ['Zugspitze', 47.4211, 10.9853, 2], ['Marienplatz', 48.1374, 11.5755, 1], ['Penzberg', 47.7535, 11.3747, 2],
      ['Herzogstand', 47.6122, 11.3117, 1], ['Frauenkirche', 48.1386, 11.5736, 1], ['Kochelsee', 47.6450, 11.3500, 5]
    ],
    // Herzogstandbahn (Bergstation) → Herzogstandhaus → Gipfel; München Altstadt mit Museen
    strecke: { pts: [[47.6176, 11.3194], [47.6150, 11.3140], [47.6122, 11.3117]], radius: 500, kat: ['gipfel', 'huette'] },
    stadt: { bbox: [48.130, 11.565, 48.145, 11.590], mindestens: 30, kat: ['museum', 'sehens'] },
    // MTB-Trails mit mtb:scale zwischen Kochelsee, Herzogstand und Walchensee
    trails: { bbox: [47.55, 11.25, 47.70, 11.45], mindestens: 5 },
    // beschilderte Wanderrouten in 5 km um Kochel am See (Tourvorschläge ohne Netz)
    routen: { mitte: [47.6587, 11.3672], radius: 5000, mindestens: 5 }
  },
  'allgaeu-bodensee': {
    suche: [
      ['Lindau', 47.5460, 9.6840, 3], ['Nebelhorn', 47.4219, 10.3417, 1.5], ['Neuschwanstein', 47.5576, 10.7498, 1],
      ['Kempten', 47.7267, 10.3139, 3], ['Bregenz', 47.5031, 9.7471, 3]
    ],
    // Lindauer Insel: Hafen, Altstadt
    stadt: { bbox: [47.540, 9.675, 47.552, 9.695], mindestens: 10, kat: ['sehens'] }
  }
};

const gebaut = JSON.parse(fs.readFileSync(path.join(aus, 'gebaut.json'), 'utf8'));
const liste = JSON.parse(fs.readFileSync(path.join(aus, 'pakete.json'), 'utf8'));
let fehler = 0;
const pruef = (ok, text) => { console.log((ok ? '✓ ' : '✗ ') + text); if (!ok) fehler++; };

for (const p of liste.pakete) {
  if (!gebaut.includes(p.id)) continue;
  const d = (p.dateien || []).find(f => f.name === 'orte.json.gz');
  if (!d) continue;
  const datei = path.join(aus, path.basename(d.url));
  const t0 = Date.now();
  const j = JSON.parse(zlib.gunzipSync(fs.readFileSync(datei)).toString('utf8'));
  const routen = j.routen || [], routenPunkte = routen.reduce((summe, r) => summe + r[6].reduce((m, f) => m + f.length / 2, 0), 0);
  console.log(p.id + ': ' + routen.length + ' beschilderte Routen (' + routen.filter(r => r[1] === 'w').length + ' Wandern, ' + routen.filter(r => r[1] === 'm').length + ' MTB, ' + routenPunkte + ' Punkte)');
  const trails = j.trails || [], trailPunkte = trails.reduce((summe, t) => summe + t[2].length / 2, 0);
  console.log(p.id + ': ' + j.orte.length + ' Orte, ' + j.suche.length + ' Suchbegriffe, ' + trails.length + ' MTB-Trails (' + trailPunkte + ' Punkte), ' + (fs.statSync(datei).size / 1048576).toFixed(1) +
    ' MB gepackt, gelesen in ' + (Date.now() - t0) + ' ms');
  const pr = PROBEN[p.id];
  if (!pr) { pruef(j.orte.length > 0 && j.suche.length > 0, p.id + ': Datei nicht leer (keine Proben hinterlegt)'); continue; }
  for (const [q, lat, lon, km] of pr.suche) {
    const t = Date.now();
    const r = R.sucheOffline(j.suche, q, { lat: 47.9, lng: 11.4 });
    const e = r[0] && R.abstand(r[0], { lat, lon }) / 1000;
    pruef(r.length && e <= km, 'Suche „' + q + '“: ' + (r[0] ? r[0].name + ' (' + r[0].wo + '), ' + e.toFixed(1) + ' km von der erwarteten Stelle' : 'nichts') +
      ', ' + (Date.now() - t) + ' ms');
  }
  if (pr.strecke) {
  const pts = pr.strecke.pts.map(([lat, lon]) => ({ lat, lon }));
  const orte = R.orteLesen(R.orteUmkreis(j.orte, pts, pr.strecke.radius), pts.length > 1 ? (() => {
    let d0 = 0; return pts.map((q, i) => { if (i) d0 += R.abstand(pts[i - 1], q); return Object.assign({ d: d0 }, q); });
  })() : null);
  const kats = new Set(orte.map(o => o.kat));
  pruef(pr.strecke.kat.every(k => kats.has(k)), 'Orte entlang der Strecke: ' + orte.length + ' (' + [...kats].join(', ') + ')');
  }
  if (pr.routen) {
    const t = Date.now(), alle = R.routenEntpacken(routen);
    const w = R.wegeAusPaket(alle, { lat: pr.routen.mitte[0], lon: pr.routen.mitte[1] }, pr.routen.radius, 'wandern');
    pruef(w.length >= pr.routen.mindestens, 'Wanderrouten im Umkreis: ' + w.length + ' (z. B. ' + w.slice(0, 3).map(x => x.name + ' ' + x.km + ' km').join(', ') + '), ' + (Date.now() - t) + ' ms');
  }
  if (pr.trails) {
    const im = R.trailsImAusschnitt(R.trailsEntpacken(trails), pr.trails.bbox);
    const stufen = [0, 1, 2, 3, 4, 5, 6].map(s => im.filter(t => t.s === s).length).join('/');
    pruef(im.length >= pr.trails.mindestens, 'MTB-Trails im Ausschnitt: ' + im.length + ' (S0–S6: ' + stufen + ')');
  }
  const stadt = R.stadtLesen(R.orteAusschnitt(j.orte, pr.stadt.bbox));
  const skats = new Set(stadt.map(o => o.kat));
  pruef(stadt.length >= pr.stadt.mindestens && pr.stadt.kat.every(k => skats.has(k)),
    'Sehenswürdigkeiten im Ausschnitt: ' + stadt.length + ', bekannte: ' + stadt.filter(o => o.bekannt).length + ' (' + [...skats].join(', ') + ')');
}
process.exit(fehler ? 1 : 0);
