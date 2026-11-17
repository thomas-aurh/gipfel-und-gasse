// Schatten: wie viel der Route durch Wald führt (Planen › Vorbereiten). Waldflächen aus OpenStreetMap über Overpass,
// nur auf Knopfdruck und nur mit Netz (Wald ist nicht im Kartenpaket). Offene Stücke zeigt die Karte orange gestrichelt.
const SCHATTEN = { fuer: null, lauf: 0 };
const ebeneSchatten = L.layerGroup().addTo(karte);

// Punkte der Route von Meter a bis b (zum Zeichnen eines Stücks)
function routeStueck(pts, a, b) {
  const out = pts.filter(p => p.d >= a && p.d <= b).map(p => [p.lat, p.lon]);
  return out.length > 1 ? out : null;
}

$('bSchatten').onclick = async () => {
  const e = S.ergebnis;
  if (!e || e.pts.length < 2) return;
  const nr = ++SCHATTEN.lauf;
  SCHATTEN.fuer = e;
  $('schattenText').textContent = 'Suche Wald entlang der Route …';
  $('bSchatten').disabled = true;
  ebeneSchatten.clearLayers();
  try {
    if (navigator.onLine === false) throw new Error('ohne Netz (Waldflächen sind nicht im Kartenpaket)');
    const json = await overpassHolen(R.waldAbfrage(e.pts), 40);
    if (nr !== SCHATTEN.lauf || S.ergebnis !== e) return;   // inzwischen neu geplant
    const w = R.waldAnteil(e.pts, R.waldLesen(json));
    const pz = Math.round(w.anteil * 100);
    let text = (pz >= 60 ? '🌳 ' : pz >= 30 ? '🌤 ' : '☀️ ') + 'Etwa ' + pz + ' % im Wald (' + R.kmText(w.wald) + '), ' + R.kmText(w.offen) + ' offen.';
    if (w.sonne && w.sonne.bis - w.sonne.von >= 300) {
      const t = R.zeitZwischen(e.pts, w.sonne.von, w.sonne.bis, tempoAktuell(), artAktuell());
      text += ' Längstes Stück ohne Wald: bei ' + R.kmText(w.sonne.von) + ' bis ' + R.kmText(w.sonne.bis) + ' (' + R.kmText(w.sonne.bis - w.sonne.von) + ', etwa ' + R.zeitText(t) + ').';
    }
    let gezeichnet = 0;
    for (const s of w.stuecke) {
      if (s.wald || s.bis - s.von < 100) continue;
      const linie = routeStueck(e.pts, s.von, s.bis);
      if (linie) { L.polyline(linie, { color: '#e8890c', weight: 7, opacity: 0.85, dashArray: '8 8', interactive: false }).addTo(ebeneSchatten); gezeichnet++; }
    }
    if (gezeichnet) text += ' Offene Stücke ab 100 m sind auf der Karte orange gestrichelt.';
    $('schattenText').textContent = text;
  } catch (err) {
    if (nr === SCHATTEN.lauf) $('schattenText').textContent = 'Wald nicht abrufbar: ' + err.message;
  } finally { if (nr === SCHATTEN.lauf) $('bSchatten').disabled = false; }
};
// nach jeder Neuberechnung (zeitplanZeigen): altes Ergebnis weg; in der Stadt kein Thema
function schattenPruefen() {
  $('schattenBox').hidden = S.modus === 'stadt' || !S.ergebnis;
  if (SCHATTEN.fuer && SCHATTEN.fuer !== S.ergebnis) {
    SCHATTEN.fuer = null; SCHATTEN.lauf++;
    ebeneSchatten.clearLayers();
    $('schattenText').textContent = '';
    $('bSchatten').disabled = false;
  }
}
