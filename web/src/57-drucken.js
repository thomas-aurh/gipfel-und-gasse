// Karte drucken (oder als PDF speichern): Kopf mit Kennzahlen und Stopps, Karte mit Route, Höhenprofil unten.
// Die Seite bekommt dafür die Klasse „druck“; die Karte hat dann schon auf dem Bildschirm A4-Maße,
// damit Leaflet die Kacheln für genau diesen Ausschnitt lädt.
let druckLaeuft = false;
let druckName = null;   // Titel des Druckauftrags in der App (das Heft einer Reise setzt ihn kurz)
$('bDrucken').onclick = async () => {
  const e = S.ergebnis;
  if (!e || druckLaeuft) return;
  druckLaeuft = true;
  // Papier ist weiß: für den Druck die helle Palette, das Profil damit neu zeichnen (druckEnde stellt zurück)
  document.documentElement.dataset.thema = 'hell';
  if (!$('profilbox').hidden) profilZeichnen();
  const besicht = S.fest ? 0 : besichtigung();
  const teile = [R.kmText(e.laenge), R.zeitText(e.zeit + besicht / 60) + (besicht ? ' inkl. Besichtigung' : '')];
  if (e.tief != null) teile.push('↑ ' + e.auf + ' m', '↓ ' + e.ab + ' m', 'höchster Punkt ' + e.hoch + ' m');
  if (e.sac) teile.push(e.sac.text);
  const stopps = S.wps.filter(w => w.name).map(w => w.name + (w.min ? ' (' + w.min + ' min)' : ''));
  // ohne den Wanderer der Ladeanzeige: als Bild gilt das CSS der Seite nicht, er wäre sonst mitten im Logo zu sehen
  const logo = $('logo').querySelector('svg') && $('logo').querySelector('svg').cloneNode(true);
  if (logo) logo.querySelectorAll('.wanderer').forEach(w => w.remove());
  const logoBild = logo ? '<img class="druck-logo" alt="" src="data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(logo)) + '">' : '';
  // Mehrtagestour: je Tag eine Zeile mit Strecke, Höhenmetern, Gehzeit und Start (eigene Startzeit je Tag)
  const et = etappenAktuell();
  const tag0 = $('startTag').value ? new Date($('startTag').value + 'T12:00') : null;
  const etZeilen = et ? et.map((s, k) => {
    let besicht = 0;
    if (!S.fest) for (let i = k === 0 ? 0 : s.von + 1; i <= s.bis; i++) besicht += +S.wps[i].min || 0;
    const datum = tag0 ? new Date(tag0.getFullYear(), tag0.getMonth(), tag0.getDate() + k, 12).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' }) + ' · ' : '';
    const ziel = S.wps[s.bis].name || (k === et.length - 1 ? 'Ziel' : 'Übernachtung ' + (k + 1));
    return '<li><b>Tag ' + (k + 1) + '</b> · ' + R.esc(datum + 'bis ' + ziel + (k < et.length - 1 ? ' 🛏' : '') + ' · ' + R.kmText(s.meter) + ' · ↑ ' + s.auf + ' m · ↓ ' + s.ab + ' m · ' +
      R.zeitText(s.zeit + besicht / 60) + (tagStart(k) ? ' · Start ' + tagStart(k) : '')) + '</li>';
  }) : [];
  $('druckkopf').innerHTML = logoBild + '<h1>' + R.esc((S.name || '').trim() || 'Tour') + '</h1><div>' + R.esc(teile.join(' · ')) + '</div>' +
    (stopps.length ? '<div class="stopps">Stopps: ' + R.esc(stopps.join(' → ')) + '</div>' : '') +
    (etZeilen.length ? '<ol class="druck-etappen">' + etZeilen.join('') + '</ol>' : '');
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
  themaSetzen(thema, false);
  karte.invalidateSize();
}
window.addEventListener('afterprint', druckEnde);
