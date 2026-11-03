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
  await ctx.route(/photon\.komoot\.io\/reverse/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ features: [{ geometry: { coordinates: [11.3747, 47.7535] }, properties: { name: 'Stadtplatz', city: 'Teststadt' } }] }) }));
  await ctx.route(/photon\.komoot\.io\/api/, r => { zaehler.photon++; r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ features: [
    { geometry: { coordinates: [11.2578, 47.6262] }, properties: { name: 'Testgipfel', osm_key: 'natural', osm_value: 'peak', state: 'Bayern', country: 'Deutschland' } },
    { geometry: { coordinates: [11.3747, 47.7535] }, properties: { name: 'Teststadt', osm_key: 'place', osm_value: 'town', state: 'Bayern', country: 'Deutschland', extent: [11.33, 47.78, 11.42, 47.73] } }
  ] }) }); });
  await ctx.route(/wikipedia\.org\/api\/rest_v1\/page\/summary\//, r => {
    zaehler.wiki = (zaehler.wiki || 0) + 1;
    const titel = decodeURIComponent(r.request().url().split('/summary/')[1]).replace(/_/g, ' ');
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ type: 'standard', title: titel,
      extract: 'Das ' + titel + ' ist ein Ort zum Testen.', thumbnail: { source: 'https://upload.wikimedia.org/test/klein.png' }, content_urls: { mobile: { page: 'https://de.m.wikipedia.org/wiki/' + encodeURIComponent(titel) } } }) });
  });
  await ctx.route(/upload\.wikimedia\.org/, r => r.fulfill({ status: 200, contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') }));
  await ctx.route(/wikidata\.org\/w\/api\.php/, r => {
    const id = /ids=(Q\d+)/.exec(r.request().url())[1];
    const sl = { Q2: { dewiki: { title: 'Alte Burg (Teststadt)' } }, Q4: { enwiki: { title: 'Test hut' } } }[id] || {};
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ entities: { [id]: { sitelinks: sl } } }) });
  });
  await ctx.route(/overpass-api\.de/, r => {
    zaehler.overpass++;
    const q = decodeURIComponent((r.request().postData() || '').replace(/^data=/, ''));
    const bb = /\[bbox:(-?[\d.]+),(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)\]/.exec(q);
    if (bb) {
      // Stadt: Sehenswürdigkeiten im Ausschnitt, verteilt um die Mitte
      // um den Testgipfel an festen Stellen (sonst hinge die Lage am zuletzt geladenen Ausschnitt), anderswo um die Mitte
      const amGipfel = +bb[1] < 47.6262 && +bb[3] > 47.6262 && +bb[2] < 11.2578 && +bb[4] > 11.2578;
      const la = amGipfel ? 47.6262 : (+bb[1] + +bb[3]) / 2, lo = amGipfel ? 11.2578 : (+bb[2] + +bb[4]) / 2;
      const dl = amGipfel ? 0.0012 : (+bb[3] - +bb[1]) / 6, dn = amGipfel ? 0.0018 : (+bb[4] - +bb[2]) / 6;
      const el = [
        { type: 'way', id: 101, center: { lat: la + dl, lon: lo }, tags: { tourism: 'museum', name: 'Stadtmuseum', wikipedia: 'de:Stadtmuseum', opening_hours: 'Mo-Su 00:00-24:00' } },
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
    if (q.includes('[!"highway"]')) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ elements: [
      { type: 'way', id: 41, center: { lat: lat + 0.0001, lon }, tags: { name: 'Schloss Test', historic: 'castle', wikidata: 'Q2', opening_hours: 'Mo-Su 00:00-24:00', fee: 'yes' } },
      { type: 'node', id: 42, lat: lat - 0.0001, lon: lon + 0.0001, tags: { name: 'Bäckerei Test', shop: 'bakery' } }
    ] }) });
    if (q.includes('planetarium')) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ elements: [
      { type: 'node', id: 31, lat: lat + 0.01, lon, tags: { tourism: 'museum', name: 'Heimatmuseum', opening_hours: 'Mo-Su 00:00-24:00', wikipedia: 'de:Heimatmuseum' } },
      { type: 'way', id: 32, center: { lat: lat + 0.002, lon }, tags: { leisure: 'sports_centre', sport: 'swimming', name: 'Hallenbad Test' } },
      { type: 'node', id: 33, lat, lon, tags: { amenity: 'cinema' } }
    ] }) });
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ elements: [
      { type: 'node', id: 11, lat: lat + 0.001, lon: lon + 0.0005, tags: { amenity: 'drinking_water' } },
      { type: 'node', id: 12, lat: lat + 0.004, lon: lon + 0.001, tags: { tourism: 'alpine_hut', name: 'Testhütte', opening_hours: 'Mai–Okt', wikidata: 'Q4' } },
      { type: 'way', id: 13, center: { lat: lat + 0.002, lon: lon - 0.001 }, tags: { leisure: 'playground' } },
      { type: 'node', id: 14, lat: lat + 0.006, lon: lon, tags: { natural: 'peak', name: 'Testberg', ele: '1234' } }
    ] }) });
  });
  await ctx.route(/api\.open-meteo\.com\/v1\/forecast.*current=/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ current: { time: '2026-11-02T12:00', temperature_2m: 18.4, weather_code: 1 } }) }));
  await ctx.route(/api\.open-meteo\.com\/v1\/forecast(?!.*current=)/, r => { zaehler.wetter++; r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ elevation: 612, daily: {
    time: ['2026-11-01', '2026-11-02', '2026-11-03'], weather_code: [1, 61, 95], temperature_2m_max: [14.2, 9.1, 11], temperature_2m_min: [3.1, 4, 2],
    precipitation_probability_max: [5, 80, 60], wind_speed_10m_max: [12, 25, 30], sunset: ['2026-11-01T16:52', '2026-11-02T16:50', '2026-11-03T16:49'] } }) }); });
  await ctx.route(/api\.open-meteo\.com\/v1\/elevation/, r => {
    zaehler.hoehe++;
    const n = new URL(r.request().url()).searchParams.get('latitude').split(',').length;
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ elevation: Array.from({ length: n }, (_, i) => 700 + i * 3) }) });
  });
}

