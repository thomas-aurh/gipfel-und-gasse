// Klicktest im Browser (Playwright + Chromium). Die Dienste (Kacheln, BRouter, Photon, Overpass, Open-Meteo) werden
// hier NACHGEBILDET: Antworten im gleichen Format, aber erfunden. Der Test prüft also den Code von Gipfel & Gasse, nicht die Dienste.
// Aufruf: node test/ui.js   (vorher sh build.sh). Bildschirmfotos landen in test/out/.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist', 'Gipfel-und-Gasse.html');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

// 1×1-PNG, hellgrün, als Kachel
const KACHEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN89+7dfwAJbgPi8QnTiQAAAABJRU5ErkJggg==', 'base64');
const RAD = Math.PI / 180;
function abstand(a, b) {
  const dLat = (b[1] - a[1]) * RAD, dLon = (b[0] - a[0]) * RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(s));
}
const zaehler = { brouter: 0, photon: 0, overpass: 0, wetter: 0, hoehe: 0 };

// BRouter nachbilden: Linie mit leichtem Knick, Höhe als Welle, drei Wegarten
function brouter(url) {
  zaehler.brouter++;
  const ll = new URL(url).searchParams.get('lonlats').split('|').map(s => s.split(',').map(Number));
  const [a, b] = ll;
  const n = 40, coords = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, knick = Math.sin(t * Math.PI) * 0.002;
    const lon = a[0] + (b[0] - a[0]) * t + knick, lat = a[1] + (b[1] - a[1]) * t;
    coords.push([+lon.toFixed(6), +lat.toFixed(6), Math.round(620 + 180 * Math.sin(t * Math.PI) + 15 * Math.sin(t * 20))]);
  }
  const tags = ['highway=residential surface=asphalt', 'highway=track tracktype=grade2', 'highway=path surface=ground sac_scale=mountain_hiking'];
  const kopf = ['Longitude', 'Latitude', 'Elevation', 'Distance', 'CostPerKm', 'ElevCost', 'TurnCost', 'NodeCost', 'InitialCost', 'WayTags', 'NodeTags', 'Time', 'Energy'];
  const msgs = [kopf];
  let seg = 0;
  for (let k = 1; k <= 3; k++) {
    const bis = Math.round(n * k / 3);
    let m = 0;
    for (let i = seg + 1; i <= bis; i++) m += abstand(coords[i - 1], coords[i]);
    const c = coords[bis];
    msgs.push([String(Math.round(c[0] * 1e6)), String(Math.round(c[1] * 1e6)), String(c[2]), String(Math.round(m)), '1000', '0', '0', '0', '0', tags[k - 1], '', '0', '0']);
    seg = bis;
  }
  const voicehints = [[10, 2, 0, 300, -90], [27, 6, 0, 200, 30]];   // links abbiegen, leicht rechts
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { creator: 'BRouter-Nachbildung', messages: msgs, voicehints }, geometry: { type: 'LineString', coordinates: coords } }] };
}

function server() {
  return new Promise(res => {
    const s = http.createServer((req, rsp) => {
      rsp.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      rsp.end(fs.readFileSync(DIST));
    }).listen(0, '127.0.0.1', () => res(s));
  });
}

async function dienste(ctx) {
  await ctx.route(/tile\.opentopomap\.org|tile\.openstreetmap\.org|tile\.waymarkedtrails\.org/, r => r.fulfill({ status: 200, contentType: 'image/png', body: KACHEL }));
  await ctx.route(/brouter\.de\/brouter/, r => {
    const u = r.request().url();
    const ll = new URL(u).searchParams.get('lonlats');
    if (ll.startsWith('0.0')) return r.fulfill({ status: 400, contentType: 'text/plain', body: 'position not mapped in existing datafile' });
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(brouter(u)) });
  });
  await ctx.route(/photon\.komoot\.io/, r => { zaehler.photon++; r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ features: [
    { geometry: { coordinates: [11.2578, 47.6262] }, properties: { name: 'Testgipfel', osm_key: 'natural', osm_value: 'peak', state: 'Bayern', country: 'Deutschland' } },
    { geometry: { coordinates: [11.3747, 47.7535] }, properties: { name: 'Teststadt', osm_key: 'place', osm_value: 'town', state: 'Bayern', country: 'Deutschland', extent: [11.33, 47.78, 11.42, 47.73] } }
  ] }) }); });
  await ctx.route(/overpass-api\.de/, r => {
    zaehler.overpass++;
    const q = decodeURIComponent((r.request().postData() || '').replace(/^data=/, ''));
    const bb = /\[bbox:(-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)\]/.exec(q);
    if (bb) {
      // Stadt: Sehenswürdigkeiten im Ausschnitt, verteilt um die Mitte
      const la = (+bb[1] + +bb[3]) / 2, lo = (+bb[2] + +bb[4]) / 2, dl = (+bb[3] - +bb[1]) / 6, dn = (+bb[4] - +bb[2]) / 6;
      const el = [
        { type: 'way', id: 101, center: { lat: la + dl, lon: lo }, tags: { tourism: 'museum', name: 'Stadtmuseum', wikipedia: 'de:Stadtmuseum', opening_hours: 'Di-So 10-18' } },
        { type: 'node', id: 102, lat: la - dl, lon: lo + dn, tags: { historic: 'castle', name: 'Alte Burg', wikidata: 'Q2' } },
        { type: 'node', id: 103, lat: la, lon: lo - dn, tags: { amenity: 'place_of_worship', name: 'Stadtkirche', wikidata: 'Q3' } },
        { type: 'node', id: 104, lat: la + dl, lon: lo + dn, tags: { tourism: 'viewpoint', name: 'Aussicht Schlossberg' } },
        { type: 'way', id: 105, center: { lat: la - dl, lon: lo - dn }, tags: { leisure: 'park', name: 'Hofgarten' } },
        { type: 'node', id: 106, lat: la + dl / 2, lon: lo + dn / 2, tags: { amenity: 'ice_cream', name: 'Eis-Café' } },
        { type: 'node', id: 107, lat: la - dl / 2, lon: lo, tags: { tourism: 'artwork', name: 'Bronzeschwein' } },
        { type: 'node', id: 108, lat: la, lon: lo + dn / 3, tags: { amenity: 'toilets' } }
      ];
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ elements: el }) });
    }
    const m = /around:\d+,(-?[\d.]+),(-?[\d.]+)/.exec(q);
    const lat = +m[1], lon = +m[2];
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ elements: [
      { type: 'node', id: 11, lat: lat + 0.001, lon: lon + 0.0005, tags: { amenity: 'drinking_water' } },
      { type: 'node', id: 12, lat: lat + 0.004, lon: lon + 0.001, tags: { tourism: 'alpine_hut', name: 'Testhütte', opening_hours: 'Mai–Okt' } },
      { type: 'way', id: 13, center: { lat: lat + 0.002, lon: lon - 0.001 }, tags: { leisure: 'playground' } },
      { type: 'node', id: 14, lat: lat + 0.006, lon: lon, tags: { natural: 'peak', name: 'Testberg', ele: '1234' } }
    ] }) });
  });
  await ctx.route(/api\.open-meteo\.com\/v1\/forecast/, r => { zaehler.wetter++; r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ daily: {
    time: ['2026-11-01', '2026-11-02', '2026-11-03'], weather_code: [1, 61, 95], temperature_2m_max: [14.2, 9.1, 11], temperature_2m_min: [3.1, 4, 2],
    precipitation_probability_max: [5, 80, 60], wind_speed_10m_max: [12, 25, 30], sunset: ['2026-11-01T16:52', '2026-11-02T16:50', '2026-11-03T16:49'] } }) }); });
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r => {
    zaehler.hoehe++;
    const n = new URL(r.request().url()).searchParams.get('latitude').split(',').length;
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ elevation: Array.from({ length: n }, (_, i) => 700 + i * 3) }) });
  });
}

