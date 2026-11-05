// Gerätetest im Android-Emulator (GitHub Actions, Job „emulator“): die echte App startet, die Oberfläche lädt im
// WebView, der Navigationsdienst läuft mit einer Position aus dem Emulator (adb emu geo fix) und hört wieder auf.
// Aufruf: node web/test/emulator.js <app-debug.apk>   (adb muss laufen, ein Emulator verbunden sein)
// Die Oberfläche erreicht der Test über die Entwicklerschnittstelle der WebView (nur in Debug-Bauten an).
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAKET = 'io.github.thomasaurh.gipfelundgasse';
const APK = process.argv[2];
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
let ok = 0, fehler = 0;
function pruef(name, bed, info) {
  if (bed) { ok++; console.log('✓ ' + name); }
  else { fehler++; console.error('✗ ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); }
}
const adb = (...a) => execFileSync('adb', a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const schlaf = ms => new Promise(r => setTimeout(r, ms));
async function warten(was, bed, sek) {
  const ende = Date.now() + sek * 1000;
  for (;;) {
    let v; try { v = await bed(); } catch (e) { v = null; }
    if (v) return v;
    if (Date.now() > ende) { console.error('… gewartet auf: ' + was); return null; }
    await schlaf(1000);
  }
}
// Emulator: Länge zuerst, dann Breite
const ort = (lat, lon) => adb('emu', 'geo', 'fix', String(lon), String(lat));
const dienstLaeuft = () => /NaviService/.test(adb('shell', 'dumpsys', 'activity', 'services', PAKET));

(async () => {
  adb('install', '-r', '-g', APK);   // -g: alle Erlaubnisse aus dem Manifest gleich erteilen (Standort, Mitteilungen)
  for (const e of ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION', 'POST_NOTIFICATIONS']) {
    try { adb('shell', 'pm', 'grant', PAKET, 'android.permission.' + e); } catch (err) { /* ältere Android-Fassung */ }
  }
  adb('logcat', '-c');
  ort(47.7535, 11.3747);
  adb('shell', 'am', 'start', '-W', '-n', PAKET + '/.MainActivity');

  // WebView-Entwicklerschnittstelle der App suchen und weiterleiten
  const pid = await warten('Prozess der App', () => adb('shell', 'pidof', PAKET).trim(), 60);
  pruef('Emulator: App startet (Prozess läuft)', !!pid, pid);
  const sock = await warten('WebView-Schnittstelle', () => {
    const m = adb('shell', 'cat', '/proc/net/unix').match(new RegExp('@(webview_devtools_remote_' + pid + ')\\b'));
    return m && m[1];
  }, 90);
  if (!sock) throw new Error('keine WebView-Schnittstelle (Debug-Bau?)');
  adb('forward', 'tcp:9222', 'localabstract:' + sock);
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const page = await warten('Seite der App', () => browser.contexts().flatMap(c => c.pages()).find(p => /localhost/.test(p.url())), 60);
  await page.waitForFunction(() => window.__gugBereit, null, { timeout: 90000 });
  pruef('Emulator: Oberfläche geladen, als App erkannt', await page.evaluate(() => !!(window.Capacitor && window.Capacitor.isNativePlatform())));
  pruef('Emulator: Leiste mit fünf Bereichen', (await page.$$('nav.reiter button')).length === 5);

  // Route folgen wie die App (75-app.js): Strecke an den Dienst, Vordergrunddienst mit Mitteilung
  const pts = [[47.7535, 11.3747, 600, 0], [47.7570, 11.3780, 620, 0], [47.7600, 11.3800, 640, 0], [47.7650, 11.3900, 660, 0], [47.7700, 11.4000, 680, 0]];
  const st = await page.evaluate(async pts => {
    const Navi = window.Capacitor.registerPlugin('Navi');
    return Navi.starten({ pts, stopps: [], hinweise: [], folgen: true, aufzeichnen: false, ansagen: false, kmAnsage: false, tempo: 1 });
  }, pts);
  pruef('Emulator: Navigationsdienst nimmt die Route an', st && st.folgen === true, st);
  pruef('Emulator: Vordergrunddienst läuft', !!(await warten('Dienst', dienstLaeuft, 30)));
  const mitteilung = await warten('Mitteilung', () => {
    const d = adb('shell', 'dumpsys', 'notification', '--noredact');
    return d.includes('pkg=' + PAKET) ? d : null;
  }, 30);
  pruef('Emulator: Mitteilung des Dienstes', !!mitteilung);

  // Position auf der Route: der Dienst meldet sie und den Rest der Strecke
  let stand = null;
  for (let i = 0; i < 20 && !(stand && stand.rest && Math.abs(stand.lat - 47.7600) < 0.0005); i++) {
    ort(47.7600 + i * 0.000001, 11.3800);
    await schlaf(1500);
    stand = await page.evaluate(() => window.Capacitor.registerPlugin('Navi').status());
  }
  pruef('Emulator: Dienst bekommt die GPS-Position', stand && Math.abs(stand.lat - 47.7600) < 0.0005, stand);
  pruef('Emulator: Rest der Route gerechnet (weniger als die ganze Strecke)', stand && stand.rest && stand.rest.meter > 500 && stand.rest.meter < 2600, stand && stand.rest);
  try { fs.writeFileSync(path.join(OUT, 'emulator.png'), execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 })); } catch (e) { /* ohne Bild */ }

  // beenden: Dienst hört auf
  await page.evaluate(() => window.Capacitor.registerPlugin('Navi').starten({ folgen: false, aufzeichnen: false }));
  pruef('Emulator: Dienst endet mit „Beenden“', !!(await warten('Dienst aus', () => !dienstLaeuft(), 30)));

  const log = adb('logcat', '-d');
  const absturz = log.split('\n').filter(z => /FATAL EXCEPTION|AndroidRuntime.*gipfelundgasse/.test(z));
  pruef('Emulator: kein Absturz im Protokoll', !absturz.length, absturz.slice(0, 5));
  fs.writeFileSync(path.join(OUT, 'emulator-logcat.txt'), log);
  await browser.close().catch(() => {});
  console.log('Emulator: ' + ok + ' bestanden, ' + fehler + ' fehlgeschlagen');
  process.exit(fehler ? 1 : 0);
})().catch(e => { console.error('✗ Emulator: ' + (e && e.stack || e)); try { fs.writeFileSync(path.join(OUT, 'emulator-logcat.txt'), adb('logcat', '-d')); } catch (x) { /* egal */ } process.exit(1); });