let ok = 0, fehler = 0;
// Seite über das Menü links oben öffnen (wie ein Nutzer: ☰ antippen, Eintrag wählen)
// Karte, Planen, Unterwegs und Touren stehen in der Leiste (Gegangen über den Umschalter unter Touren), der Rest im Menü
async function zuSeite(seite, ziel) {
  if (['karte', 'planen', 'unterwegs', 'touren', 'gegangen'].includes(ziel)) {
    await seite.click('#leiste [data-reiter=' + (ziel === 'gegangen' ? 'touren' : ziel) + ']');
    if (ziel === 'gegangen') await seite.click('section[data-reiter=touren] .umschalter [data-ziel=gegangen]');
    return;
  }
  await seite.click('#bMenue'); await seite.click('#menue [data-ziel=' + ziel + ']');
}
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
  page.on('pageerror', e => { konsole.push(e.message); if (process.env.STAPEL) console.log('STAPEL', e.stack); });

  await page.goto(url);
  await page.waitForSelector('#karte .leaflet-tile-loaded', { timeout: 10000 });
  pruef('Seite lädt ohne Fehler', konsole.length === 0, konsole);
  pruef('Hinweis ohne Route sichtbar', await page.isVisible('#leerHinweis'));
  // Menü: Fokus im Menü, Rest nicht bedienbar, danach Fokus zurück; „Karte“ schaltet alle Seiten aus
  await page.click('#bMenue');
  pruef('Menü: Fokus im Menü, Hintergrund gesperrt', await page.evaluate(() => document.querySelector('#menue').contains(document.activeElement) && document.querySelector('#panel').inert && document.querySelector('#oben').inert));
  pruef('Menü ohne Dopplung zur Leiste', await page.evaluate(() => { const m = [...document.querySelectorAll('#menue [data-ziel]')].map(b => b.dataset.ziel);
    return m.length > 0 && !m.some(z => ['karte', 'planen', 'unterwegs', 'touren', 'gegangen'].includes(z)); }));
  await page.keyboard.press('Escape');
  pruef('Menü zu: Fokus zurück am Menü-Knopf, nichts gesperrt', await page.evaluate(() => document.activeElement.id === 'bMenue' && !document.querySelector('#panel').inert));
  // Darstellung: automatisch → hell → dunkel, gespeichert; Farben aus den Variablen
  await page.click('#bMenue'); await page.click('#bThema'); await page.click('#bThema');
  pruef('Dunkelmodus über das Menü, gespeichert', await page.evaluate(() => document.documentElement.dataset.thema === 'dunkel' &&
    JSON.parse(localStorage.getItem('gug.thema')) === 'dunkel' && getComputedStyle(document.body).backgroundColor === 'rgb(17, 21, 23)'));
  await page.click('#bThema');
  // Speicher gesperrt: Umschalten folgt trotzdem der laufenden Wahl
  await page.evaluate(() => { window.__setItem = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('voll'); }; });
  await page.click('#bThema'); await page.click('#bThema');
  pruef('Umschalten auch bei gesperrtem Speicher', await page.evaluate(() => document.documentElement.dataset.thema === 'dunkel'), await page.evaluate(() => [document.documentElement.dataset.thema, document.querySelector('#bThema').textContent, localStorage.getItem('gug.thema')]));
  await page.click('#bThema');
  await page.evaluate(() => { Storage.prototype.setItem = window.__setItem; });
  pruef('Darstellung zurück auf automatisch', await page.evaluate(() => !document.documentElement.dataset.thema) && (await page.textContent('#bThema')).includes('automatisch'));
  await page.keyboard.press('Escape');
  await page.click('[data-reiter=karte]');
  pruef('Karte: keine Seite mehr aktiv (nichts per Tastatur erreichbar)', await page.evaluate(() => !document.querySelector('.inhalt>section.an') && document.body.classList.contains('ohneBlatt')));
  await page.click('[data-reiter=planen]');
  pruef('Logo und Seitentitel im Kopf, Name im Menü', await page.evaluate(() => !!document.querySelector('#logo svg') && document.querySelector('.marke').textContent.includes('Tour planen') &&
    document.querySelector('.menue-kopf').textContent.includes('Gipfel & Gasse')));
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

  // Profil zeigen (ins Bild scrollen: es liegt im Blatt unter Zeitplan und Kennzahlen)
  await page.$eval('#profil', e => e.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(150);
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
  // Fadenkreuz: Tipp setzt nichts, holt die Stelle unter das Kreuz; „Punkt hier“ setzt genau dort
  await page.click('#bKreuz');
  pruef('Fadenkreuz mit Koordinaten und Abstand', await page.isVisible('#kreuz') && /^\d+\.\d{5}, \d+\.\d{5} · /.test(await page.textContent('#kreuzText')));
  await page.mouse.click(kb.x + kb.width * 0.85, kb.y + kb.height * 0.8);
  await page.waitForTimeout(600);
  pruef('Fadenkreuz: Tipp setzt keinen Punkt', (await page.$$('.wp')).length === 2);
  const kreuzMitte = async () => page.evaluate(() => { const r = document.querySelector('#kreuz').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const [kx, ky] = await kreuzMitte();
  await page.click('#bKreuzSetzen');
  await page.waitForFunction(() => document.querySelectorAll('.wp').length === 3);
  const neu = await page.evaluate(() => { const m = [...document.querySelectorAll('.wp')].pop().getBoundingClientRect(); return [m.left + m.width / 2, m.top + m.height / 2]; });
  pruef('Fadenkreuz: Punkt genau unter dem Kreuz', Math.abs(neu[0] - kx) < 2 && Math.abs(neu[1] - ky) < 2, { neu, kreuz: [kx, ky] });
  await page.click('#bZurueck');
  await page.waitForFunction(() => document.querySelectorAll('.wp').length === 2);
  pruef('Fadenkreuz: Abstand nach Rückgängig zum neuen letzten Punkt', (await page.textContent('#kreuzText')) !== '' && (await page.textContent('#bKreuzSetzen')).includes('Punkt hier'));
  // Tipp auf die Route setzt mit Fadenkreuz kein Zwischenziel
  const routenMitte = await page.evaluate(() => { const p = document.querySelector('.leaflet-overlay-pane path[stroke="#e5532d"].leaflet-interactive'); const l = p.getTotalLength(); const q = p.getPointAtLength(l / 2); const m = p.getScreenCTM(); const x = q.x * m.a + m.e, y = q.y * m.d + m.f; return [x, y, document.elementFromPoint(x, y) === p]; });
  await page.mouse.click(routenMitte[0], routenMitte[1]);
  await page.waitForTimeout(500);
  pruef('Fadenkreuz: Tipp auf die Route setzt nichts', routenMitte[2] && (await page.$$('.wp')).length === 2, routenMitte);
  await page.click('#bMenue');
  pruef('Fadenkreuz-Feld bei offenem Menü gesperrt', await page.evaluate(() => document.querySelector('#kreuzFeld').inert));
  await page.keyboard.press('Escape');
  await page.click('#bKreuz');
  pruef('Fadenkreuz aus', await page.isHidden('#kreuz') && await page.isHidden('#kreuzFeld'));
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
  // Laufen: Lauftempo statt „Zügig … Mit Kind“, Zeit aus Leistungs-km, Kilometer-Ansage einmal von selbst an
  await page.selectOption('#profilwahl', 'laufen');
  await page.waitForSelector('#ergebnis:not([hidden])');
  await page.waitForTimeout(300);
  pruef('Laufen: Lauftempo statt Gehtempo', await page.isVisible('#pacewahl') && await page.isHidden('#tempowahl'));
  const lauf6 = await page.evaluate(() => [document.querySelector('#zZeit').textContent, document.querySelector('#zZeitText').textContent, document.querySelector('#zLaenge').textContent, document.querySelector('#zAuf').textContent]);
  pruef('Laufen: Laufzeit beim gewählten Tempo', lauf6[1] === 'Laufzeit bei 6:00 min/km', lauf6);
  await page.selectOption('#pacewahl', '5');
  const lauf5 = await page.textContent('#zZeit');
  pruef('Laufen: schneller ist kürzer', lauf5 !== lauf6[0] && (await page.textContent('#zZeitText')).includes('5:00'), [lauf6[0], lauf5]);
  pruef('Laufen: Kilometer-Ansage von selbst an', await page.isChecked('#kmAnsage'));
  await page.selectOption('#profilwahl', 'wandern');
  await page.waitForTimeout(300);
  pruef('Wandern: wieder Gehtempo', await page.isVisible('#tempowahl') && await page.isHidden('#pacewahl') && (await page.textContent('#zZeitText')).includes('Gehzeit'));
  // Zeitplan gegen den Sonnenuntergang (ohne Netz gerechnet)
  const setze = (id, wert) => page.evaluate(([i, w]) => { const el = document.getElementById(i); el.value = w; el.dispatchEvent(new Event('change')); }, [id, wert]);
  await setze('startTag', '2026-11-01');
  pruef('Zeitplan: spätester Start vor Sonnenuntergang', /Sonnenuntergang 1[5-7]:\d\d Uhr: spätestens um \d\d:\d\d Uhr losgehen/.test(await page.textContent('#zeitplan')), await page.textContent('#zeitplan'));
  await setze('startZeit', '16:00');
  pruef('Zeitplan: zu später Start wird gewarnt', (await page.textContent('#zeitplan')).includes('Knapp') && (await page.getAttribute('#zeitplan', 'class')).includes('warnung'), await page.textContent('#zeitplan'));
  await setze('startZeit', '08:00'); await setze('pausewahl', '45');
  // die Strecke ist je Lauf verschieden lang (Klicks auf die Karte): Ankunft aus der angezeigten Gehzeit nachrechnen
  const [gh, gm] = (await page.textContent('#zZeit')).match(/(\d+):(\d+)/).slice(1).map(Number);
  const ankunftMin = 8 * 60 + gh * 60 + gm + 45, soll = String(Math.floor(ankunftMin / 60) % 24).padStart(2, '0') + ':' + String(ankunftMin % 60).padStart(2, '0');
  const zp = await page.textContent('#zeitplan');
  const [uh, um] = zp.match(/Sonnenuntergang (\d\d):(\d\d)/).slice(1).map(Number);
  const knappSoll = uh * 60 + um - ankunftMin < 25;   // nahe an 30 min entscheidet die genaue Gehzeit: Grenzfall nicht prüfen
  const grenzfall = Math.abs(uh * 60 + um - ankunftMin - 30) <= 5;
  const [ah, am] = (zp.match(/Ankunft etwa (\d\d):(\d\d)/) || [0, 0, 0]).slice(1).map(Number);   // angezeigte Gehzeit ist gerundet: ±5 min
  pruef('Zeitplan: Ankunft = Start + Gehzeit + Pause, Warnung passt zur Reserve', zp.startsWith('Start 08:00 → Ankunft etwa') && Math.abs(ah * 60 + am - ankunftMin) <= 5 && zp.includes('(mit 45 min Pause)') &&
    (grenzfall || (zp.includes('Knapp') === knappSoll && (await page.getAttribute('#zeitplan', 'class')).includes('warnung') === knappSoll)), [zp, soll, knappSoll]);

  pruef('Anreise zum Start: Bus und Bahn und Auto', await page.isVisible('#anreise') && await page.evaluate(() => {
    const o = document.querySelector('#anreiseOepnv').href, a = document.querySelector('#anreiseAuto').href;
    return /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=-?\d+\.\d{5},-?\d+\.\d{5}&travelmode=transit$/.test(o) && a.endsWith('travelmode=driving') && o.split('&')[1] === a.split('&')[1]; }));
  pruef('Zeitplan im Entwurf gespeichert', await page.evaluate(() => { const e = JSON.parse(localStorage.getItem('gug.entwurf')); return e.zeit && e.zeit.start === '08:00' && e.zeit.pause === 45 && e.zeit.tag === '2026-11-01'; }));
  // Info auf der Karte: Antippen zeigt, was dort ist, statt einen Punkt zu setzen
  const wpVorInfo = (await page.$$('.wp')).length;
  await page.click('#bInfo');
  pruef('Info-Modus an: Hinweis sichtbar, gespeichert', await page.isVisible('#infoHinweis') && (await page.getAttribute('#bInfo', 'aria-pressed')) === 'true' &&
    (await page.evaluate(() => localStorage.getItem('gug.infoModus'))) === 'true');
  const kbInfo = await page.locator("#karte").boundingBox();
  await page.waitForTimeout(500);
  await page.mouse.click(kbInfo.x + kbInfo.width * 0.75, kbInfo.y + kbInfo.height * 0.35);
  await page.waitForSelector('.info-liste button', { timeout: 8000 });
  const infoListe = await page.$$eval('.info-liste button', l => l.map(x => x.textContent));
  pruef('Info: Liste der Orte an der Stelle, kein neuer Punkt', infoListe.length === 2 && infoListe[0].includes('Schloss Test') && infoListe[0].includes('Burg oder Schloss') &&
    infoListe[0].includes('durchgehend geöffnet') && (await page.$$('.wp')).length === wpVorInfo, infoListe);
  await page.click('.info-liste button >> nth=0');
  await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-popup .wiki p')].some(p => p.textContent.includes('Alte Burg')), null, { timeout: 5000 }).catch(() => {});
  const infoText = await page.textContent('.leaflet-popup-content');
  pruef('Info: Fenster mit Art, geöffnet jetzt, Eintritt und Wikipedia', infoText.includes('Schloss Test') && infoText.includes('Durchgehend geöffnet') && infoText.includes('Eintritt: ja') &&
    infoText.includes('Das Alte Burg (Teststadt) ist') && infoText.includes('Als Stopp'), infoText);
  const gLink = await page.evaluate(() => { const a = [...document.querySelectorAll('.leaflet-popup a')].find(x => x.textContent.includes('Google Maps')); return a && a.href; });
  pruef('Info: Link zu Google Maps mit Name und Ort', !!gLink && gLink.startsWith('https://www.google.com/maps/search/?api=1&query=') && decodeURIComponent(gLink).includes('Schloss Test, ') &&
    !/query=\d/.test(gLink), gLink);
  await page.click('.leaflet-popup button:has-text("Liste")');
  pruef('Info: zurück zur Liste', (await page.$$('.info-liste button')).length === 2);
  // als Reiseziel merken: Formular mit Name und Ort aus dem Info-Fenster
  await page.click('.info-liste button >> nth=0');
  await page.click('.leaflet-popup button:has-text("Merken")');
  pruef('Info: ⭐ Merken öffnet das Reiseziel mit Name und Ort', await page.isVisible('#zlForm') && (await page.inputValue('#zlName')) === 'Schloss Test' &&
    (await page.textContent('#zlOrt')).includes('Burg oder Schloss'));
  await page.click('#zlAbbrechen');
  await page.click('[data-reiter=planen]');
  await page.click('#bInfoAus');
  await page.waitForTimeout(500);
  await page.mouse.click(kbInfo.x + kbInfo.width * 0.75, kbInfo.y + kbInfo.height * 0.35);
  await page.waitForTimeout(300);
  pruef('Info aus: Antippen setzt wieder einen Punkt', (await page.$$('.wp')).length === wpVorInfo + 1 && !(await page.isVisible('#infoHinweis')));
  await page.click('#bZurueck');
  await page.waitForTimeout(300);
  // Entdecken: Wetter und Orte
  await zuSeite(page, 'entdecken');
  await page.waitForSelector('#wetter .wetter');
  pruef('Wetter: Gewitterwarnung mit Tag', (await page.textContent('#wetter')).includes('Gewitter am Di'), await page.textContent('#wetter .warnung'));
  // Wetter für: Start der Route (mit Ortsname und Höhe), Kartenmitte, gesuchter Ort
  await page.waitForFunction(() => document.querySelector('#wetter').textContent.includes('Vorhersage für'));
  const wStart = await page.textContent('#wetter p.klein');
  pruef('Wetter: am Start der Route, mit Ortsname und Höhe', wStart.includes('Stadtplatz, Teststadt') && wStart.includes('Start der Route') && wStart.includes('auf 612 m'), wStart);
  await page.selectOption('#wetterOrt', 'mitte');
  await page.waitForFunction(() => document.querySelector('#wetter p.klein') && document.querySelector('#wetter p.klein').textContent.includes('Kartenmitte'));
  pruef('Wetter: Kartenmitte wählbar', (await page.textContent('#wetter p.klein')).includes('Kartenmitte'));
  await page.selectOption('#wetterOrt', 'standort');
  await page.waitForFunction(() => document.querySelector('#wetter p.klein') && document.querySelector('#wetter p.klein').textContent.includes('dein Standort'), null, { timeout: 15000 });
  pruef('Wetter: am eigenen Standort', (await page.textContent('#wetter p.klein')).includes('dein Standort'));
  await page.selectOption('#wetterOrt', 'ort');
  pruef('Wetter: Ort suchen zeigt das Suchfeld', await page.isVisible('#wetterSuchfeld') && (await page.textContent('#wetter')).includes('suchen'));
  await page.fill('#wetterSuchfeld', 'Testg');
  await page.click('#bWetterSuche');
  await page.waitForSelector('#wetterTreffer li button');
  await page.click('#wetterTreffer li button:has-text("Testgipfel")');
  await page.waitForFunction(() => document.querySelector('#wetter p.klein') && document.querySelector('#wetter p.klein').textContent.includes('Testgipfel'));
  const wOrt = await page.textContent('#wetter p.klein');
  pruef('Wetter: für den gesuchten Gipfel, gespeichert', wOrt.includes('Testgipfel (Gipfel') && wOrt.includes('gesuchter Ort') && await page.isHidden('#wetterTreffer') &&
    (await page.evaluate(() => JSON.parse(localStorage.getItem('gug.wetterPlatz')).name)) === 'Testgipfel', wOrt);
  // verspätete Antworten überschreiben nichts: alte Suche nach neuer, GPS nach Wechsel zur Kartenmitte
  await ctx.route(/photon\.komoot\.io\/api.*q=Altsuche/, async r => { await new Promise(x => setTimeout(x, 800)); r.fulfill({ status: 200, contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ features: [{ geometry: { coordinates: [11.3, 47.7] }, properties: { name: 'Altort', osm_key: 'place', osm_value: 'village' } }] }) }); });
  await page.fill('#wetterSuchfeld', 'Altsuche');
  await page.click('#bWetterSuche');
  await page.fill('#wetterSuchfeld', 'Testg');
  await page.click('#bWetterSuche');
  await page.waitForTimeout(1200);
  const wTreffer = await page.textContent('#wetterTreffer');
  pruef('Wetter-Suche: ältere Antwort überschreibt die neuere nicht', wTreffer.includes('Testgipfel') && !wTreffer.includes('Altort'), wTreffer);
  await page.evaluate(() => { const g = navigator.geolocation, alt = g.getCurrentPosition.bind(g); window.__gpsAlt = alt;
    g.getCurrentPosition = (ok, f, o) => setTimeout(() => ok({ coords: { latitude: 47.9, longitude: 11.9, accuracy: 10 } }), 700); });
  await page.selectOption('#wetterOrt', 'standort');
  await page.selectOption('#wetterOrt', 'mitte');
  await page.waitForTimeout(1300);
  const wRennen = await page.textContent('#wetter p.klein');
  pruef('Wetter: verspäteter Standort überschreibt die Kartenmitte nicht', wRennen.includes('Kartenmitte') && !wRennen.includes('dein Standort'), wRennen);
  await page.evaluate(() => { navigator.geolocation.getCurrentPosition = window.__gpsAlt; });
  await page.selectOption('#wetterOrt', 'start');
  await page.waitForFunction(() => document.querySelector('#wetter p.klein') && document.querySelector('#wetter p.klein').textContent.includes('Start der Route'));
  // Regenplan: Regen morgen hebt den Knopf hervor; Liste nach Abstand mit Stand der Öffnungszeit, Fenster mit Kurzinfo
  pruef('Regenplan: Knopf bei Regen morgen hervorgehoben', (await page.textContent('#bDrinnen')).includes('Regen morgen') && await page.evaluate(() => document.querySelector('#bDrinnen').classList.contains('haupt')));
  await page.click('#bDrinnen');
  await page.waitForSelector('#drinnenListe li');
  const drinnen = await page.$$eval('#drinnenListe li', l => l.map(x => x.textContent));
  pruef('Regenplan: drinnen in der Nähe, nächstes zuerst, ohne Namenlose', drinnen.length === 2 && drinnen[0].includes('Hallenbad Test') && drinnen[1].includes('Heimatmuseum') &&
    drinnen[1].includes('durchgehend geöffnet') && (await page.textContent('#drinnenStatus')).includes('2 Orte'), drinnen);
  await page.click('#drinnenListe li:has-text("Heimatmuseum") .was');
  await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-popup .wiki p')].some(p => p.textContent.includes('Heimatmuseum')), null, { timeout: 5000 }).catch(() => {});
  pruef('Regenplan: Fenster mit Öffnungszeit und Kurzinfo', (await page.textContent('.leaflet-popup-content')).includes('Durchgehend geöffnet') &&
    (await page.textContent('.leaflet-popup-content')).includes('Das Heimatmuseum ist'), await page.textContent('.leaflet-popup-content'));
  await page.click('.leaflet-popup-close-button');
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
  // Notfall: Koordinaten zum Vorlesen, Senden über die Zwischenablage (ohne Teilen-Menü im Browser), 112 als Telefon-Link
  await zuSeite(page, 'notfall');
  pruef('Notfall: eigene Seite über das Menü', (await page.textContent('#seitenTitel')) === 'Notfall' && await page.isVisible('#bNotruf'));
  const notOrt = await page.textContent('#notfallOrt');
  pruef('Notfall: Koordinaten in Dezimalgrad und Grad/Minuten', /47\.76\d{3}, 11\.39\d{3}/.test(notOrt) && notOrt.includes('° ') && notOrt.includes('N'), notOrt);
  await page.evaluate(() => { try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch (e) {} });
  await page.click('#bStandortSenden');
  await page.waitForTimeout(300);
  const ablage = await page.evaluate(() => navigator.clipboard.readText());
  pruef('Notfall: Standort-Text mit Koordinaten und Kartenlink', ablage.startsWith('Mein Standort: 47.76') && ablage.includes('openstreetmap.org/?mlat='), ablage);
  pruef('Notfall: 112 als Telefon-Link', (await page.getAttribute('#bNotruf', 'href')) === 'tel:112');
  await page.click('[data-reiter=unterwegs]');
  await page.screenshot({ path: path.join(OUT, '4-unterwegs.png') });
  await page.click('#bAufzSpeichern');
  await page.waitForTimeout(300);
  pruef('Route bleibt beim Speichern der Aufzeichnung', (await page.textContent('#bNavi')).includes('beenden') && (await page.$$('.wp')).length === 2);
  await page.click('#bNavi');
  await page.click('[data-reiter=touren]');
  pruef('Touren getrennt: Aufzeichnung nicht bei den geplanten', !(await page.textContent('#tourliste')).includes('Aufzeichnung') && (await page.textContent('#tourliste')).includes('Testrunde'));
  await page.click('section[data-reiter=touren] .umschalter [data-ziel=gegangen]');
  pruef('Aufzeichnung bei den gegangenen Touren, mit Statistik', (await page.textContent('#gangliste')).includes('Aufzeichnung') && (await page.textContent('#gangStatistik')).includes('Tour') &&
    (await page.textContent('#seitenTitel')) === 'Gegangene Touren' && (await page.getAttribute('[data-reiter=touren]', 'class')).includes('an'));
  // Statistik je Woche und Monat: Zeilen und 12 Säulen, aktueller Monat mit Zahl und Wert beim Antippen
  pruef('Statistik: diese Woche und dieser Monat', (await page.textContent('#gangZeitraum')).includes('Diese Woche:') && (await page.textContent('#gangZeitraum')).includes('Dieser Monat:') &&
    /1 Tour/.test(await page.textContent('#gangZeitraum')), await page.textContent('#gangZeitraum'));
  const saeulen = await page.$$eval('#gangMonate .saeule', l => l.map(b => ({ h: b.querySelector('i').style.height, zahl: !!b.querySelector('b'), label: b.getAttribute('aria-label') })));
  pruef('Statistik: 12 Monate, aktueller Monat voll mit Zahl, andere leer', saeulen.length === 12 && saeulen[11].h === '100%' && saeulen[11].zahl && saeulen.slice(0, 11).every(x => x.h === '0%' && !x.zahl), saeulen.slice(10));
  await page.click('#gangMonate .saeule >> nth=11');
  pruef('Statistik: Antippen zeigt den Wert', /\d{4}: [\d,]+ km, 1 Tour/.test(await page.textContent('#meldung')), await page.textContent('#meldung'));
  pruef('Statistik: als Tabelle mit 12 Zeilen', (await page.$$('#gangMonate table tr')).length === 13);
  // gespeicherte Touren als Punkte: geplante und gegangene getrennt, Öffnen aus dem Fenster
  const tourMk = await page.$$eval('.tour-mk', l => l.map(e => e.className));
  pruef('Touren als Punkte auf der Karte (geplant und gegangen)', tourMk.some(c => c.includes('geplant')) && tourMk.some(c => c.includes('gegangen')), tourMk);
  await page.click('.tour-mk.gegangen', { force: true });
  await page.waitForSelector('.leaflet-popup button:has-text("Öffnen")');
  pruef('Tour-Punkt: Fenster mit Art und Öffnen', (await page.textContent('.leaflet-popup')).includes('gegangen'));
  await page.click('.leaflet-popup button:has-text("Öffnen")');
  await page.waitForTimeout(300);
  // ---------- Reisetagebuch ----------
  await zuSeite(page, 'tagebuch');
  pruef('Tagebuch: leer mit Hinweis', (await page.textContent('#tbReisen')).includes('Noch keine Reise') && await page.isHidden('#tbHeute'));
  pruef('Tagebuch im Browser: kein Schalter für die Galerie', await page.isHidden('#tbGalerieAuch'));
  const tagPlus = n => page.evaluate(n => { const d = new Date(Date.now() + n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }, n);
  await page.click('#tbNeueReise');
  await page.fill('#tbName', 'Testurlaub');
  await page.fill('#tbVon', await tagPlus(-1));
  await page.fill('#tbBis', await tagPlus(-3));
  await page.click('#tbReiseForm button[type=submit]');
  pruef('Tagebuch: „bis“ vor „von“ abgelehnt', await page.isVisible('#tbReiseForm') && (await page.textContent('#meldung')).includes('vor'));
  await page.fill('#tbBis', await tagPlus(1));
  await page.click('#tbReiseForm button[type=submit]');
  pruef('Tagebuch: Reise angelegt, 3 Tage', (await page.textContent('#tbTitel')) === 'Testurlaub' && (await page.textContent('#tbZeitraum')).includes('3 Tage'), await page.textContent('#tbZeitraum'));
  pruef('Tagebuch: heutige Aufzeichnung bei der Reise', (await page.$$('#tbTouren li[data-tour]')).length >= 1);
  await page.click('#tbZurueck');
  pruef('Tagebuch: Reise läuft heute, Knopf „Eintrag für heute“', (await page.textContent('#tbHeute')).includes('Testurlaub') && (await page.textContent('#tbReisen')).includes('0 Einträge'));
  await page.click('#tbHeute');
  await page.waitForFunction(() => document.querySelector('#tbOrtWetter').textContent.includes('°C'), null, { timeout: 15000 });
  pruef('Tagebuch: Ort und Wetter von selbst', (await page.textContent('#tbOrtWetter')).includes('Stadtplatz, Teststadt') && (await page.textContent('#tbOrtWetter')).includes('18 °C'), await page.textContent('#tbOrtWetter'));
  await page.fill('#tbText', 'Erster Tag: <b>Sonne</b> und Eis am See.');
  const fotoPng = fs.readFileSync(path.join(OUT, '1-route.png'));
  await page.setInputFiles('#tbFotoDatei', [{ name: 'see.png', mimeType: 'image/png', buffer: fotoPng }, { name: 'eis.png', mimeType: 'image/png', buffer: fotoPng }]);
  await page.waitForFunction(() => document.querySelectorAll('#tbFotosNeu figure').length === 2, null, { timeout: 8000 });
  await page.click('#tbFotosNeu figure >> nth=1 >> button.weg');
  await page.waitForFunction(() => document.querySelectorAll('#tbFotosNeu figure').length === 1);
  await page.click('#tbEintragSpeichern');
  await page.waitForSelector('.tb-eintrag');
  await page.waitForFunction(() => document.querySelectorAll('.tb-eintrag .tb-fotos img').length === 1, null, { timeout: 5000 });
  const karteTb = await page.textContent('.tb-eintrag');
  pruef('Tagebuch: Eintrag mit Text (als Text), Ort, Wetter, einem Foto', karteTb.includes('<b>Sonne</b>') && karteTb.includes('Teststadt') && karteTb.includes('heiter'), karteTb);
  const fotoGroesse = await page.evaluate(async () => { const img = document.querySelector('.tb-eintrag .tb-fotos img'); const b = await (await fetch(img.src)).blob(); return [b.type, img.naturalWidth]; });
  pruef('Tagebuch: Foto verkleinert als JPEG gespeichert', fotoGroesse[0] === 'image/jpeg' && fotoGroesse[1] <= 1600, fotoGroesse);
  await page.click('.tb-eintrag .tb-fotos button.gross');
  pruef('Tagebuch: Foto groß, Fokus auf Schließen', await page.isVisible('#tbBild') && await page.evaluate(() => document.activeElement.id === 'tbBildZu'));
  await page.keyboard.press('Escape');
  pruef('Tagebuch: Escape schließt, Fokus zurück aufs Foto', await page.isHidden('#tbBild') && await page.evaluate(() => document.activeElement.classList.contains('gross')));
  await page.click('.tb-eintrag button[title="Eintrag bearbeiten"]');
  await page.waitForFunction(() => document.querySelectorAll('#tbFotosNeu figure').length === 1, null, { timeout: 5000 }).catch(() => {});
  pruef('Tagebuch: Bearbeiten zeigt Text und Foto', (await page.inputValue('#tbText')).startsWith('Erster Tag') && (await page.$$('#tbFotosNeu figure')).length === 1);
  await page.fill('#tbText', 'Erster Tag: Sonne, Eis und Baden.');
  await page.click('#tbEintragSpeichern');
  await page.waitForFunction(() => document.querySelector('.tb-eintrag .text') && document.querySelector('.tb-eintrag .text').textContent.includes('Baden'));
  pruef('Tagebuch: geändert, Ort und Uhrzeit bleiben', (await page.$$('.tb-eintrag')).length === 1 && (await page.textContent('.tb-eintrag')).includes('Teststadt'));
  // Eintrag als Punkt auf der Karte; „Öffnen“ springt zum Eintrag
  pruef('Tagebuch: Eintrag als Punkt auf der Karte', (await page.$$('.tb-mk')).length === 1);
  await page.click('[data-reiter=karte]');
  await page.evaluate(() => document.querySelector('.tb-mk').parentElement.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForSelector('.leaflet-popup button:has-text("Öffnen")');
  pruef('Tagebuch-Punkt: Fenster mit Reise und Text', (await page.textContent('.leaflet-popup')).includes('Testurlaub') && (await page.textContent('.leaflet-popup')).includes('Baden'));
  await page.click('.leaflet-popup button:has-text("Öffnen")');
  await page.waitForTimeout(200);
  pruef('Tagebuch-Punkt: Öffnen zeigt den Eintrag hervorgehoben', await page.isVisible('#tbReise') && (await page.$$('.tb-eintrag.hervor')).length === 1);
  await zuSeite(page, 'karte');
  await page.click('#bLagen');
  await page.uncheck('#lageTagebuch');
  pruef('Kartenwahl: Tagebuch-Ebene abschaltbar', (await page.$$('.tb-mk')).length === 0);
  await page.check('#lageTagebuch');
  await page.keyboard.press('Escape'); await page.click('#karte', { position: { x: 5, y: 300 } }).catch(() => {});
  // Heft: Druck abfangen, Inhalt prüfen und als echtes PDF drucken
  await zuSeite(page, 'tagebuch');
  await page.evaluate(() => { window.__heftDruck = null; window.__altPrint = window.print; window.print = () => { window.__heftDruck = { klasse: document.documentElement.classList.contains('heft'), thema: document.documentElement.dataset.thema }; };
    window.__altTimeout = window.setTimeout; window.setTimeout = (f, ms, ...x) => ms === 500 && window.__heftDruck ? 0 : window.__altTimeout(f, ms, ...x); });
  await page.click('#tbHeftKnopf');
  await page.waitForFunction(() => window.__heftDruck, null, { timeout: 8000 });
  const heft = await page.evaluate(() => ({ d: window.__heftDruck, h1: document.querySelector('#tbHeft h1').textContent, svg: !!document.querySelector('#tbHeft svg circle'),
    tage: document.querySelectorAll('#tbHeft h2').length, fotos: document.querySelectorAll('#tbHeft .heft-fotos img').length, text: document.querySelector('#tbHeft').textContent }));
  pruef('Heft: Titel, Skizze mit Orten, Tag, Foto, hell', heft.d.klasse && heft.d.thema === 'hell' && heft.h1 === 'Testurlaub' && heft.svg && heft.tage === 1 && heft.fotos === 1 && heft.text.includes('Baden'), heft);
  await page.screenshot({ path: path.join(OUT, '11-heft.png'), fullPage: true });
  const heftPdf = await page.pdf({ path: path.join(OUT, '11-heft.pdf'), format: 'A4', printBackground: true });
  pruef('Heft: PDF entsteht', heftPdf.length > 5000);
  await page.evaluate(() => { window.dispatchEvent(new Event('afterprint')); window.print = window.__altPrint; window.setTimeout = window.__altTimeout; });
  pruef('Heft: danach wieder die App, Heft geleert', !(await page.evaluate(() => document.documentElement.classList.contains('heft'))) && await page.isVisible('#tbReise') &&
    (await page.evaluate(() => document.querySelector('#tbHeft').children.length)) === 0);
  // Speichern, während ein Foto noch verkleinert wird, und doppelt getippt: ein Eintrag, mit Foto
  await page.click('#tbNeuerEintrag');
  await page.fill('#tbText', 'Zweiter Tag');
  await page.setInputFiles('#tbFotoDatei', { name: 'b.png', mimeType: 'image/png', buffer: fotoPng });
  await page.evaluate(() => { const b = document.querySelector('#tbEintragSpeichern'); b.click(); b.click(); });
  await page.waitForFunction(() => document.querySelectorAll('.tb-eintrag').length >= 2, null, { timeout: 8000 });
  await page.waitForTimeout(400);
  const zweiter = await page.evaluate(() => JSON.parse(localStorage.getItem('gug.tagebuch')).eintraege.filter(e => e.text === 'Zweiter Tag'));
  pruef('Tagebuch: Doppeltipp legt einen Eintrag an, wartendes Foto ist dabei', zweiter.length === 1 && zweiter[0].fotos.length === 1, zweiter);
  await page.click('.tb-eintrag:has-text("Zweiter Tag") button[title="Eintrag löschen"]');
  await page.click('.tb-eintrag:has-text("Zweiter Tag") button[title="Eintrag löschen"]');
  await page.waitForFunction(() => document.querySelectorAll('.tb-eintrag').length === 1);
  // ---------- Reiseziele ----------
  await zuSeite(page, 'ziele');
  pruef('Reiseziele: erste Liste von selbst, Hinweis wie es geht', (await page.textContent('#zlListe')).includes('Meine Ziele') && (await page.textContent('#zlStatus')).includes('Datei laden'));
  await page.click('#zlNeu');
  await page.fill('#zlSuche', 'Testg');
  await page.click('#zlSucheLos');
  await page.click('#zlTreffer li:has-text("Testgipfel")');
  pruef('Reiseziele: Ort aus der Suche, Name vorbelegt', (await page.inputValue('#zlName')) === 'Testgipfel' && (await page.textContent('#zlOrt')).includes('📍'));
  await page.fill('#zlNotiz', 'Mit Oma im Juni');
  await page.click('#zlStich button:has-text("Berg")');
  await page.click('#zlForm button[type=submit]');
  await page.waitForSelector('#zlZiele li');
  const zl1 = await page.textContent('#zlZiele');
  pruef('Reiseziele: Ziel gespeichert, mit Stichwort und Entfernung, Stern auf der Karte', zl1.includes('Testgipfel') && zl1.includes('Berg') && zl1.includes('Idee') && /km|m/.test(zl1) &&
    (await page.$$('.zl-mk')).length === 1, zl1);
  // Liste einfügen: Zeilen aus einer Notiz, Orte werden gesucht, Abbrechen ändert nichts
  await page.click('#zlEinfuegen');
  await page.fill('#zlText', 'Testgipfel West\nKloster Test; Testg; mit Biergarten\n');
  await page.click('#zlTextLos');
  await page.waitForFunction(() => document.querySelectorAll('#zlImportListe input:checked').length === 2, null, { timeout: 15000 }).catch(() => {});
  pruef('Liste einfügen: jede Zeile ein Ziel, Orte gesucht, zum Abhaken', (await page.textContent('#zlImportTitel')) === 'Eingefügte Ziele' &&
    (await page.$$('#zlImportListe input:checked')).length === 2 && (await page.textContent('#zlImportListe')).includes('Kloster Test') &&
    (await page.textContent('#zlImportZiel')).includes('Neue Liste „Eingefügt'), await page.textContent('#zlImportStatus'));
  await page.click('#zlImportAbbrechen');
  pruef('Liste einfügen: Abbrechen übernimmt nichts', (await page.evaluate(() => JSON.parse(localStorage.getItem('gug.ziele')).ziele.length)) === 1 && await page.isVisible('#zlUebersicht'));
  // Datei laden: Text (Orte werden gesucht) und GPX (mit Koordinaten)
  const txtPfad = path.join(OUT, 'Sommerziele.txt');
  fs.writeFileSync(txtPfad, '# Ideen\nTestgipfel Süd\nStadtplatz https://beispiel.de\n');
  await page.setInputFiles('#zlDatei', txtPfad);
  await page.waitForFunction(() => document.querySelectorAll('#zlImportListe input:checked').length === 2, null, { timeout: 15000 }).catch(() => {});
  pruef('Datei laden: Text, beide Orte gesucht und gefunden', (await page.$$('#zlImportListe input:checked')).length === 2 && (await page.textContent('#zlImportStatus')).includes('2 mit Ort'),
    await page.textContent('#zlImportStatus'));
  await page.click('#zlImportOk');
  await page.waitForTimeout(200);
  pruef('Datei laden: neue Liste nach dem Dateinamen, Link mitgenommen', (await page.textContent('#zlListe')).includes('Sommerziele') && (await page.$$('#zlZiele li')).length === 2 &&
    (await page.evaluate(() => JSON.parse(localStorage.getItem('gug.ziele')).ziele.some(z => z.link === 'https://beispiel.de'))));
  const zlGpxPfad = path.join(OUT, 'punkte.gpx');
  fs.writeFileSync(zlGpxPfad, '<?xml version="1.0"?><gpx><wpt lat="47.6" lon="11.3"><name>Walchensee</name><desc>Baden</desc></wpt><wpt lat="47.7" lon="11.2"><name>Kochelsee</name></wpt></gpx>');
  await page.setInputFiles('#zlDatei', zlGpxPfad);
  await page.waitForSelector('#zlImport:not([hidden])');
  await page.selectOption('#zlImportZiel', { label: 'Meine Ziele' });
  await page.click('#zlImportListe li:has-text("Kochelsee") input');
  await page.click('#zlImportOk');
  await page.waitForTimeout(200);
  const zlAlle = await page.evaluate(() => JSON.parse(localStorage.getItem('gug.ziele')));
  pruef('Datei laden: GPX in eine bestehende Liste, abgewähltes bleibt weg', zlAlle.ziele.length === 4 && zlAlle.ziele.some(z => z.name === 'Walchensee' && z.notiz === 'Baden') &&
    !zlAlle.ziele.some(z => z.name === 'Kochelsee') && (await page.$$('.zl-mk')).length === 4, zlAlle.ziele.map(z => z.name));
  // als GPX weitergeben und wieder lesbar
  const [zlDl] = await Promise.all([page.waitForEvent('download'), page.click('#zlAusgeben')]);
  const zlGpx = fs.readFileSync(await zlDl.path(), 'utf8');
  pruef('Reiseziele als GPX: Wegpunkte mit Namen und Notiz', zlDl.suggestedFilename() === 'Meine-Ziele.gpx' && zlGpx.includes('<name>Walchensee</name>') && zlGpx.includes('<desc>Mit Oma im Juni</desc>'),
    [zlDl.suggestedFilename(), zlGpx.slice(0, 300)]);
  await page.screenshot({ path: path.join(OUT, '8c-reiseziele.png') });
  // Filter: Stichwort Berg
  await page.click('#zlStichFilter button:has-text("Berg")');
  pruef('Reiseziele: Filter nach Stichwort', (await page.$$('#zlZiele li')).length === 1 && (await page.textContent('#zlStatus')).includes('1 von 2'), await page.textContent('#zlStatus'));
  await page.click('#zlStichFilter button:has-text("Berg")');
  // auf der Karte: Fenster mit Notiz, Wetter am Ziel
  await page.click('#zlZiele li:has-text("Testgipfel") .was');
  await page.waitForSelector('.leaflet-popup:has-text("Mit Oma")', { timeout: 5000 });
  pruef('Reiseziel auf der Karte: Fenster mit Notiz und Anreise', (await page.textContent('.leaflet-popup-content')).includes('Bus und Bahn'));
  await page.click('.leaflet-popup button:has-text("Wetter")');
  await page.waitForFunction(() => (document.querySelector('#wetter p.klein') || {}).textContent && document.querySelector('#wetter p.klein').textContent.includes('Testgipfel'), null, { timeout: 5000 }).catch(() => {});
  pruef('Reiseziel: Wetter dort', (await page.inputValue('#wetterOrt')) === 'ort' && (await page.textContent('#wetter')).includes('Testgipfel'), await page.textContent('#wetter'));
  await page.selectOption('#wetterOrt', 'start');
  // Sicherung: alle Touren samt Planung in einer Datei; eine verlorene Tour kommt beim Laden zurück
  await zuSeite(page, 'daten');
  const alleTouren = () => page.$$eval('#tourliste li[data-tour], #gangliste li[data-tour]', l => l.length);
  const [sich] = await Promise.all([page.waitForEvent('download'), page.click('#bSichern')]);
  const sichPfad = path.join(OUT, 'sicherung.json');
  await sich.saveAs(sichPfad);
  const sichDaten = JSON.parse(fs.readFileSync(sichPfad, 'utf8'));
  await page.click('[data-reiter=touren]');
  const tourenVorher = await alleTouren();
  await zuSeite(page, 'daten');
  const fotoIds = Object.keys(sichDaten.fotos || {});
  pruef('Sicherung: Tagebuch samt Foto dabei', sichDaten.tagebuch && sichDaten.tagebuch.eintraege.length === 1 && fotoIds.length === 1 && sichDaten.fotos[fotoIds[0]].startsWith('data:image/jpeg;base64,'),
    sichDaten.tagebuch);
  pruef('Sicherung: Reiseziele dabei', sichDaten.reiseziele && sichDaten.reiseziele.ziele.length === 4 && sichDaten.reiseziele.listen.length === 2);
  pruef('Sicherung: eine Datei mit allen Touren und Wegpunkten', sich.suggestedFilename().endsWith('.json') && sichDaten.app === 'gipfel-und-gasse' &&
    sichDaten.touren.length === tourenVorher && sichDaten.touren.some(t => t.wps && t.wps.length >= 2), [sich.suggestedFilename(), sichDaten.touren.length, tourenVorher]);
  await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('gug.touren')); l.shift(); localStorage.setItem('gug.touren', JSON.stringify(l)); });
  // Tagebuch samt Fotospeicher weg (wie nach einer Neuinstallation)
  await page.evaluate(() => localStorage.removeItem('gug.ziele'));
  await page.evaluate(() => new Promise(ok => { localStorage.removeItem('gug.tagebuch'); const r = indexedDB.open('gug-tagebuch'); r.onsuccess = () => { const t = r.result.transaction('fotos', 'readwrite'); t.objectStore('fotos').clear(); t.oncomplete = ok; }; }));
  await page.click('[data-reiter=planen]'); await zuSeite(page, 'daten');
  await page.setInputFiles('#sicherungDatei', sichPfad);
  await page.waitForTimeout(300);
  pruef('Sicherung laden: fehlende Tour zurück, keine doppelt', (await alleTouren()) === tourenVorher && (await page.textContent('#meldung')).includes('1 Touren'),
    [await alleTouren(), await page.textContent('#meldung')]);
  pruef('Sicherung laden: Reiseziele zurück', (await page.evaluate(() => JSON.parse(localStorage.getItem('gug.ziele') || '{"ziele":[]}').ziele.length)) === 4 && (await page.textContent('#meldung')).includes('4 Reiseziele'));
  await zuSeite(page, 'tagebuch');
  // das Tagebuch öffnet die zuletzt angesehene Reise wieder
  pruef('Tagebuch: zurück in der zuletzt offenen Reise', await page.isVisible('#tbReise') && (await page.textContent('#tbTitel')) === 'Testurlaub');
  await page.waitForFunction(() => document.querySelectorAll('.tb-eintrag .tb-fotos img').length === 1, null, { timeout: 5000 }).catch(() => {});
  pruef('Sicherung laden: Tagebuch mit Foto zurück', (await page.textContent('#tbEintraege')).includes('Baden') && (await page.$$('.tb-eintrag .tb-fotos img')).length === 1);
  // Löschen mit Rückfrage
  await page.click('.tb-eintrag button[title="Eintrag löschen"]');
  await page.click('.tb-eintrag button[title="Eintrag löschen"]');
  await page.waitForFunction(() => !document.querySelector('.tb-eintrag'));
  await page.click('#tbReiseLoeschen'); await page.click('#tbReiseLoeschen');
  await page.waitForTimeout(200);
  pruef('Tagebuch: Eintrag und Reise gelöscht', await page.isVisible('#tbUebersicht') && (await page.textContent('#tbReisen')).includes('Noch keine Reise'));

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
  await zuSeite(page, 'entdecken');
  pruef('Stadt-Liste im Entdecken', (await page.textContent('#stadtListe')).includes('⭐ Stadtmuseum') && !(await page.isVisible('#bergBox')));
  pruef('Stadt-Liste: Öffnungszeit als Stand jetzt', (await page.textContent('#stadtListe')).includes('● durchgehend geöffnet'), await page.textContent('#stadtListe'));
  await page.evaluate(() => { window.__gelesen = []; window.speechSynthesis.speak = u => window.__gelesen.push(u.text); window.speechSynthesis.cancel = () => window.__gelesen.push('stopp'); });
  await page.click('#stadtListe li:has-text("Stadtmuseum") .was');
  await page.waitForSelector('.leaflet-popup .wiki p', { timeout: 5000 });
  const popStadt = await page.textContent('.leaflet-popup-content');
  pruef('Ort-Fenster: geöffnet jetzt und Wikipedia-Kurzinfo mit Bild', popStadt.includes('Durchgehend geöffnet') && popStadt.includes('Das Stadtmuseum ist ein Ort zum Testen.') &&
    popStadt.includes('CC BY-SA') && !!(await page.$('.leaflet-popup .wiki img')), popStadt);
  await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, '8b-ort-fenster.png') });
  await page.click('.leaflet-popup .wiki-vor');
  pruef('Ort-Fenster: Vorlesen liest die Kurzinfo', (await page.evaluate(() => window.__gelesen)).includes('Das Stadtmuseum ist ein Ort zum Testen.') && (await page.textContent('.leaflet-popup .wiki-vor')).includes('Stopp'));
  await page.click('.leaflet-popup-close-button');
  pruef('Fenster zu beendet das Vorlesen', (await page.evaluate(() => window.__gelesen)).slice(-1)[0] === 'stopp');
  await page.click('#stadtListe li:has-text("Alte Burg") .was');
  await page.waitForFunction(() => [...document.querySelectorAll('.leaflet-popup .wiki p')].some(p => p.textContent.includes('Alte Burg')), null, { timeout: 5000 }).catch(() => {});
  pruef('Ort-Fenster: Wikipedia über Wikidata (deutscher Artikel)', await page.evaluate(() => [...document.querySelectorAll('.leaflet-popup .wiki p')].some(p => p.textContent.includes('Das Alte Burg (Teststadt) ist'))));
  await page.click('.leaflet-popup-close-button');
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
  // aus dem Dunkelmodus drucken: Papier bekommt trotzdem die helle Palette
  const themaWahl = async w => { await page.click('#bMenue'); while (!(await page.textContent('#bThema')).includes(w)) await page.click('#bThema'); await page.keyboard.press('Escape'); };
  await themaWahl('dunkel');
  await page.click('#bDrucken');
  await page.waitForFunction(() => window.__gedruckt, null, { timeout: 8000 });
  const druck = await page.evaluate(() => ({ hell: document.documentElement.dataset.thema === 'hell' && getComputedStyle(document.querySelector('#druckkopf')).color !== 'rgb(230, 235, 231)', klasse: document.body.classList.contains('druck'), kopf: document.querySelector('#druckkopf').textContent, profil: !!document.querySelector('#druckfuss img') }));
  const pdf = await page.pdf({ path: path.join(OUT, '10-druck.pdf'), format: 'A4', printBackground: true });
  pruef('Druckansicht mit Kopf, Stopps und Profil, hell auch aus dem Dunkelmodus', druck.hell && druck.klasse && druck.kopf.includes('Altstadt-Runde') && druck.kopf.includes('Stopps:') && druck.profil, druck);
  pruef('PDF hat genau eine Seite', (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length === 1);
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  pruef('Nach dem Drucken wieder normal, Dunkelmodus zurück', await page.evaluate(() => !document.body.classList.contains('druck') && document.documentElement.dataset.thema === 'dunkel'));
  await themaWahl('automatisch');
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
  const UA_ANDROID = v => 'Mozilla/5.0 (Linux; Android ' + v + '; Pixel) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36';
  const appCtx = await browser.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true, userAgent: UA_ANDROID(14) });
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
        textTeilen: async o => { aufrufe.push(['textTeilen', { text: o.text }]); },
        fotoInGalerie: async o => { aufrufe.push(['fotoInGalerie', { laenge: o.daten.length, name: o.name, mime: o.mime }]); },
        vorlesen: async o => { aufrufe.push(['vorlesen', { text: o.text }]); },
        vorlesenStopp: async () => { aufrufe.push(['vorlesenStopp', {}]); },
        route: async () => {
          aufrufe.push(['route', {}]);
          if (window.__routeLangsam) await new Promise(r => setTimeout(r, 400));
          return { pts: [[47.76, 11.385], [47.765, 11.39], [47.77, 11.4]], laenge: 1830, umgeplant: window.__routeFassung || 1 };
        },
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
  pruef('App: ohne Gewitter keine Warnung', await pa2.isHidden('#uWetter'));
  await pa2.evaluate(() => window.__navi.melden({ laeuft: true, folgen: true, aufzeichnen: false, lat: 47.76, lon: 11.385, gen: 6, t: Date.now(), gewitter: 'Gewitter möglich gegen 15 Uhr', rest: { meter: 2345, auf: 120, stunden: 0.9 }, abw: 72, abseits: true }));
  pruef('App: Gewitterwarnung des Dienstes sichtbar', (await pa2.textContent('#uWetter')).includes('Gewitter möglich gegen 15 Uhr') && await pa2.isVisible('#uWetter'));
  pruef('App: Meldung des Dienstes angezeigt', (await pa2.textContent('#uRest')) === '2,3 km' && (await pa2.textContent('#uAuf')) === '120 m' && !(await pa2.isHidden('#abseits')));
  // Pfeil am Standortpunkt: ohne Kompass die Bewegungsrichtung des Dienstes, mit Kompass dessen Richtung (hat Vorrang)
  const pfeil = () => pa2.evaluate(() => { const p = document.querySelector('.ich .ich-pfeil'); return p ? (p.hidden ? 'aus' : p.style.transform) : 'fehlt'; });
  pruef('App: Standortpunkt ohne Richtung ohne Pfeil', (await pfeil()) === 'aus', await pfeil());
  await pa2.evaluate(() => window.__navi.melden({ laeuft: true, folgen: true, aufzeichnen: false, lat: 47.7601, lon: 11.385, gen: 6, t: Date.now(), richtung: 45, rest: { meter: 2300, auf: 120, stunden: 0.9 }, abw: 72, abseits: true }));
  await pa2.waitForTimeout(100);
  pruef('App: Pfeil in Gehrichtung (GPS)', (await pfeil()) === 'rotate(45deg)', await pfeil());
  await pa2.evaluate(() => window.__navi.melden({ laeuft: true, folgen: true, aufzeichnen: false, lat: 47.7601, lon: 11.385, gen: 6, t: Date.now(), rest: { meter: 2300, auf: 120, stunden: 0.9 }, abw: 72, abseits: true }));
  await pa2.waitForTimeout(100);
  pruef('App: im Stehen ohne Kompass kein alter Pfeil', (await pfeil()) === 'aus', await pfeil());
  await pa2.evaluate(() => window.__navi.melden({ laeuft: true, folgen: true, aufzeichnen: false, lat: 47.7601, lon: 11.385, gen: 6, t: Date.now(), richtung: 45, rest: { meter: 2300, auf: 120, stunden: 0.9 }, abw: 72, abseits: true }));
  await pa2.waitForTimeout(100);
  await pa2.evaluate(() => {
    const art = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.dispatchEvent(new DeviceOrientationEvent(art, { alpha: 270, beta: 0, gamma: 0, absolute: true }));
  });
  await pa2.waitForTimeout(100);
  { await pa2.click('[data-reiter=karte]'); await pa2.waitForTimeout(400); const b = await (await pa2.$('.ich')).boundingBox(); await pa2.screenshot({ path: path.join(OUT, '9-pfeil.png'), clip: { x: b.x - 40, y: b.y - 40, width: b.width + 80, height: b.height + 80 } }); await pa2.click('[data-reiter=unterwegs]'); }
  pruef('App: Pfeil zeigt die Kompassrichtung (Osten)', (await pfeil()) === 'rotate(90deg)', await pfeil());
  await pa2.evaluate(() => window.__navi.melden({ laeuft: true, folgen: true, aufzeichnen: false, lat: 47.7602, lon: 11.385, gen: 6, t: Date.now(), richtung: 180, rest: { meter: 2300, auf: 120, stunden: 0.9 }, abw: 72, abseits: true }));
  await pa2.waitForTimeout(100);
  pruef('App: Kompass hat Vorrang vor der GPS-Richtung', (await pfeil()) === 'rotate(90deg)', await pfeil());
  // über Norden hinweg auf dem kurzen Weg: 357° dann 2° ergibt −3° und 2°, nicht 357° und 2° (sonst dreht er fast ganz herum)
  const kompass = alpha => pa2.evaluate(a => {
    const art = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.dispatchEvent(new DeviceOrientationEvent(art, { alpha: a, beta: 0, gamma: 0, absolute: true }));
  }, alpha);
  await kompass(3); await pa2.waitForTimeout(80); const w1 = await pfeil();
  await kompass(358); await pa2.waitForTimeout(80); const w2 = await pfeil();
  pruef('App: Pfeil dreht über Norden auf dem kurzen Weg', w1 === 'rotate(-3deg)' && w2 === 'rotate(2deg)', [w1, w2]);
  // Umplanen: Ziele und Profil gehen an den Dienst; meldet er eine neue Route, zeigt die App sie blau
  pruef('App: Ziele und Profil fürs Umplanen', st1[1].profil === 'hiking-mountain' && st1[1].ziele.length === 1 && st1[1].ziele[0].length === 5 &&
    Math.abs(st1[1].ziele[0][0] - 47.77) < 1e-6 && st1[1].ziele[0][2] > 1000, st1[1].ziele);
  const blau = () => pa2.evaluate(() => document.querySelectorAll('.leaflet-overlay-pane path.umplan').length);
  await pa2.evaluate(() => window.__navi.melden({ laeuft: true, folgen: true, aufzeichnen: false, lat: 47.76, lon: 11.385, gen: 6, t: Date.now(), rest: { meter: 1830, auf: 80, stunden: 0.6 }, abw: 3, abseits: false, umgeplant: 1 }));
  await pa2.waitForTimeout(200);
  pruef('App: neu geplante Strecke blau auf der Karte, Meldung', (await blau()) === 1 && (await pa2.textContent('#meldung')).includes('1,8 km'), await pa2.textContent('#meldung'));
  await pa2.evaluate(() => window.__navi.melden({ laeuft: true, folgen: true, aufzeichnen: false, lat: 47.76, lon: 11.385, gen: 6, t: Date.now(), rest: { meter: 1800, auf: 80, stunden: 0.6 }, abw: 3, abseits: false, umgeplant: 1 }));
  await pa2.waitForTimeout(100);
  pruef('App: gleiche Meldung holt die Strecke nicht noch einmal', (await pa2.evaluate(() => window.__navi.aufrufe.filter(x => x[0] === 'route').length)) === 1);
  // anderes Tempo: nur Einstellungen an den Dienst, die umgeplante Strecke bleibt
  await pa2.evaluate(() => { const t = document.querySelector('#tempowahl'); t.value = '0.7'; t.dispatchEvent(new Event('change')); });
  await pa2.waitForTimeout(300);
  const nachTempo = (await pa2.evaluate(() => window.__navi.aufrufe.filter(x => x[0] === 'starten'))).pop();
  pruef('App: Tempo ändern schickt keine Route (Umplanung bleibt)', nachTempo[1].tempo === 0.7 && !nachTempo[1].pts && (await blau()) === 1, Object.keys(nachTempo[1]));
  await pa2.click('#bNavi');
  await pa2.waitForTimeout(200);
  pruef('App: Folgen beendet, neu geplante Strecke weg', (await blau()) === 0);
  // verspätete Antwort nach dem Beenden zeichnet nichts mehr
  await pa2.click('#bNavi');
  await pa2.waitForTimeout(200);
  await pa2.evaluate(() => { window.__routeLangsam = true; window.__routeFassung = 2; window.__navi.melden({ laeuft: true, folgen: true, aufzeichnen: false, lat: 47.76, lon: 11.385, gen: 6, t: Date.now(), rest: { meter: 1800, auf: 80, stunden: 0.6 }, abw: 3, abseits: false, umgeplant: 2 }); });
  await pa2.click('#bNavi');
  await pa2.waitForTimeout(600);
  pruef('App: verspätete Antwort nach dem Beenden wird verworfen', (await blau()) === 0);
  await pa2.evaluate(() => { window.__routeLangsam = false; window.__routeFassung = 1; });
  await pa2.click('#bNavi');
  await pa2.waitForTimeout(200);
  // Aufzeichnung über „Beenden“ in der Mitteilung gestoppt: Speichern wird frei, Dauer bis zum Ende
  await pa2.click('#bAufz');
  const t0 = Date.now();
  await pa2.evaluate(t => window.__navi.melden({ laeuft: true, folgen: false, aufzeichnen: true, aufz: { meter: 800, start: t - 1800000, punkte: 40, auf: 30 } }), t0);
  await pa2.evaluate(t => window.__navi.melden({ laeuft: false, folgen: false, aufzeichnen: false, aufz: { meter: 820, start: t - 1800000, ende: t - 600000, punkte: 41, auf: 30 } }), t0);
  pruef('App: nach „Beenden“ in der Mitteilung speicherbar', !(await pa2.isDisabled('#bAufzSpeichern')));
  pruef('App: Dauer bis zum Ende der Aufzeichnung', (await pa2.textContent('#aDauer')) === '20 min', await pa2.textContent('#aDauer'));
  pruef('App: Ø Tempo der Aufzeichnung (20 min auf 820 m)', (await pa2.textContent('#aTempo')) === '24:23 min/km', await pa2.textContent('#aTempo'));
  // Auto-Pause: Tempo aus der Bewegungszeit, Pause sichtbar
  await pa2.evaluate(t => window.__navi.melden({ laeuft: true, folgen: false, aufzeichnen: true, aufz: { meter: 2000, start: t - 1200000, bewegung: 600000, pause: true, punkte: 50, auf: 10 } }), t0);
  pruef('App: Ø Tempo aus der Bewegungszeit (10 min auf 2 km), Pause angezeigt', (await pa2.textContent('#aTempo')) === '5:00 min/km' &&
    (await pa2.textContent('#aBewegung')).includes('Bewegung 10 min') && (await pa2.textContent('#aBewegung')).includes('Pause'), [await pa2.textContent('#aTempo'), await pa2.textContent('#aBewegung')]);
  await pa2.evaluate(t => window.__navi.melden({ laeuft: false, folgen: false, aufzeichnen: false, aufz: { meter: 820, start: t - 1800000, ende: t - 600000, punkte: 41, auf: 30 } }), t0);
  pruef('App: Gehen schickt Faktor und keine Lauf-Kennung', st1[1].lauf === false && st1[1].tempo === 1 && typeof st1[1].kmAnsage === 'boolean', [st1[1].lauf, st1[1].tempo, st1[1].kmAnsage]);
  // Kilometer-Ansage umschalten geht gleich an den Dienst
  const vorKm = (await pa2.evaluate(() => window.__navi.aufrufe.filter(x => x[0] === 'starten').length));
  await pa2.click('#bAufz');
  await pa2.waitForTimeout(150);
  await pa2.evaluate(() => { const k = document.querySelector('#kmAnsage'); k.checked = !k.checked; k.dispatchEvent(new Event('change')); });
  await pa2.waitForTimeout(150);
  const kmAufrufe = (await pa2.evaluate(() => window.__navi.aufrufe.filter(x => x[0] === 'starten')));
  pruef('App: Kilometer-Ansage umgeschaltet an den Dienst', kmAufrufe.length >= vorKm + 2 && kmAufrufe[kmAufrufe.length - 1][1].kmAnsage === (await pa2.isChecked('#kmAnsage')));
  // während der Aufzeichnung (ohne Routenführung) auf Laufen: Lauf-Kennung, Tempo und Ansage gehen an den Dienst
  await pa2.evaluate(() => { localStorage.removeItem('gug.kmAnsageGewaehlt'); const k = document.querySelector('#kmAnsage'); k.checked = false;
    const p = document.querySelector('#profilwahl'); p.value = 'laufen'; p.dispatchEvent(new Event('change')); });
  await pa2.waitForTimeout(200);
  const nachLauf = (await pa2.evaluate(() => window.__navi.aufrufe.filter(x => x[0] === 'starten'))).pop()[1];
  pruef('App: Laufen während der Aufzeichnung an den Dienst', nachLauf.lauf === true && nachLauf.kmAnsage === true && nachLauf.tempo === 6, [nachLauf.lauf, nachLauf.kmAnsage, nachLauf.tempo]);
  await pa2.evaluate(() => { const p = document.querySelector('#profilwahl'); p.value = 'wandern'; p.dispatchEvent(new Event('change')); });
  await pa2.waitForTimeout(200);
  await pa2.click('#bAufz');
  await pa2.waitForTimeout(150);
  await pa2.click('#bAufzSpeichern');
  await pa2.waitForTimeout(400);
  // beim Start fragt die App einmal nach einer liegengebliebenen Aufzeichnung; beim Speichern holt sie und leert danach
  const a2 = (await pa2.evaluate(() => window.__navi.aufrufe)).filter(x => x[0] === 'aufzeichnungHolen');
  pruef('App: Aufzeichnung geholt und danach geleert', a2.length >= 2 && a2[a2.length - 1][1].leeren === true && a2[a2.length - 2][1].leeren === false, a2);
  await zuSeite(pa2, 'gegangen');
  pruef('App: Aufzeichnung bei den gegangenen Touren', (await pa2.textContent('#gangliste')).includes('Aufzeichnung'));
  await pa2.click('[data-reiter=planen]');
  // Telefon: weitere Funktionen hinter „Mehr“, aufgeklappt sichtbar
  pruef('Telefon: GPX, Drucken & Co. erst hinter „Mehr“', await pa2.isHidden('#bGpx') && await pa2.isVisible('#bMehr') && await pa2.isVisible('#bSpeichern'));
  await pa2.click('#bMehr');
  pruef('Telefon: „Mehr“ zeigt alle Funktionen', await pa2.isVisible('#bGpx') && await pa2.isVisible('#bDrucken') && await pa2.isVisible('#bUmkehren') && await pa2.isVisible('#bRund'));
  await pa2.click('#bGpx');
  await pa2.waitForTimeout(200);
  const teilen = (await pa2.evaluate(() => window.__navi.aufrufe)).find(x => x[0] === 'teilen');
  pruef('App: GPX über das Teilen-Menü', teilen && teilen[1].gpx && teilen[1].name.endsWith('.gpx'), teilen);
  // Notfall in der App: Standort aus dem Dienst, Senden über das Teilen-Menü von Android
  await pa2.evaluate(() => window.__navi.melden({ laeuft: false, lat: 47.6122, lon: 11.3117, gen: 9, t: Date.now() }));
  // Vorlesen der Kurzinfo über die Sprachausgabe von Android (Testhütte: nur Wikidata, englischer Artikel)
  await zuSeite(pa2, 'entdecken');
  await pa2.evaluate(() => document.querySelector('#bOrte').click());
  await pa2.waitForSelector('#ortliste li');
  await pa2.evaluate(() => [...document.querySelectorAll('#ortliste li')].find(l => l.textContent.includes('Testhütte')).click());
  await pa2.waitForSelector('.leaflet-popup .wiki-vor', { timeout: 5000 });
  await pa2.evaluate(() => document.querySelector('.leaflet-popup .wiki-vor').click());
  await pa2.evaluate(() => document.querySelector('.leaflet-popup-close-button').click());
  await pa2.waitForTimeout(100);
  const vorl = (await pa2.evaluate(() => window.__navi.aufrufe)).filter(x => x[0].startsWith('vorlesen'));
  pruef('App: Vorlesen über Android, beim Schließen gestoppt', vorl.length >= 2 && vorl[0][0] === 'vorlesen' && vorl[0][1].text === 'Das Test hut ist ein Ort zum Testen.' && vorl[vorl.length - 1][0] === 'vorlesenStopp', vorl);
  await zuSeite(pa2, 'notfall');
  await pa2.click('#bStandortSenden');
  await pa2.waitForTimeout(200);
  const notApp = (await pa2.evaluate(() => window.__navi.aufrufe)).filter(x => x[0] === 'textTeilen');
  pruef('App: Standort senden über das Teilen-Menü', notApp.length === 1 && notApp[0][1].text.includes('47.61220, 11.31170'), notApp);
  // Sicherung in der App: genau ein Teilen-Fenster mit einer JSON-Datei
  await zuSeite(pa2, 'daten');
  const vorTeilen = (await pa2.evaluate(() => window.__navi.aufrufe)).filter(x => x[0] === 'teilen').length;
  await pa2.click('#bSichern');
  await pa2.waitForTimeout(200);
  const teilenS = (await pa2.evaluate(() => window.__navi.aufrufe)).filter(x => x[0] === 'teilen');
  pruef('App: Sicherung als eine Datei über das Teilen-Menü', teilenS.length === vorTeilen + 1 && teilenS[teilenS.length - 1][1].name.endsWith('.json'), teilenS.slice(-1));
  pruef('App: Hinweis zu Touren passt zur App', (await pa2.textContent('#tourenHinweis')).includes('in der App'));
  // Tagebuch in der App: mit der Kamera aufgenommene Fotos gehen zusätzlich als Original in die Galerie, Galerie-Fotos nicht
  await zuSeite(pa2, 'tagebuch');
  await pa2.click('#tbNeueReise');
  await pa2.fill('#tbName', 'Galerietest');
  await pa2.click('#tbReiseForm button[type=submit]');
  await pa2.click('#tbNeuerEintrag');
  pruef('App: Schalter „auch in der Galerie“ sichtbar und an', await pa2.isVisible('#tbGalerieAuch') && await pa2.isChecked('#tbGalerieAuch'));
  const bildPng = fs.readFileSync(path.join(OUT, '1-route.png'));
  await pa2.setInputFiles('#tbFotoKamera', { name: 'kamera.jpg', mimeType: 'image/jpeg', buffer: bildPng });
  await pa2.waitForFunction(() => window.__navi.aufrufe.some(x => x[0] === 'fotoInGalerie'), null, { timeout: 5000 }).catch(() => {});
  await pa2.setInputFiles('#tbFotoDatei', { name: 'alt.png', mimeType: 'image/png', buffer: bildPng });
  await pa2.waitForFunction(() => document.querySelectorAll('#tbFotosNeu figure').length === 2, null, { timeout: 5000 }).catch(() => {});
  const galerie = (await pa2.evaluate(() => window.__navi.aufrufe.filter(x => x[0] === 'fotoInGalerie')));
  pruef('App: Kamerafoto als Original in die Galerie, Galeriefoto nicht', galerie.length === 1 && galerie[0][1].laenge > 1000 &&
    /^Gipfel-und-Gasse_\d{8}_\d{6}\.jpg$/.test(galerie[0][1].name) && galerie[0][1].mime === 'image/jpeg', galerie);
  pruef('App: beide Fotos im Eintrag', (await pa2.$$('#tbFotosNeu figure')).length === 2);
  await pa2.click('#tbEintragAbbrechen');
  // Android 9: kein Schalter, kein Versuch (die Galerie geht erst ab Android 10)
  const alt9 = await browser.newContext({ viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true, userAgent: UA_ANDROID(9) });
  await dienste(alt9);
  await alt9.addInitScript(bruecke.mit(() => { window.__bruecke({ Karten: { liste: async () => ({ installiert: [] }), status: async () => ({ laufend: [] }), addListener: () => {} },
    Navi: { starten: async () => ({}), status: async () => ({}), aufzeichnungHolen: async () => ({ spur: [] }), fotoInGalerie: async () => { window.__galerie = true; }, addListener: () => {} } }); }));
  const p9 = await alt9.newPage();
  await p9.goto(url);
  await zuSeite(p9, 'tagebuch');
  await p9.click('#tbNeueReise'); await p9.fill('#tbName', 'Alt'); await p9.click('#tbReiseForm button[type=submit]');
  await p9.click('#tbNeuerEintrag');
  await p9.setInputFiles('#tbFotoKamera', { name: 'k.jpg', mimeType: 'image/jpeg', buffer: bildPng });
  await p9.waitForFunction(() => document.querySelectorAll('#tbFotosNeu figure').length === 1, null, { timeout: 5000 }).catch(() => {});
  pruef('App unter Android 10: kein Galerie-Schalter, kein Versuch, Foto trotzdem im Eintrag', await p9.isHidden('#tbGalerieAuch') &&
    !(await p9.evaluate(() => window.__galerie)) && (await p9.$$('#tbFotosNeu figure')).length === 1);
  await alt9.close();
  // Zurück-Taste: erst Kartenwahl schließen, dann zum Reiter Planen, danach darf die App in den Hintergrund
  await pa2.click('#bLagen');
  const zr1 = await pa2.evaluate(() => window.gugZurueck());
  const zr2 = await pa2.evaluate(() => window.gugZurueck());
  const zr3 = await pa2.evaluate(() => window.gugZurueck());
  pruef('App: Zurück-Taste schließt erst Kartenwahl, dann Reiter, dann App', zr1 === true && zr2 === true && zr3 === false &&
    await pa2.isHidden('#lagenwahl') && (await pa2.getAttribute('[data-reiter=planen]', 'class')).includes('an'), [zr1, zr2, zr3]);
  await pa2.click('[data-reiter=planen]');
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
    // wie der Kartenserver der App im WebView des Pixel (gemessen 02.11.): mit Range-Kopfzeile springt das WebView in der
    // Antwort selbst noch einmal an den Anfang des Bereichs, ab Byte 0 fällt das nicht auf, weiter hinten kommen falsche
    // Bytes; ?von=&bis= in der Adresse liest richtig
    const u = new URL(r.request().url()), kopf = r.request().headers()['range'];
    const ausAdresse = u.searchParams.has('von') ? 'bytes=' + u.searchParams.get('von') + '-' + (u.searchParams.get('bis') || '') : null;
    const range = kopf || ausAdresse, doppelt = !!kopf;
    const daten = fs.readFileSync(f);
    const t = range && /bytes=(\d+)-(\d*)/.exec(range);
    if (!t) return r.fulfill({ status: 200, body: daten, headers: { 'Accept-Ranges': 'bytes' } });
    const von = +t[1], bis = Math.min(daten.length - 1, t[2] ? +t[2] : daten.length - 1);
    bereiche.push(m[2] + ':' + von + '-' + bis);
    // seit 03.11. auf dem Pixel gemessen: auch über die Adresse kommt ab der Dateimitte nichts an („Failed to fetch“).
    // Nachgebildet für die Kartendateien ab Byte 1: die Karte darf nur über die App-Brücke (Karten.lesen) zeichnen.
    if (von > 0 && /\.pmtiles$/.test(m[2])) return r.abort('failed');
    const ab = doppelt ? Math.min(daten.length, 2 * von) : von;
    r.fulfill({ status: 206, body: daten.subarray(ab, ab + bis - von + 1), headers: { 'Content-Range': 'bytes ' + von + '-' + bis + '/' + daten.length, 'Accept-Ranges': 'bytes' } });
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
        status: async () => ({ laufend: [] }), laden: async () => {}, loeschen: async () => {}, addListener: () => {},
        // wie KartenPlugin.lesen: Stück der Datei als Base64
        lesen: async o => window.paketStueck(o.id, o.datei, o.von, o.laenge)
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
  await offCtx.exposeFunction('paketStueck', (id, datei, von, laenge) => {
    const f = path.join(kartenOrdner, id, datei);
    if (!/^[a-z0-9-]+$/.test(id) || !/^[a-z0-9.-]+$/.test(datei) || !fs.existsSync(f)) throw new Error('Kartenserver: Datei fehlt');
    const daten = fs.readFileSync(f), b = daten.subarray(von, Math.min(daten.length, von + laenge));
    bereiche.push(datei + ':' + von + '-' + (von + b.length - 1) + ' (Brücke)');
    return { daten: b.toString('base64'), laenge: b.length, dateiLaenge: daten.length };
  });
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
  // Prüfung auf dem Gerät: Lesen in Teilen, Kopf, Kachel an der Kartenmitte
  await po.evaluate(() => document.querySelector('#bOfflinePruefen').click());
  await po.waitForFunction(() => !document.querySelector('#bOfflinePruefen').disabled && document.querySelector('#offlineBericht').textContent.includes('Kachel '), null, { timeout: 8000 }).catch(() => {});
  const bericht = await po.textContent('#offlineBericht');
  pruef('Offline prüfen: beide Lesewege gemeldet, Adresse liest, Kopf und Kachel an der Kartenmitte', /Lesen in Teilen \(Adresse\): Status 206.*Kennung „PMTiles“ v3 ✓/.test(bericht) &&
    /Lesen in Teilen \(Kopfzeile\): (Status 200|Status 206)/.test(bericht) && !/Kopf oder Kachel: FEHLER/.test(bericht) && /Kopf: Zoom \d+–\d+.*✓/.test(bericht) &&
    /Kachel \d+\/\d+\/\d+ \(Kartenmitte\): \d+ Bytes/.test(bericht) && /hoehe\.pmtiles über Brücke: 16 Bytes ✓/.test(bericht) && /Kacheln lesen über: App-Brücke/.test(bericht) && /Stück Anfang über Brücke \(0\+16384\): 538 Bytes.*Kennung „PMTiles“ ✓/.test(bericht) && await po.evaluate(() => !document.querySelector('#bOfflineBericht').hidden), bericht);
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
    // Vektorkarte: mehr als eine Farbe je Kachel. Bei Lesefehlern malt protomaps-leaflet nur den grauen Hintergrund und
    // meldet die Kachel trotzdem als geladen (Fehler nur in console.error), so sah es auf dem Pixel aus
    const farben = c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, f = new Set(); for (let i = 0; i < d.length; i += 4 * 53) f.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); return f.size; };
    const karte = ebenen.filter(e => e.style.zIndex !== '2').flatMap(e => [...e.querySelectorAll('canvas')]);
    return { relief: zaehlen(ebenen.filter(e => e.style.zIndex === '2')), karte: karte.map(farben) };
  });
  pruef('Offline: Vektorkarte zeichnet Inhalt, nicht nur den Hintergrund', gezeichnet.karte.filter(n => n > 1).length >= 4, gezeichnet.karte);
  pruef('Offline: Relief zeichnet', gezeichnet.relief.filter(n => n > 10).length >= 4, gezeichnet.relief);
  pruef('Offline: Kartendateien über die App-Brücke gelesen', bereiche.some(b => b.startsWith('karte.pmtiles') && b.endsWith('(Brücke)')) && bereiche.some(b => b.startsWith('hoehe.pmtiles') && b.endsWith('(Brücke)')), bereiche.slice(0, 6));
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
  await zuSeite(po, 'entdecken');
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
  // Suchtreffer außerhalb des Pakets: Kartenwahl bleibt „Offline-Karte“, gezeigt wird die topografische Karte
  pruef('Plan-Hinweis zu Zwischenzielen sichtbar', await po.evaluate(() => !document.querySelector('#planHinweis').hidden));
  await po.evaluate(() => localStorage.setItem('gug.tippGesehen', 'true'));
  await po.fill('#suchfeld', 'Teststadt');
  await po.waitForFunction(() => [...document.querySelectorAll('#treffer button')].some(b => b.textContent.includes('Teststadt')), null, { timeout: 8000 });
  await po.click('#treffer button:has-text("Teststadt")');
  await po.waitForTimeout(800);
  pruef('Offline-Karte außerhalb des Pakets: Wahl bleibt, topografisch gezeigt mit Hinweis', await po.evaluate(() => document.querySelector('input[name=basis][value=offline]').checked &&
    !document.querySelector('#offlineAussen').hidden && [...document.querySelectorAll('.leaflet-tile-pane img')].some(i => i.src.includes('opentopomap'))));
  pruef('Kartenwahl führt zu den Kartenpaketen', await po.evaluate(() => !document.querySelector('#bPakete').hidden));
  // Suchtreffer als Zwischenziel vor dem Ziel einfügen
  const vorPunkte = await po.$$eval('.wp', l => l.length);
  await po.click('.leaflet-popup button:has-text("Als Zwischenziel")');
  await po.waitForTimeout(600);
  const punkte = await po.$$eval('.wp', l => l.map(e => e.textContent));
  pruef('Suchtreffer als Zwischenziel: vor dem Ziel eingefügt', punkte.length === vorPunkte + 1 && punkte[punkte.length - 1] === 'Z' && punkte.includes('1'), punkte);
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
  await pt.tap('#bKreuz');
  pruef('Telefon: Fadenkreuz über dem Blatt', await pt.evaluate(() => { const k = document.querySelector('#kreuzFeld').getBoundingClientRect(); return k.bottom < document.querySelector('#panel').getBoundingClientRect().top && k.left >= 0 && k.right <= innerWidth; }));
  await pt.screenshot({ path: path.join(OUT, '8-telefon-kreuz.png') });
  const blattStufe = async gross => { for (let i = 0; i < 4 && (await pt.evaluate(() => document.querySelector('#panel').classList.contains('gross'))) !== gross; i++) { await pt.tap('#griff'); await pt.waitForTimeout(400); } };
  await blattStufe(true);
  pruef('Telefon: großes Blatt blendet Fadenkreuz aus, nichts verdeckt', await pt.isHidden('#kreuzFeld'));
  await blattStufe(false);
  pruef('Telefon: kleineres Blatt zeigt Fadenkreuz wieder', await pt.isVisible('#kreuzFeld'));
  // Blatt ziehen: am Kopf (Titel) folgt es dem Finger und rastet ein; im Inhalt nach unten, wenn er oben steht
  const stufe = () => pt.evaluate(() => { const c = document.querySelector('#panel').classList; return c.contains('klein') ? 'klein' : c.contains('gross') ? 'gross' : 'mittel'; });
  const ziehen = async (sel, dy, schritte) => {
    const r = await pt.locator(sel).boundingBox(), x = r.x + r.width / 2, y = r.y + r.height / 2;
    await pt.mouse.move(x, y); await pt.mouse.down();
    for (let i = 1; i <= schritte; i++) { await pt.mouse.move(x, y + dy * i / schritte); await pt.waitForTimeout(16); }
    await pt.mouse.up(); await pt.waitForTimeout(400);
  };
  const zuStufe = async ziel => { for (let i = 0; i < 4 && await stufe() !== ziel; i++) { await pt.tap('#griff'); await pt.waitForTimeout(400); } };
  await zuStufe('mittel');
  await pt.mouse.move(195, 760);
  const hVor = await pt.evaluate(() => document.querySelector('#panel').getBoundingClientRect().height);
  {
    const r = await pt.locator('#seitenTitel').boundingBox();
    await pt.mouse.move(r.x + 5, r.y + 5); await pt.mouse.down(); await pt.mouse.move(r.x + 5, r.y + 65, { steps: 5 });
    const hMitte = await pt.evaluate(() => document.querySelector('#panel').getBoundingClientRect().height);
    pruef('Blatt folgt beim Ziehen dem Finger', Math.abs(hVor - 60 - hMitte) < 12, [hVor, hMitte]);
    await pt.mouse.up(); await pt.waitForTimeout(400);
  }
  pruef('Blatt: am Titel langsam ein Stück nach unten rastet wieder ein', ['mittel', 'klein'].includes(await stufe()) && await pt.evaluate(() => !document.querySelector('#panel').style.height), await stufe());
  await zuStufe('mittel');
  await ziehen('#seitenTitel', 250, 4);
  pruef('Blatt: am Titel nach unten ziehen klappt es zu', await stufe() === 'klein', await stufe());
  await pt.tap('#seitenTitel'); await pt.waitForTimeout(400);
  pruef('Blatt: Titel antippen klappt es wieder auf', await stufe() === 'mittel', await stufe());
  await ziehen('#seitenTitel', -320, 30);
  pruef('Blatt: am Titel nach oben ziehen macht es groß', await stufe() === 'gross', await stufe());
  // Wisch im Inhalt (Touch): steht er oben, klappt das Blatt eine Stufe zu; ist er gescrollt, scrollt er nur
  const wisch = (dy, scroll) => pt.evaluate(([dy, scroll]) => new Promise(fertig => {
    const el = document.querySelector('#panel .inhalt'); el.scrollTop = scroll;
    const ziel = document.querySelector('#zeitplan') || el, r = el.getBoundingClientRect(), x = r.left + 100, y0 = r.top + 60;
    const t = y => new Touch({ identifier: 1, target: ziel, clientX: x, clientY: y });
    const send = (typ, y) => ziel.dispatchEvent(new TouchEvent(typ, { bubbles: true, cancelable: true, touches: typ === 'touchend' ? [] : [t(y)], changedTouches: [t(y)] }));
    send('touchstart', y0);
    let i = 0;
    const schritt = () => { i++; send('touchmove', y0 + dy * i / 6); if (i < 6) setTimeout(schritt, 16); else { send('touchend', y0 + dy); setTimeout(fertig, 400); } };
    setTimeout(schritt, 16);
  }), [dy, scroll]);
  await wisch(260, 40);
  pruef('Blatt: Wisch im gescrollten Inhalt klappt nicht zu', await stufe() === 'gross', await stufe());
  await wisch(260, 0);
  pruef('Blatt: Wisch nach unten im Inhalt (oben) klappt eine Stufe zu', await stufe() === 'mittel', await stufe());
  await zuStufe('mittel');
  // Info-Fenster am Telefon: geht über dem Blatt auf, nicht dahinter (auch wenn knapp über dem Blatt angetippt)
  // (das Fadenkreuz ist hier noch an; mit ihm holt ein Tipp die Stelle unters Kreuz, darum kurz aus)
  await pt.evaluate(() => { document.querySelector('#bKreuz').click(); document.querySelector('#bInfo').click(); });
  await pt.waitForTimeout(500);
  {
    // knapp unter der Suche angetippt: das Fenster ginge nach oben unter die Suchleiste, die Karte muss es herunterschieben
    // (unter dem Info-Hinweis, der unter der Suche steht)
    const hinweisUnten = await pt.evaluate(() => document.querySelector('#infoHinweis').getBoundingClientRect().bottom);
    await pt.touchscreen.tap(150, hinweisUnten + 20);
    await pt.waitForSelector('.info-liste button', { timeout: 8000 });
    await pt.waitForTimeout(600);
    const lage = await pt.evaluate(() => { const p = document.querySelector('.leaflet-popup').getBoundingClientRect(); return { oben: p.top, unten: p.bottom,
      blatt: document.querySelector('#panel').getBoundingClientRect().top, suche: document.querySelector('#infoHinweis').getBoundingClientRect().bottom }; });
    pruef("Telefon: Info-Fenster über dem Blatt und unter Suche und Hinweis", lage.unten <= lage.blatt && lage.oben >= lage.suche, lage);
    await pt.evaluate(() => { document.querySelector('.leaflet-popup-close-button').click(); document.querySelector('#bInfoAus').click(); document.querySelector('#bKreuz').click(); });
    await pt.waitForTimeout(500);
  }
  // Runde mit Wunschlänge ab dem Start: vier Punkte (Start, zwei Ecken, Start), andere Richtung ändert die Ecken
  await pt.tap('#bKreuz');
  await blattStufe(false);
  const klick = sel => pt.evaluate(q => document.querySelector(q).click(), sel);
  await klick('#bMehr');
  await klick('#bRunde');
  pruef('Runde: Auswahl der Länge sichtbar', await pt.evaluate(() => !document.querySelector('#rundFeld').hidden));
  await pt.selectOption('#rundLaenge', '8');
  await klick('#bRundeLos');
  await pt.waitForFunction(() => !document.querySelector('#bRundeLos').disabled && document.querySelector('#meldung').textContent.includes('Runde'), null, { timeout: 15000 });
  const runde = await pt.evaluate(() => JSON.parse(localStorage.getItem('gug.entwurf')).wps);
  pruef('Runde: Start, zwei Ecken, zurück zum Start', runde.length === 4 && runde[0].lat === runde[3].lat && runde[0].lon === runde[3].lon &&
    Math.abs(runde[0].lat - 47.7535) < 1e-6, runde);
  pruef('Runde: Meldung mit Länge', /Runde: [\d,]+ km \(gewünscht 8(,0)? km\)/.test(await pt.textContent('#meldung')), await pt.textContent('#meldung'));
  await klick('#bRundeAnders');
  await pt.waitForFunction(() => !document.querySelector('#bRundeLos').disabled, null, { timeout: 15000 });
  const runde2 = await pt.evaluate(() => JSON.parse(localStorage.getItem('gug.entwurf')).wps);
  pruef('Runde: andere Richtung, gleicher Start', runde2.length === 4 && runde2[0].lat === runde[0].lat && (runde2[1].lat !== runde[1].lat || runde2[1].lon !== runde[1].lon));
  await klick('#bZurueck'); await pt.waitForTimeout(600);
  pruef('Runde: Rückgängig holt die vorige Runde zurück', JSON.stringify((await pt.evaluate(() => JSON.parse(localStorage.getItem('gug.entwurf')).wps))) === JSON.stringify(runde));
  // während die Runde noch rechnet, „Neu“: die überholte Runde darf die neue (leere) Planung nicht überschreiben
  await pt.evaluate(() => { document.querySelector('#bRundeLos').click(); setTimeout(() => document.querySelector('#bNeu').click(), 30); });
  await pt.waitForFunction(() => !document.querySelector('#bRundeLos').disabled, null, { timeout: 15000 });
  await pt.waitForTimeout(800);
  pruef('Runde: „Neu“ während der Berechnung gewinnt', (await pt.evaluate(() => JSON.parse(localStorage.getItem('gug.entwurf')).wps.length)) === 0);
  pruef('Telefon: keine Fehler', telFehler.length === 0, telFehler);

  await browser.close();
  srv.close();
  console.log('Klicktest: ' + ok + ' bestanden, ' + fehler + ' fehlgeschlagen · Anfragen ' + JSON.stringify(zaehler));
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
