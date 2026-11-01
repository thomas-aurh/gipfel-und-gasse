// Erzeugt App-Symbole und Startbilder für Android aus web/src/logo.svg (Playwright + Chromium).
// Aufruf: node werkzeuge/symbole.js   (die erzeugten PNG liegen im Repo, das Skript ist nur zum Erneuern)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const wurzel = path.join(__dirname, '..');
const res = path.join(wurzel, 'android/app/src/main/res');
const logo = fs.readFileSync(path.join(wurzel, 'web/src/logo.svg'), 'utf8');

function groesse(f) { const b = fs.readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  async function bild(datei, w, h, hg, anteil, rund) {
    const d = Math.round(Math.min(w, h) * anteil);
    await page.setViewportSize({ width: w, height: h });
    await page.setContent('<body style="margin:0;width:' + w + 'px;height:' + h + 'px;display:flex;align-items:center;justify-content:center;background:' + hg + ';' +
      (rund ? 'border-radius:50%;overflow:hidden;' : '') + '"><div style="width:' + d + 'px;height:' + d + 'px">' + logo.replace('<svg ', '<svg width="100%" height="100%" ') + '</div></body>');
    await page.screenshot({ path: datei, omitBackground: hg === 'transparent' });
  }
  for (const ordner of fs.readdirSync(res).filter(o => o.startsWith('mipmap-') && !o.includes('anydpi'))) {
    const d = path.join(res, ordner);
    const [w] = groesse(path.join(d, 'ic_launcher.png'));
    await bild(path.join(d, 'ic_launcher.png'), w, w, 'transparent', 1, false);
    await bild(path.join(d, 'ic_launcher_round.png'), w, w, 'transparent', 1, false);
    const [f] = groesse(path.join(d, 'ic_launcher_foreground.png'));
    // adaptives Symbol: sichtbar sind 72 von 108 dp, das Abzeichen füllt davon den Großteil
    await bild(path.join(d, 'ic_launcher_foreground.png'), f, f, 'transparent', 70 / 108, false);
  }
  for (const ordner of fs.readdirSync(res).filter(o => o.startsWith('drawable'))) {
    const f = path.join(res, ordner, 'splash.png');
    if (!fs.existsSync(f)) continue;
    const [w, h] = groesse(f);
    await bild(f, w, h, '#fbfcf9', 0.32, false);
  }
  await browser.close();
  console.log('Symbole erneuert');
})();