let ok = 0, fehler = 0;
function pruef(name, bed, info) {
  if (bed) { ok++; console.log('✓ ' + name); }
  else { fehler++; console.error('✗ ' + name + (info !== undefined ? ' → ' + JSON.stringify(info) : '')); }
}

(async () => {
  const srv = await server();
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, acceptDownloads: true, permissions: ['geolocation', 'clipboard-read', 'clipboard-write'], geolocation: { latitude: 47.7535, longitude: 11.3747, accuracy: 10 } });
  await dienste(ctx);
  const page = await ctx.newPage();
  const konsole = [];
  page.on('console', m => { if (m.type() === 'error' && !/status of 400/.test(m.text())) konsole.push(m.text()); });  // 400 = absichtlich „kein Weg“
  page.on('pageerror', e => konsole.push(e.message));

  await page.goto(url);
  await page.waitForSelector('#karte .leaflet-tile-loaded', { timeout: 10000 });
  pruef('Seite lädt ohne Fehler', konsole.length === 0, konsole);
  pruef('Hinweis ohne Route sichtbar', await page.isVisible('#leerHinweis'));
  pruef('Logo und Name im Kopf', await page.evaluate(() => !!document.querySelector('#logo svg') && document.querySelector('.marke').textContent.includes('Gipfel & Gasse')));
  pruef('Browser-Symbol gesetzt', await page.evaluate(() => (document.querySelector('link[rel=icon]') || {}).href.startsWith('data:image/svg+xml;base64,')));
  pruef('Kopfzeile nennt den ersten Schritt', (await page.textContent('#kopfZahlen')).includes('Start'));

  // Penzberg in die Mitte, zwei Punkte setzen
  await page.evaluate(() => 0);
  const karte = await page.$('#karte');
  const kb = await karte.boundingBox();
  await page.mouse.click(kb.x + kb.width * 0.4, kb.y + kb.height * 0.45);
  await page.waitForTimeout(300);
  pruef('Startmarke da', (await page.$$('.wp.start')).length === 1);
  await page.mouse.click(kb.x + kb.width * 0.62, kb.y + kb.height * 0.35);
  await page.waitForSelector('#ergebnis:not([hidden])', { timeout: 8000 });
  const laenge = await page.textContent('#zLaenge');
  pruef('Länge berechnet', /km|m$/.test(laenge) && laenge !== '–', laenge);
  pruef('Schwierigkeit T2 aus sac_scale', (await page.textContent('#zSchwer')) === 'T2');
  pruef('Aufstieg gezählt', /\d+ m/.test(await page.textContent('#zAuf')));
  pruef('Kinderwagen: eher nicht', (await page.textContent('#kinderwagen')).includes('eher nicht'));
  pruef('Wegtypen: drei Einträge', (await page.$$('#wege .eintrag')).length === 3);
  pruef('Kopfzeile mit Zahlen', (await page.textContent('#kopfZahlen')).includes('km'));
  await page.screenshot({ path: path.join(OUT, '1-route.png') });

  // Profil zeigen
  const pb = await (await page.$('#profil')).boundingBox();
  await page.mouse.move(pb.x + pb.width * 0.5, pb.y + pb.height * 0.5);
  pruef('Profil zeigt Stelle', (await page.textContent('#profilinfo')).includes('Höhe'));
  // Hervorheben
  await page.click('#wege .eintrag >> nth=0');
  pruef('Hervorhebung auf der Karte', await page.evaluate(() => document.querySelectorAll('.leaflet-overlay-pane path').length) >= 4);
  await page.screenshot({ path: path.join(OUT, '2-hervorheben.png') });

  // dritter Punkt, dann rückgängig
  await page.mouse.click(kb.x + kb.width * 0.75, kb.y + kb.height * 0.6);
  await page.waitForFunction(() => document.querySelectorAll('.wp').length === 3);
  const l3 = await page.textContent('#zLaenge');
  await page.click('#bZurueck');
  await page.waitForFunction(() => document.querySelectorAll('.wp').length === 2);
  pruef('Rückgängig', (await page.textContent('#zLaenge')) === laenge, [l3, laenge]);
  const vorher = zaehler.brouter;
  await page.click('#bZurueck'); await page.click('#bZurueck');  // bis leer und wieder…
  await page.keyboard.press('Control+z');
  // Rundtour
  while ((await page.$$('.wp')).length < 2) { await page.mouse.click(kb.x + kb.width * (0.4 + Math.random() * 0.2), kb.y + kb.height * 0.45); await page.waitForTimeout(200); }
  await page.waitForSelector('#ergebnis:not([hidden])');
  await page.click('#bRund');
  await page.waitForFunction(() => document.querySelectorAll('.wp').length === 3);
  pruef('Rundtour: drei Punkte, letzter am Start', await page.evaluate(() => document.querySelector('.wp.ziel') !== null));
  pruef('Speicher der Teilstücke wirkt', zaehler.brouter - vorher <= 3, zaehler.brouter - vorher);
  // Rundtour: Start ziehen zieht das Ziel mit
  const s0 = await (await page.$('.wp.start')).boundingBox();
  await page.mouse.move(s0.x + 13, s0.y + 13); await page.mouse.down();
  await page.mouse.move(s0.x + 60, s0.y + 50, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(400);
  const lagen = await page.evaluate(() => [...document.querySelectorAll('.wp')].map(w => { const r = w.parentNode.getBoundingClientRect(); return [w.className, Math.round(r.x), Math.round(r.y)]; }));
  const st = lagen.find(x => x[0].includes('start')), zi = lagen.find(x => x[0].includes('ziel'));
  pruef('Rundtour: Ziel wandert mit dem Start', Math.abs(st[1] - zi[1]) < 40 && Math.abs(st[2] - zi[2]) < 40, lagen);

  // Name, speichern
  await page.fill('#tourname', 'Testrunde am See');
  await page.click('#bSpeichern');
  await page.click('[data-reiter=touren]');
  pruef('Tour in der Liste', (await page.textContent('#tourliste')).includes('Testrunde am See'));

  // GPX herunterladen und prüfen
  await page.click('[data-reiter=planen]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bGpx')]);
  const gpxPfad = path.join(OUT, 'test.gpx');
  await dl.saveAs(gpxPfad);
  const gpx = fs.readFileSync(gpxPfad, 'utf8');
  pruef('GPX-Datei', dl.suggestedFilename() === 'Testrunde-am-See.gpx' && (gpx.match(/<trkpt/g) || []).length > 50 && gpx.includes('<ele>'), dl.suggestedFilename());

  // Neu laden: Entwurf kommt wieder, ohne neue Routenanfragen
  const vorLaden = zaehler.brouter;
  await page.reload();
  await page.waitForSelector('#ergebnis:not([hidden])', { timeout: 8000 });
  pruef('Nach Neuladen wieder da', (await page.inputValue('#tourname')) === 'Testrunde am See' && (await page.$$('.wp')).length === 3);
  pruef('Neuladen ohne neue Anfragen', zaehler.brouter === vorLaden, zaehler.brouter - vorLaden);

  // Tempo „mit Kind“ macht die Zeit länger
  const z1 = await page.textContent('#zZeit');
  await page.selectOption('#tempowahl', '0.7');
  const z2 = await page.textContent('#zZeit');
  pruef('Tempo mit Kind', z1 !== z2, [z1, z2]);

  // Entdecken: Wetter und Orte
  await page.click('[data-reiter=entdecken]');
  await page.waitForSelector('#wetter .wetter');
  pruef('Wetter mit Gewitterwarnung', (await page.textContent('#wetter')).includes('Gewitter angesagt'));
  await page.click('#bOrte');
  await page.waitForSelector('#ortliste li');
  const orteText = await page.textContent('#ortliste');
  pruef('Orte entlang der Route', orteText.includes('Testhütte') && orteText.includes('Testberg (1234 m)'), orteText);
  pruef('Ortsmarken auf der Karte', (await page.$$('.ort-mk')).length >= 3);
  await page.click('#chips button >> nth=0');
  pruef('Kategorie ausblenden', (await page.$$('#chips button.aus')).length >= 1);
  await page.screenshot({ path: path.join(OUT, '3-entdecken.png') });

  // Suche
  await page.fill('#suchfeld', 'Testg');
  await page.waitForSelector('#treffer button');
  pruef('Suchtreffer', (await page.textContent('#treffer')).includes('Testgipfel'));
  await page.click('#treffer button >> nth=0');
  await page.waitForTimeout(400);
  pruef('Treffer zeigt Popup', (await page.textContent('.leaflet-popup-content')).includes('Testgipfel'));
  await page.click('.leaflet-popup-close-button');
  await page.waitForTimeout(450);

  // Gerade Linie: Höhen von Open-Meteo
  await page.click('[data-reiter=planen]');
  await page.click('#bNeu');
  await page.selectOption('#profilwahl', 'linie');
  await page.mouse.click(kb.x + kb.width * 0.3, kb.y + kb.height * 0.3);
  await page.waitForTimeout(250);
  await page.mouse.click(kb.x + kb.width * 0.7, kb.y + kb.height * 0.7);
  await page.waitForSelector('#ergebnis:not([hidden])');
  await page.waitForFunction(() => document.querySelector('#zHoch').textContent !== '–');
  pruef('Gerade Linie mit Höhen', zaehler.hoehe > 0 && (await page.textContent('#zHoch')).includes('m'));
  pruef('Gerade Linie gestrichelt', await page.evaluate(() => [...document.querySelectorAll('.leaflet-overlay-pane path')].some(p => p.getAttribute('stroke-dasharray'))));

  // GPX öffnen
  await page.click('[data-reiter=touren]');
  await page.setInputFiles('#gpxDatei', gpxPfad);
  await page.waitForFunction(() => document.querySelector('#tourname').value === 'Testrunde am See' && document.querySelector('[data-reiter=planen]').classList.contains('an'));
  pruef('GPX geöffnet als Spur', (await page.textContent('#status')).includes('Geöffnete Spur'));
  pruef('Rückgängig bei geöffneter Spur gesperrt', await page.isDisabled('#bZurueck'));
  // GPX bei geöffneter Tour: Speichern legt eine neue Tour an und ersetzt die alte nicht
  const vorImport = (await page.$$('#tourliste li')).length;
  await page.click('#bSpeichern');
  await page.click('[data-reiter=touren]');
  pruef('Import ersetzt keine geöffnete Tour', (await page.$$('#tourliste li')).length === vorImport + 1, [vorImport, (await page.$$('#tourliste li')).length]);
  pruef('Tour öffnen ist ein Knopf', (await page.$$('#tourliste button.oeffnen')).length >= 2);
  const fehlerDatei = path.join(OUT, 'kaputt.gpx');
  fs.writeFileSync(fehlerDatei, '<gpx></gpx>');
  await page.click('[data-reiter=touren]');
  await page.setInputFiles('#gpxDatei', fehlerDatei);
  await page.waitForTimeout(200);
  pruef('Kaputtes GPX meldet Fehler', (await page.textContent('#meldung')).includes('GPX nicht lesbar'));

  // Teilen-Link öffnen (die geplante Tour, nicht die importierte Spur)
  await page.click('#tourliste li:has-text("🥾") >> nth=0');
  await page.waitForSelector('#ergebnis:not([hidden])');
  await page.selectOption('#profilwahl', 'wandern');
  await page.waitForTimeout(500);
  await page.click('#bTeilen');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  pruef('Link kopiert', /#tour-wandern-/.test(link), link);
  const p2 = await ctx.newPage();
  await p2.goto(link);
  await p2.waitForSelector('#ergebnis:not([hidden])', { timeout: 8000 });
  pruef('Link öffnet die Tour', (await p2.$$('.wp')).length === 3 && !(await p2.url()).includes('#'));
  await p2.close();

  // ungespeicherte Planung: Neuladen ohne neue Anfragen, geteilter Link verdrängt sie nicht spurlos
  await page.click('#bNeu');
  await page.mouse.click(kb.x + kb.width * 0.35, kb.y + kb.height * 0.5);
  await page.waitForTimeout(250);
  await page.mouse.click(kb.x + kb.width * 0.5, kb.y + kb.height * 0.55);
  await page.waitForSelector('#ergebnis:not([hidden])');
  await page.waitForTimeout(200);
  const vorEnt = zaehler.brouter;
  await page.reload();
  await page.waitForSelector('#ergebnis:not([hidden])');
  pruef('Entwurf ohne neue Anfragen geladen', zaehler.brouter === vorEnt && (await page.$$('.wp')).length === 2, zaehler.brouter - vorEnt);
  await page.evaluate(() => { location.hash = '#tour-wandern-47.70000_11.30000~47.71000_11.31000~47.72000_11.30000'; });
  await page.waitForFunction(() => document.querySelectorAll('.wp').length === 3);
  await page.click('#bZurueck');
  await page.waitForFunction(() => document.querySelectorAll('.wp').length === 2);
  pruef('Rückgängig holt die Planung vor dem Link zurück', true);

  // Abschnitt ohne Weg: Fallback gerade Linie mit Meldung
  await page.click('#bNeu');
  await page.evaluate(() => { location.hash = '#tour-wandern-0.0_0.0~0.01_0.01'; });
  await page.waitForSelector('#status .fehler', { timeout: 8000 });
  pruef('Kein Weg → Meldung', (await page.textContent('#status')).includes('nicht an einem Weg'));

  // Unterwegs: Route folgen mit GPS
  await page.click('#bNeu');
  await page.evaluate(() => { location.hash = '#tour-wandern-47.75350_11.37470~47.77000_11.40000'; });
  await page.waitForSelector('#ergebnis:not([hidden])');
  await page.click('[data-reiter=unterwegs]');
  await page.click('#bNavi');
  await page.waitForFunction(() => document.querySelector('#uRest').textContent !== '–', null, { timeout: 8000 });
  const rest1 = await page.textContent('#uRest');
  await ctx.setGeolocation({ latitude: 47.7618, longitude: 11.3893, accuracy: 8 });
  await page.waitForFunction(r => document.querySelector('#uRest').textContent !== r, rest1, { timeout: 8000 });
  const rest2 = await page.textContent('#uRest');
  pruef('Rest wird kürzer', parseFloat(rest2.replace(',', '.')) < parseFloat(rest1.replace(',', '.')), [rest1, rest2]);
  await page.click('#bAufz');
  for (let i = 1; i <= 4; i++) { await ctx.setGeolocation({ latitude: 47.7618 + i * 0.0006, longitude: 11.3893 + i * 0.0006, accuracy: 6 }); await page.waitForTimeout(250); }
  await page.click('#bAufz');
  pruef('Aufzeichnung gemessen', (await page.textContent('#aStrecke')) !== '–' && !(await page.isDisabled('#bAufzSpeichern')), await page.textContent('#aStrecke'));
  await page.screenshot({ path: path.join(OUT, '4-unterwegs.png') });
  await page.click('#bAufzSpeichern');
  await page.waitForTimeout(300);
  pruef('Route bleibt beim Speichern der Aufzeichnung', (await page.textContent('#bNavi')).includes('beenden') && (await page.$$('.wp')).length === 2);
  await page.click('#bNavi');
  await page.click('[data-reiter=touren]');
  pruef('Aufzeichnung als Tour', (await page.textContent('#tourliste')).includes('Aufzeichnung'));

  // ---------- Stadt ----------
  await page.click('[data-reiter=planen]');
  await page.click('#bNeu');
  await page.click('.modus [data-modus=stadt]');
  pruef('Stadtmodus: Stadtplan, Sehenswürdigkeiten, Stadtspaziergang', await page.evaluate(() =>
    document.querySelector('input[name=basis][value=osm]').checked && document.querySelector('#lageSehens').checked && document.querySelector('#profilwahl').value === 'stadt'));
  await page.fill('#suchfeld', 'Testg');
  await page.waitForSelector('#treffer button');
  await page.click('#treffer button >> nth=0');
  await page.click('.leaflet-popup-close-button');
  await page.waitForSelector('.ort-mk.bekannt', { timeout: 8000 });
  pruef('Sehenswürdigkeiten auf der Karte, bekannte hervorgehoben', (await page.$$('.ort-mk.bekannt')).length === 3 && (await page.$$('.ort-mk')).length === 7, (await page.$$('.ort-mk')).length);
  await page.screenshot({ path: path.join(OUT, '8-stadt-karte.png') });
  await page.click('[data-reiter=entdecken]');
  pruef('Stadt-Liste im Entdecken', (await page.textContent('#stadtListe')).includes('⭐ Stadtmuseum') && !(await page.isVisible('#bergBox')));
  await page.click('#stadtListe li >> nth=0 >> button');
  pruef('Stopp aus der Liste', (await page.$$('.wp')).length === 1 && (await page.textContent('#meldung')).includes('Start'));
  await page.click('#bRundgang');
  await page.waitForSelector('#ergebnis:not([hidden])', { timeout: 8000 });
  await page.waitForTimeout(300);
  const nWp = (await page.$$('.wp')).length;
  pruef('Rundgang vorgeschlagen', nWp >= 5, nWp);
  const namen = await page.$$eval('.wp-name', l => l.map(x => x.textContent));
  pruef('Start kommt im Rundgang nicht doppelt vor', new Set(namen).size === namen.length, namen);
  pruef('Stopps mit Besichtigungszeit', (await page.$$('#stopps select')).length >= 4 && (await page.textContent('#zZeitText')).includes('Besichtigung'), await page.textContent('#zZeitText'));
  pruef('Namen an den Punkten', (await page.$$('.wp-name')).length >= 4);
  const zA = await page.textContent('#zZeit');
  await page.selectOption('#stopps select >> nth=1', '180');
  pruef('Besichtigungszeit ändert die Gesamtzeit', (await page.textContent('#zZeit')) !== zA, [zA, await page.textContent('#zZeit')]);
  pruef('Reihenfolge-Knopf sichtbar', await page.isVisible('#bOrdnen'));
  await page.screenshot({ path: path.join(OUT, '9-stadt-rundgang.png') });
  // speichern und wieder öffnen: Namen und Minuten bleiben
  await page.fill('#tourname', 'Altstadt-Runde');
  await page.click('#bSpeichern');
  await page.click('#bNeu');
  await page.click('[data-reiter=touren]');
  pruef('Stadttour mit Symbol', (await page.textContent('#tourliste')).includes('🏛️'));
  await page.click('#tourliste li >> nth=0');
  await page.waitForSelector('#ergebnis:not([hidden])');
  pruef('Tempo der Tour wiederhergestellt', (await page.inputValue('#tempowahl')) === '0.7');
  pruef('Gespeicherte Stopps mit Namen und Zeiten', (await page.$$('.wp-name')).length >= 4 && (await page.inputValue('#stopps select >> nth=1')) === '180');
  // Drucken: Druckdialog abfangen, die Rückkehr nach 500 ms aufhalten und die Seite als echtes PDF drucken
  await page.evaluate(() => {
    window.print = () => { window.__gedruckt = true; };
    const st = window.setTimeout;
    window.setTimeout = (f, ms, ...a) => ms === 500 && window.__gedruckt ? 0 : st(f, ms, ...a);
  });
  await page.click('[data-reiter=planen]');
  await page.click('#bDrucken');
  await page.waitForFunction(() => window.__gedruckt, null, { timeout: 8000 });
  const druck = await page.evaluate(() => ({ klasse: document.body.classList.contains('druck'), kopf: document.querySelector('#druckkopf').textContent, profil: !!document.querySelector('#druckfuss img') }));
  const pdf = await page.pdf({ path: path.join(OUT, '10-druck.pdf'), format: 'A4', printBackground: true });
  pruef('Druckansicht mit Kopf, Stopps und Profil', druck.klasse && druck.kopf.includes('Altstadt-Runde') && druck.kopf.includes('Stopps:') && druck.profil, druck);
  pruef('PDF hat genau eine Seite', (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length === 1);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  pruef('Nach dem Drucken wieder normal', !(await page.evaluate(() => document.body.classList.contains('druck'))));
  await page.click('.modus [data-modus=berg]');
  pruef('Zurück in Berg: topografisch, Wanderwege', await page.evaluate(() => document.querySelector('input[name=basis][value=topo]').checked && document.querySelector('#lageWander').checked && !document.querySelector('#lageSehens').checked));

  // Löschen mit Rückfrage
  await page.click('[data-reiter=touren]');
  const vorL = (await page.$$('#tourliste li')).length;
  await page.click('#tourliste li >> nth=0 >> button[title=Löschen]');
  await page.click('#tourliste li >> nth=0 >> button[title=Löschen]');
  pruef('Löschen nach zweitem Tipp', (await page.$$('#tourliste li')).length === vorL - 1);

  pruef('Keine Skriptfehler im ganzen Lauf', konsole.length === 0, konsole);

  // Touren aus dem früheren Namen „Murmel“ werden übernommen
  const alt = await browser.newContext();
  await dienste(alt);
  await alt.addInitScript(() => {
    if (!localStorage.getItem('gug.uebernommen')) localStorage.setItem('murmel.touren', JSON.stringify([{ id: 'talt', name: 'Alte Murmel-Tour', datum: '2026-11-01T10:00:00Z', profil: 'wandern', wps: null, spur: [[47.75, 11.37, 600], [47.76, 11.38, 650]], stuecke: null, art: 'spur', kurz: { laenge: 1300, auf: 50, ab: 0, zeit: 0.4 } }]));
  });
  const pa = await alt.newPage();
  await pa.goto(url);
  await pa.click('[data-reiter=touren]');
  pruef('Alte Touren übernommen', (await pa.textContent('#tourliste')).includes('Alte Murmel-Tour'));
  await alt.close();

  // ---------- Android-App: Oberfläche mit nachgebildetem Navi-Plugin ----------
  const bruecke = require('./bruecke');
  const appCtx = await browser.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true });
  await dienste(appCtx);
  await appCtx.addInitScript(bruecke.mit(() => {
    const aufrufe = [];
    let hoerer = null;
    window.__navi = { aufrufe, melden: st => hoerer && hoerer(st) };
    window.__bruecke({
      Karten: { liste: async () => ({ installiert: [] }), status: async () => ({ laufend: [] }), addListener: () => {} },
      Navi: {
        starten: async o => { aufrufe.push(['starten', o]); return { laeuft: o.folgen || o.aufzeichnen, folgen: !!o.folgen, aufzeichnen: !!o.aufzeichnen }; },
        status: async () => ({ laeuft: false, folgen: false, aufzeichnen: false }),
        aufzeichnungHolen: async o => { aufrufe.push(['aufzeichnungHolen', o]); return { start: Date.now() - 600000, spur: [[47.75, 11.37, 600, Date.now() - 600000], [47.751, 11.371, 610, Date.now() - 300000], [47.752, 11.372, null, Date.now()]] }; },
        teilen: async o => { aufrufe.push(['teilen', { name: o.name, laenge: o.text.length, gpx: o.text.startsWith('<?xml') }]); },
        drucken: async o => { aufrufe.push(['drucken', { name: o.name, druck: document.body.classList.contains('druck') }]); },
        addListener: (n, f) => { if (n === 'position') hoerer = f; }
      }
    });
  }));
  const pa2 = await appCtx.newPage();
  const appFehler = [];
  pa2.on('pageerror', e => appFehler.push(e.message));
  await pa2.goto(url + '#tour-wandern-47.75350_11.37470~47.77000_11.40000');
  await pa2.waitForSelector('#ergebnis:not([hidden])');
  pruef('App: Hinweis für gesperrten Bildschirm', (await pa2.textContent('#unterwegsHinweis')).includes('gesperrtem Bildschirm'));
  await pa2.click('[data-reiter=unterwegs]');
  await pa2.click('#bNavi');
  await pa2.waitForTimeout(200);
  const a1 = await pa2.evaluate(() => window.__navi.aufrufe);
  const st1 = a1.find(x => x[0] === 'starten');
  pruef('App: Route folgen schickt Route an den Dienst', st1 && st1[1].folgen === true && st1[1].pts.length > 10 && Array.isArray(st1[1].pts[0]) && st1[1].ansagen === true, st1 && Object.keys(st1[1]));
  pruef('App: Knopf zeigt „Folgen beenden“', (await pa2.textContent('#bNavi')).includes('beenden'));
  pruef('App: Route mit Abschnitts-Merker (4 Werte je Punkt)', st1[1].pts[0].length === 4 && st1[1].pts[0][3] === 0);
  pruef('App: „Link teilen“ ausgeblendet', await pa2.isHidden('#bTeilen'));
  await pa2.evaluate(() => window.__navi.melden({ laeuft: true, folgen: true, aufzeichnen: false, lat: 47.76, lon: 11.385, gen: 6, t: Date.now(), rest: { meter: 2345, auf: 120, stunden: 0.9 }, abw: 72, abseits: true }));
  pruef('App: Meldung des Dienstes angezeigt', (await pa2.textContent('#uRest')) === '2,3 km' && (await pa2.textContent('#uAuf')) === '120 m' && !(await pa2.isHidden('#abseits')));
  // Aufzeichnung über „Beenden“ in der Mitteilung gestoppt: Speichern wird frei, Dauer bis zum Ende
  await pa2.click('#bAufz');
  const t0 = Date.now();
  await pa2.evaluate(t => window.__navi.melden({ laeuft: true, folgen: false, aufzeichnen: true, aufz: { meter: 800, start: t - 1800000, punkte: 40, auf: 30 } }), t0);
  await pa2.evaluate(t => window.__navi.melden({ laeuft: false, folgen: false, aufzeichnen: false, aufz: { meter: 820, start: t - 1800000, ende: t - 600000, punkte: 41, auf: 30 } }), t0);
  pruef('App: nach „Beenden“ in der Mitteilung speicherbar', !(await pa2.isDisabled('#bAufzSpeichern')));
  pruef('App: Dauer bis zum Ende der Aufzeichnung', (await pa2.textContent('#aDauer')) === '20 min', await pa2.textContent('#aDauer'));
  await pa2.click('#bAufzSpeichern');
  await pa2.waitForTimeout(400);
  // beim Start fragt die App einmal nach einer liegengebliebenen Aufzeichnung; beim Speichern holt sie und leert danach
  const a2 = (await pa2.evaluate(() => window.__navi.aufrufe)).filter(x => x[0] === 'aufzeichnungHolen');
  pruef('App: Aufzeichnung geholt und danach geleert', a2.length >= 2 && a2[a2.length - 1][1].leeren === true && a2[a2.length - 2][1].leeren === false, a2);
  await pa2.click('[data-reiter=touren]');
  pruef('App: Aufzeichnung als Tour', (await pa2.textContent('#tourliste')).includes('Aufzeichnung'));
  await pa2.click('[data-reiter=planen]');
  await pa2.click('#bGpx');
  await pa2.waitForTimeout(200);
  const teilen = (await pa2.evaluate(() => window.__navi.aufrufe)).find(x => x[0] === 'teilen');
  pruef('App: GPX über das Teilen-Menü', teilen && teilen[1].gpx && teilen[1].name.endsWith('.gpx'), teilen);
  await pa2.click('#bDrucken');
  await pa2.waitForFunction(() => window.__navi.aufrufe.some(x => x[0] === 'drucken'), null, { timeout: 8000 });
  await pa2.waitForTimeout(300);
  const druckA = (await pa2.evaluate(() => window.__navi.aufrufe)).find(x => x[0] === 'drucken');
  pruef('App: Drucken über Android im Druckzustand, danach zurück', druckA[1].druck === true && !(await pa2.evaluate(() => document.body.classList.contains('druck'))));
  pruef('App: keine Skriptfehler', appFehler.length === 0, appFehler);
  await appCtx.close();

  // ---------- Offline-Karten in der App: Pakete aus test/testkarten.py, Dateien mit echten Byte-Bereichen ----------
  const kartenOrdner = path.join(__dirname, 'out', 'karten');
  if (!fs.existsSync(path.join(kartenOrdner, 'probe', 'orte.json.gz'))) require('child_process').execFileSync('python3', [path.join(__dirname, 'testkarten.py')]);
  const offCtx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  await dienste(offCtx);
  const bereiche = [];
  await offCtx.route(/\/_karten_\//, r => {
    const m = /\/_karten_\/([a-z0-9-]+)\/([a-z0-9.-]+)$/.exec(new URL(r.request().url()).pathname);
    const f = m && path.join(kartenOrdner, m[1], m[2]);
    if (!f || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    const daten = fs.readFileSync(f), range = r.request().headers()['range'];
    const t = range && /bytes=(\d+)-(\d*)/.exec(range);
    if (!t) return r.fulfill({ status: 200, body: daten, headers: { 'Accept-Ranges': 'bytes' } });
    const von = +t[1], bis = Math.min(daten.length - 1, t[2] ? +t[2] : daten.length - 1);
    bereiche.push(m[2] + ':' + von + '-' + bis);
    r.fulfill({ status: 206, body: daten.subarray(von, bis + 1), headers: { 'Content-Range': 'bytes ' + von + '-' + bis + '/' + daten.length, 'Accept-Ranges': 'bytes' } });
  });
  // kein Netz für Höhen: die gerade Linie muss ihre Höhen aus dem Paket holen
  await offCtx.route(/api\.open-meteo\.com\/v1\/elevation/, r => r.fulfill({ status: 503, body: 'kein Netz' }));
  await offCtx.addInitScript(bruecke.mit(() => {
    const paket = { id: 'probe', name: 'Probegebiet', bbox: [11.30, 47.55, 11.40, 47.62], maxzoom: 14, hoehe_maxzoom: 12, stand: '2026-10-31',
      dateien: [{ name: 'karte.pmtiles', groesse: 538 }, { name: 'hoehe.pmtiles', groesse: 281086 }, { name: 'routing-e10-n45.rd5', kachel: 'E10_N45', groesse: 1000 }, { name: 'orte.json.gz', groesse: 400 }] };
    window.__routing = []; window.__naviStart = [];
    window.__bruecke({
      Karten: {
        liste: async () => ({ installiert: [paket], verfuegbar: { pakete: [Object.assign({}, paket, { stand: '2026-11-30' })] }, frei: 5e9 }),
        status: async () => ({ laufend: [] }), laden: async () => {}, loeschen: async () => {}, addListener: () => {}
      },
      Routing: {
        // Offline-Engine: antwortet wie BRouter (Nachbildung aus dem Test), ohne Netz
        route: async o => { window.__routing.push(o); return { geojson: await window.brouterNach(o.punkte.map(p => p.join(',')).join('|')) }; }
      },
      Navi: {
        starten: async o => { window.__naviStart.push(o); return { laeuft: true, folgen: !!o.folgen }; }, status: async () => ({ laeuft: false }), aufzeichnungHolen: async () => ({ spur: [] }),
        teilen: async () => {}, drucken: async () => {}, addListener: () => {}
      }
    });
    localStorage.setItem('gug.blick', JSON.stringify({ lat: 47.585, lon: 11.35, z: 13 }));
  }));
  // die Offline-Nachbildung nutzt dieselbe Routenerzeugung, zählt aber nicht als Anfrage an brouter.de
  await offCtx.exposeFunction('brouterNach', ll => { const j = brouter('https://brouter.de/brouter?lonlats=' + ll); zaehler.brouter--; return JSON.stringify(j); });
  const po = await offCtx.newPage();
  const offFehler = [];
  po.on('pageerror', e => offFehler.push(e.message));
  await po.goto(url);
  await po.waitForFunction(() => !document.querySelector('.nur-offline').hidden, null, { timeout: 8000 });
  pruef('Offline: Auswahl erscheint mit installiertem Paket', true);
  await po.click('[data-reiter=touren]');
  pruef('Offline: Paket in der Liste, neuere Daten gemeldet', (await po.textContent('#paketliste')).includes('auf dem Handy') && (await po.textContent('#paketliste')).includes('neuere Daten'));
  await po.click('#bLagen');
  await po.check('input[name=basis][value=offline]');
  await po.check('#lageRelief');
  await po.click('#bLagen');
  await po.waitForTimeout(2500);
  // Vektorkarte: Kacheln von protomaps-leaflet sind Canvas mit Inhalt; Relief ebenso
  // Vektorkarte und Relief getrennt: beide müssen sichtbaren Inhalt haben
  const gezeichnet = await po.evaluate(() => {
    const voll = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) n++; return n; };
    const ebenen = [...document.querySelectorAll('.leaflet-tile-pane .leaflet-layer')];
    const zaehlen = es => es.flatMap(e => [...e.querySelectorAll('canvas')]).map(voll);
    return { relief: zaehlen(ebenen.filter(e => e.style.zIndex === '2')), karte: zaehlen(ebenen.filter(e => e.style.zIndex !== '2')) };
  });
  pruef('Offline: Vektorkarte zeichnet', gezeichnet.karte.filter(n => n > 10).length >= 4, gezeichnet.karte);
  pruef('Offline: Relief zeichnet', gezeichnet.relief.filter(n => n > 10).length >= 4, gezeichnet.relief);
  pruef('Offline: Dateien mit Byte-Bereichen gelesen', bereiche.some(b => b.startsWith('karte.pmtiles')) && bereiche.some(b => b.startsWith('hoehe.pmtiles')), bereiche.slice(0, 4));
  await po.screenshot({ path: path.join(OUT, '11-offline-relief.png') });
  // gerade Linie über den Berg: Höhen aus dem Paket (Gipfel 1800 m)
  await po.click('[data-reiter=planen]');
  await po.selectOption('#profilwahl', 'linie');
  const kb2 = await (await po.$('#karte')).boundingBox();
  await po.mouse.click(kb2.x + kb2.width * 0.3, kb2.y + kb2.height * 0.5);
  await po.waitForTimeout(300);
  await po.mouse.click(kb2.x + kb2.width * 0.7, kb2.y + kb2.height * 0.5);
  await po.waitForSelector('#ergebnis:not([hidden])');
  await po.waitForFunction(() => document.querySelector('#zHoch').textContent !== '–', null, { timeout: 8000 });
  const hoch = parseInt(await po.textContent('#zHoch'), 10);
  pruef('Offline: Höhen der geraden Linie aus dem Paket', hoch > 1700 && hoch < 1810, hoch);
  await po.screenshot({ path: path.join(OUT, '12-offline-linie.png') });
  // Route offline: BRouter in der App, brouter.de wird nicht gefragt; Abbiegehinweise gehen an den Navigationsdienst
  await po.click('#bNeu');
  await po.selectOption('#profilwahl', 'wandern');
  const vorOnline = zaehler.brouter;
  await po.mouse.click(kb2.x + kb2.width * 0.35, kb2.y + kb2.height * 0.45);
  await po.waitForTimeout(300);
  await po.mouse.click(kb2.x + kb2.width * 0.65, kb2.y + kb2.height * 0.55);
  await po.waitForSelector('#ergebnis:not([hidden])');
  await po.waitForTimeout(300);
  const routing = await po.evaluate(() => window.__routing);
  pruef('Offline-Routing: Engine in der App gefragt, nicht brouter.de', routing.length === 1 && routing[0].profil === 'hiking-mountain' && zaehler.brouter === vorOnline, [routing.length, zaehler.brouter - vorOnline]);
  pruef('Offline-Routing: Wegtypen aus den Routendaten', (await po.textContent('#wege')).includes('Pfad'));
  await po.click('[data-reiter=unterwegs]');
  await po.click('#bNavi');
  await po.waitForTimeout(300);
  const naviStart = await po.evaluate(() => window.__naviStart);
  const hw = naviStart.length ? naviStart[naviStart.length - 1].hinweise : null;
  pruef('Abbiegehinweise an den Navigationsdienst', hw && hw.length === 2 && hw[0][1] === 2 && hw[1][1] === 6 && hw[0][0] < hw[1][0], hw);
  // Orte entlang der Route aus dem Paket: Overpass wird nicht gefragt
  await po.click('[data-reiter=entdecken]');
  const vorOverpass = zaehler.overpass;
  await po.click('#bOrte');
  await po.waitForFunction(() => /Orte|Keine/.test(document.querySelector('#orteStatus').textContent) && !document.querySelector('#bOrte').disabled, null, { timeout: 8000 });
  const offOrteText = await po.textContent('#ortliste');
  pruef('Offline-Orte: aus dem Kartenpaket, ohne Overpass', zaehler.overpass === vorOverpass && (await po.textContent('#orteStatus')).includes('Aus dem Kartenpaket') &&
    offOrteText.includes('Probehütte') && offOrteText.includes('Probegipfel (1800 m)') && !offOrteText.includes('Probemuseum'), [zaehler.overpass - vorOverpass, await po.textContent('#orteStatus'), offOrteText]);
  // Suche: Treffer aus dem Paket zusammen mit den Online-Treffern
  await po.fill('#suchfeld', 'Probeg');
  await po.waitForFunction(() => document.querySelector('#treffer').textContent.includes('Probegipfel'), null, { timeout: 8000 });
  pruef('Offline-Suche: Treffer aus dem Paket neben den Online-Treffern', (await po.textContent('#treffer')).includes('Gipfel'));
  // ohne Netz: nur das Paket, Photon wird nicht gefragt
  await po.evaluate(() => { Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }); });
  const vorPhoton = zaehler.photon;
  await po.fill('#suchfeld', 'probehutte');
  await po.waitForFunction(() => document.querySelector('#treffer').textContent.includes('Probehütte'), null, { timeout: 8000 });
  pruef('Offline-Suche ohne Netz: Paket allein, Schreibweise egal', zaehler.photon === vorPhoton && (await po.textContent('#treffer')).includes('Berghütte · Probedorf'),
    [zaehler.photon - vorPhoton, await po.textContent('#treffer')]);
  await po.evaluate(() => { delete navigator.onLine; });
  pruef('Offline: keine Skriptfehler', offFehler.length === 0, offFehler);
  await offCtx.close();

  // Telefon
  const tel = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await dienste(tel);
  const pt = await tel.newPage();
  const telFehler = [];
  pt.on('pageerror', e => telFehler.push(e.message));
  await pt.goto(url + '#tour-wandern-47.75350_11.37470~47.77000_11.40000~47.75350_11.37470');
  await pt.waitForSelector('#ergebnis:not([hidden])');
  await pt.waitForTimeout(500);
  await pt.screenshot({ path: path.join(OUT, '5-telefon.png') });
  await pt.tap('#griff');
  await pt.waitForTimeout(400);
  pruef('Telefon: Blatt groß', await pt.evaluate(() => document.querySelector('#panel').classList.contains('gross')));
  await pt.screenshot({ path: path.join(OUT, '6-telefon-gross.png') });
  await pt.tap('#griff');
  await pt.waitForTimeout(400);
  await pt.screenshot({ path: path.join(OUT, '7-telefon-klein.png') });
  pruef('Telefon: keine Fehler', telFehler.length === 0, telFehler);

  await browser.close();
  srv.close();
  console.log('Klicktest: ' + ok + ' bestanden, ' + fehler + ' fehlgeschlagen · Anfragen ' + JSON.stringify(zaehler));
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
