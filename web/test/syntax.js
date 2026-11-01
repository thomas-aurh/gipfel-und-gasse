// Prüft die Skripte in der fertigen HTML-Datei auf Syntaxfehler (ohne sie auszuführen).
// Fängt Fehler, die in den Einzeldateien nicht auffallen, z. B. ein kaputter Zusammenbau.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const teile = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
let fehler = 0;
teile.forEach((js, i) => { try { new Function(js); } catch (e) { console.error('Skript ' + (i + 1) + ': ' + e.message); fehler++; } });
if (teile.length < 2) { console.error('Erwartet: Leaflet und App-Skript, gefunden: ' + teile.length); fehler++; }
if (!fehler) console.log(process.argv[2] + ': ' + teile.length + ' Skripte in Ordnung');
process.exit(fehler ? 1 : 0);
