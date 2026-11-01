// Karte drucken (oder als PDF speichern): Kopf mit Kennzahlen und Stopps, Karte mit Route, Höhenprofil unten.
// Die Seite bekommt dafür die Klasse „druck“; die Karte hat dann schon auf dem Bildschirm A4-Maße,
// damit Leaflet die Kacheln für genau diesen Ausschnitt lädt.
let druckLaeuft = false;
$('bDrucken').onclick = async () => {
  const e = S.ergebnis;
  if (!e || druckLaeuft) return;
  druckLaeuft = true;
  const besicht = S.fest ? 0 : besichtigung();
  const teile = [R.kmText(e.laenge), R.zeitText(e.zeit + besicht / 60) + (besicht ? ' inkl. Besichtigung' : '')];
  if (e.tief != null) teile.push('↑ ' + e.auf + ' m', '↓ ' + e.ab + ' m', 'höchster Punkt ' + e.hoch + ' m');
  if (e.sac) teile.push(e.sac.text);
  const stopps = S.wps.filter(w => w.name).map(w => w.name + (w.min ? ' (' + w.min + ' min)' : ''));
  const logo = $('logo').querySelector('svg');
  const logoBild = logo ? '<img class="druck-logo" alt="" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(logo)) + '">' : '';
  $('druckkopf').innerHTML = logoBild + '<h1>' + R.esc((S.name || '').trim() || 'Tour') + '</h1><div>' + R.esc(teile.join(' · ')) + '</div>' +
    (stopps.length ? '<div class="stopps">Stopps: ' + R.esc(stopps.join(' → ')) + '</div>' : '');
  const c = $('profil');
  const bild = !$('profilbox').hidden && c.width ? '<img alt="Höhenprofil" src="' + c.toDataURL('image/png') + '">' : '';
  const quelle = karte.attributionControl.getContainer().textContent.replace(/\s+/g, ' ').trim();
  $('druckfuss').innerHTML = bild + '<p>' + R.esc(quelle) + ' · erstellt mit Gipfel & Gasse am ' + new Date().toLocaleDateString('de-DE') +
    '. Ohne Gewähr: vor Ort zählen Beschilderung und Wetter.</p>';
  document.body.classList.add('druck');
  karte.invalidateSize();
  karte.fitBounds(L.latLngBounds(e.pts.map(p => [p.lat, p.lon])), { padding: [24, 24], maxZoom: 17 });
  await kachelnGeladen(4000);
  druckLaeuft = false;
  try {
    const r = window.print();
    // in der Android-App liefert print ein Versprechen, das sich erfüllt, wenn der Druckdialog fertig ist
    if (r && typeof r.then === 'function') { r.then(druckEnde, err => { druckEnde(); melde('Drucken ging nicht: ' + (err.message || err)); }); return; }
  } catch (err) { melde('Drucken ging nicht: ' + err.message); }
  // manche Browser feuern afterprint nicht zuverlässig: nach dem Dialog sicher zurück
  setTimeout(druckEnde, 500);
};

function kachelnGeladen(ms) {
  return new Promise(res => {
    const basis = LAGEN[lagenWahl.basis] || LAGEN.topo;   // gewählte Karte (noch) nicht da: topografisch wird gezeigt
    let fertig = false;
    const ende = () => { if (!fertig) { fertig = true; basis.off('load', ende); res(); } };
    basis.on('load', ende);
    setTimeout(ende, ms);
  });
}

function druckEnde() {
  if (!document.body.classList.contains('druck')) return;
  document.body.classList.remove('druck');
  karte.invalidateSize();
}
window.addEventListener('afterprint', druckEnde);
