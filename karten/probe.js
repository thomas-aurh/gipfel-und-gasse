// Probe-Rendering der gebauten Kartenpakete: lädt die fertige App (web/dist/Gipfel-und-Gasse.html) mit nachgebildeter
// App-Umgebung, schaltet Offline-Karte und Relief ein und prüft an den Stellen aus regionen.json („probe“), dass die
// Vektorkarte wirklich zeichnet (mehrere Farben, nicht nur Hintergrund) und das Relief Inhalt hat. Passen Kartendaten und
// Zeichenstil nicht zusammen, bleibt die Karte leer und dieser Lauf schlägt fehl.
// Aufruf: node karten/probe.js <ausgabeordner mit pakete.json>   (Bildschirmfotos landen im selben Ordner)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ordner = path.resolve(process.argv[2] || 'ausgabe');
const liste = JSON.parse(fs.readFileSync(path.join(ordner, 'pakete.json'), 'utf8'));
// nur die in diesem Lauf gebauten Regionen prüfen (bei einer Einzelregion stehen die anderen nur in der Liste)
const gebautDatei = path.join(ordner, 'gebaut.json');
const gebaut = fs.existsSync(gebautDatei) ? JSON.parse(fs.readFileSync(gebautDatei, 'utf8')) : liste.pakete.map(p => p.id);
const regionen = JSON.parse(fs.readFileSync(path.join(__dirname, 'regionen.json'), 'utf8')).regionen;
const app = path.join(__dirname, '..', 'web', 'dist', 'Gipfel-und-Gasse.html');

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const m = /^\/_karten_\/([a-z0-9-]+)\/([a-z0-9.-]+)$/.exec(p);
  if (!m) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(fs.readFileSync(app)); }
  // die App fragt nach dem Namen im Paket (karte.pmtiles); im Ausgabeordner liegt die Datei unter ihrem festen Namen
  const paket = liste.pakete.find(p => p.id === m[1]);
  const eintrag = paket && (paket.dateien || []).find(d => d.name === m[2]);
  const datei = eintrag ? path.join(ordner, path.basename(eintrag.url)) : path.join(ordner, m[1] + '-' + m[2]);
  if (!fs.existsSync(datei)) { res.writeHead(404); return res.end(); }
  const laenge = fs.statSync(datei).size, t = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
  if (!t) { res.writeHead(200, { 'Content-Length': laenge, 'Accept-Ranges': 'bytes' }); return fs.createReadStream(datei).pipe(res); }
  const von = +t[1], bis = Math.min(laenge - 1, t[2] ? +t[2] : laenge - 1);
  res.writeHead(206, { 'Content-Range': `bytes ${von}-${bis}/${laenge}`, 'Content-Length': bis - von + 1, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(datei, { start: von, end: bis }).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  let fehler = 0;
  for (const paket of liste.pakete.filter(p => gebaut.includes(p.id))) {
    const region = regionen.find(r => r.id === paket.id) || {};
    const stellen = region.probe || [[(paket.bbox[1] + paket.bbox[3]) / 2, (paket.bbox[0] + paket.bbox[2]) / 2, 13]];
    for (const [i, [lat, lon, z]] of stellen.entries()) {
      const ctx = await browser.newContext({ viewport: { width: 1000, height: 760 } });
      // alles aus dem Netz sperren: die Probe darf nur das Paket benutzen
      await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
      await ctx.addInitScript(([paket, lat, lon, z]) => {
        window.Capacitor = {
          isNativePlatform: () => true,
          registerPlugin: name => name === 'Karten'
            ? { liste: async () => ({ installiert: [paket] }), status: async () => ({ laufend: [] }), addListener: () => ({ remove() {} }) }
            : { status: async () => ({}), aufzeichnungHolen: async () => ({ spur: [] }), addListener: () => ({ remove() {} }) }
        };
        localStorage.setItem('gug.blick', JSON.stringify({ lat, lon, z }));
        localStorage.setItem('gug.lagen', JSON.stringify({ basis: 'offline', relief: true, wander: false, rad: false }));
      }, [paket, lat, lon, z]);
      const page = await ctx.newPage();
      const skriptFehler = [];
      page.on('pageerror', e => skriptFehler.push(e.message));
      await page.goto(url);
      await page.waitForTimeout(6000);
      const ergebnis = await page.evaluate(() => {
        const auswerten = cs => {
          const farben = new Set(); let voll = 0, alle = 0;
          for (const c of cs) {
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            for (let k = 0; k < d.length; k += 4 * 53) { alle++; if (d[k + 3] > 0) { voll++; farben.add((d[k] >> 3) + ',' + (d[k + 1] >> 3) + ',' + (d[k + 2] >> 3)); } }
          }
          return { kacheln: cs.length, farben: farben.size, anteil: alle ? voll / alle : 0 };
        };
        const ebenen = [...document.querySelectorAll('.leaflet-tile-pane .leaflet-layer')];
        const relief = ebenen.filter(e => e.style.zIndex === '2'), karte = ebenen.filter(e => e.style.zIndex !== '2');
        return { karte: auswerten(karte.flatMap(e => [...e.querySelectorAll('canvas')])), relief: auswerten(relief.flatMap(e => [...e.querySelectorAll('canvas')])) };
      });
      const bild = path.join(ordner, `probe-${paket.id}-${i + 1}.png`);
      await page.screenshot({ path: bild });
      // Karte voll und bunt, Relief vorhanden und mit sichtbarem Inhalt (leere Höhenkacheln fallen sonst nicht auf)
      const ok = ergebnis.karte.kacheln > 0 && ergebnis.karte.farben >= 4 && ergebnis.karte.anteil > 0.9 &&
        ergebnis.relief.kacheln > 0 && ergebnis.relief.farben >= 10 && ergebnis.relief.anteil > 0.3 && skriptFehler.length === 0;
      console.log((ok ? '✓' : '✗') + ` ${paket.id} @ ${lat},${lon} z${z}: Karte ${JSON.stringify(ergebnis.karte)}, Relief ${JSON.stringify(ergebnis.relief)}` +
        (skriptFehler.length ? ' · Fehler: ' + skriptFehler.join(' | ') : '') + ' → ' + path.basename(bild));
      if (!ok) fehler++;
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
