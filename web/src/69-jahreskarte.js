// Jahreskarte: alle gegangenen Touren eines Jahres auf einer Karte (Farbe je Monat), dazu Summen, Rekorde und die Gipfel
// des Jahres aus dem Gipfelbuch. Unter Ich › Touren › Gegangen; „✕“ im Hinweis über der Karte blendet sie aus.
const JAHR = { an: null };   // gezeigtes Jahr oder null
const ebeneJahr = L.layerGroup().addTo(karte);

// Auswahl der Jahre und Text zum gewählten Jahr (aus zeitraeumeZeigen, wenn sich die Liste ändert)
function jahrBoxZeigen() {
  const touren = tourenLesen(), jahre = R.tourJahre(touren), sel = $('jahrWahl');
  $('jahrBox').hidden = !jahre.length;
  if (!jahre.length) { if (JAHR.an != null) jahresKarteAus(); return; }
  const vorher = +sel.value;
  sel.innerHTML = jahre.map(j => '<option value="' + j + '">' + j + '</option>').join('');
  sel.value = String(jahre.includes(vorher) ? vorher : jahre[0]);
  jahrTextZeigen();
}
function jahrTextZeigen() {
  const r = R.jahresRueckblick(tourenLesen(), gipfelbuchLesen(), +$('jahrWahl').value);
  const zahl = x => Math.round(x).toLocaleString('de-DE');
  const teile = [r.touren.length + (r.touren.length === 1 ? ' Tour' : ' Touren') + ' an ' + r.tage + (r.tage === 1 ? ' Tag' : ' Tagen'),
    zahl(r.km) + ' km', '↑ ' + zahl(r.auf) + ' m', R.zeitText(r.stunden) + ' unterwegs'];
  if (r.gipfel.length) teile.push(r.gipfel.length + (r.gipfel.length === 1 ? ' Gipfel' : ' Gipfel') + ' (höchster: ' + r.gipfel[0].name + (r.gipfel[0].ele ? ' ' + r.gipfel[0].ele + ' m' : '') + ')');
  let html = '<b>' + r.jahr + ':</b> ' + R.esc(teile.join(' · '));
  if (r.laengste) html += '<br>Längste: ' + R.esc(r.laengste.name + ' (' + R.kmText(+r.laengste.kurz.laenge || 0) + ')');
  if (r.meisteHm) html += (r.laengste ? ' · ' : '<br>') + 'meiste Höhenmeter: ' + R.esc(r.meisteHm.name + ' (↑ ' + zahl(r.meisteHm.kurz.auf) + ' m)');
  // Farben der Monate, nur die mit Touren
  const monate = r.monate.map((km, m) => km > 0 ? '<span class="jahr-monat"><i style="background:' + R.monatFarbe(m) + '"></i>' +
    R.esc(new Date(2000, m, 1).toLocaleDateString('de-DE', { month: 'short' }).replace('.', '')) + '</span>' : '').join('');
  if (monate) html += '<div class="jahr-monate">' + monate + '</div>';
  $('jahrText').innerHTML = html;
  $('bJahrKarte').textContent = JAHR.an === r.jahr ? '✕ Jahreskarte ausblenden' : '🗺 Auf der Karte zeigen';
}
$('jahrWahl').onchange = () => { if (JAHR.an != null) jahresKarte(+$('jahrWahl').value); else jahrTextZeigen(); };
$('bJahrKarte').onclick = () => { if (JAHR.an === +$('jahrWahl').value) jahresKarteAus(); else jahresKarte(+$('jahrWahl').value); };
$('bJahrAus').onclick = () => jahresKarteAus();

function jahresKarte(jahr) {
  const r = R.jahresRueckblick(tourenLesen(), gipfelbuchLesen(), jahr);
  ebeneJahr.clearLayers();
  const grenzen = L.latLngBounds([]);
  for (const t of r.touren) {
    if (!Array.isArray(t.spur)) continue;
    const farbe = R.monatFarbe(new Date(R.tourZeit(t)).getMonth());
    const fenster = () => {
      const box = document.createElement('div');
      box.innerHTML = '<b>' + R.esc(t.name) + '</b><br><span class="klein">' + R.esc(new Date(R.tourZeit(t)).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long' }) +
        ' · ' + R.kmText(+t.kurz.laenge || 0) + (t.kurz.auf ? ' · ↑ ' + Math.round(t.kurz.auf) + ' m' : '')) + '</span><br>';
      const k = document.createElement('button');
      k.className = 'popup-knopf'; k.textContent = 'Tour öffnen';
      k.onclick = () => { karte.closePopup(); tourAnsehen(t.id); };
      box.appendChild(k);
      return box;
    };
    for (const teil of R.spurTeile(spurEntpacken(t.spur))) {
      const ll = R.ausduennen(teil, 15).map(p => [p.lat, p.lon]);
      if (ll.length < 2) continue;
      L.polyline(ll, { color: '#fff', weight: 7, opacity: 0.8, interactive: false }).addTo(ebeneJahr);
      L.polyline(ll, { color: farbe, weight: 4, opacity: 0.95, className: 'jahr-spur' }).bindPopup(fenster).addTo(ebeneJahr);
      grenzen.extend(ll);
    }
  }
  for (const g of r.gipfel) {
    L.circleMarker([g.lat, g.lon], { radius: 6, color: '#fff', weight: 2, fillColor: '#5a3e1b', fillOpacity: 1 })
      .bindTooltip('⛰️ ' + g.name + (g.ele ? ' ' + g.ele + ' m' : '') + (g.mal > 1 ? ' · ' + g.mal + '×' : '')).addTo(ebeneJahr);
  }
  JAHR.an = jahr;
  $('jahrHinweisText').textContent = '🗺 ' + jahr + ': ' + r.touren.length + (r.touren.length === 1 ? ' Tour' : ' Touren') + ' · ' + Math.round(r.km).toLocaleString('de-DE') + ' km';
  $('jahrHinweis').hidden = false;
  jahrTextZeigen();
  reiter('karte');
  // erst wenn das Blatt am Telefon eingeklappt ist, sonst rechnet einpassen mit dem offenen Blatt
  if (grenzen.isValid()) setTimeout(() => { if (JAHR.an === jahr) einpassen(grenzen); }, 300);
}
function jahresKarteAus() {
  JAHR.an = null;
  ebeneJahr.clearLayers();
  $('jahrHinweis').hidden = true;
  if (!$('jahrBox').hidden) jahrTextZeigen();
}
