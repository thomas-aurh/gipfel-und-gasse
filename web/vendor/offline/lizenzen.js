// Sammelt die Lizenztexte aller Pakete, die esbuild ins Offline-Bündel gepackt hat (aus der Metadatei).
// Aufruf: node vendor/offline/lizenzen.js dist/offline-meta.json > dist/offline-lizenzen.txt
const fs = require('fs');
const path = require('path');
const meta = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const wurzel = path.join(__dirname, '..', '..', '..', 'node_modules');
const pakete = new Set();
for (const k of Object.keys(meta.inputs)) { const t = k.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/); if (t) pakete.add(t[1]); }
// BSD-3-Text für Pakete ohne eigene Lizenzdatei (Lizenzangabe in package.json, Rechteinhaber Protomaps LLC)
const bsd3 = inhaber => `Copyright (c) ${inhaber}\nAll rights reserved.\n\nRedistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:\n1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.\n2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.\n3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.\n\nTHIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.\n`;
let fehlt = 0;
for (const p of [...pakete].sort()) {
  const dir = path.join(wurzel, p);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const datei = fs.readdirSync(dir).find(f => /^licen[sc]e/i.test(f));
  let text = datei ? fs.readFileSync(path.join(dir, datei), 'utf8') : null;
  if (!text && pkg.license === 'BSD-3-Clause' && /protomaps/i.test(JSON.stringify([pkg.repository, pkg.homepage]) + p)) text = bsd3('Protomaps LLC');
  if (!text) { console.error('Lizenztext fehlt: ' + p); fehlt++; continue; }
  process.stdout.write('\n===== ' + p + ' ' + pkg.version + ' (' + pkg.license + ') =====\n' + text.replace(/\*\//g, '* /'));
}
process.exit(fehlt ? 1 : 0);
