// Meine Touren: speichern, öffnen, GPX hinein und hinaus, Link teilen
function tourenLesen() { return SPEICHER.lesen('touren', []); }
function tourenSchreiben(liste) {
  if (!SPEICHER.schreiben('touren', liste)) { melde('Speichern ging nicht: Der Browser-Speicher ist voll oder gesperrt.', 6); return false; }
  return true;
}

// Spur platzsparend: [lat, lon, ele] mit 5 Nachkommastellen und ganzen Metern
// Spur platzsparend: [lat, lon, ele] und, nur wenn vorhanden, Zeit (ms) und Lücken-Merker
function spurPacken(pts) {
  return pts.map(p => {
    const x = [+p.lat.toFixed(5), +p.lon.toFixed(5), p.ele == null ? null : Math.round(p.ele)];
    if (p.t || p.luecke) x.push(p.t || 0);
    if (p.luecke) x.push(1);
    return x;
  });
}
function spurEntpacken(a) {
  return a.map(x => { const p = { lat: x[0], lon: x[1], ele: x[2] }; if (x[3]) p.t = x[3]; if (x[4]) p.luecke = true; return p; });
}

function tourSpeichern() {
  const e = S.ergebnis;
  if (!e) return;
  const liste = tourenLesen();
  const name = (S.name || '').trim() || (S.fest ? 'Spur' : 'Tour') + ' vom ' + new Date().toLocaleDateString('de-DE');
  const tour = {
    id: S.tourId || ('t' + Date.now().toString(36)),
    name, datum: new Date().toISOString(),
    profil: S.profil, tempo: S.tempo,
    wps: S.fest ? null : S.wps.map(w => (w.name || w.min) ? [+w.lat.toFixed(6), +w.lon.toFixed(6), w.name || '', +w.min || 0] : [+w.lat.toFixed(6), +w.lon.toFixed(6)]),
    modus: S.modus,
    spur: spurPacken(e.pts),
    stuecke: S.fest ? null : planPacken().stuecke,
    art: S.fest ? (S.fest.art || 'spur') : 'plan',
    kurz: { laenge: e.laenge, auf: e.auf, ab: e.ab, zeit: e.zeit + (S.fest ? 0 : besichtigung() / 60) }
  };
  const i = liste.findIndex(t => t.id === tour.id);
  if (i >= 0) liste[i] = tour; else liste.unshift(tour);
  if (!tourenSchreiben(liste)) return;
  S.tourId = tour.id; S.name = name; $('tourname').value = name;
  entwurfSichern();
  tourenZeigen();
  melde('Gespeichert: ' + name);
}
// Spur (z. B. Aufzeichnung) direkt ablegen, ohne die offene Planung zu ersetzen
function spurAlsTour(name, pts, art) {
  const e = R.auswerten([{ pts, abschnitte: [] }], S.tempo, 'fuss');
  const liste = tourenLesen();
  liste.unshift({ id: 't' + Date.now().toString(36), name, datum: new Date().toISOString(), profil: 'wandern', tempo: S.tempo, wps: null,
    spur: spurPacken(e.pts), stuecke: null, art, kurz: { laenge: e.laenge, auf: e.auf, ab: e.ab, zeit: e.zeit } });
  if (!tourenSchreiben(liste)) return false;
  tourenZeigen();
  melde('Gespeichert: ' + name);
  return true;
}
function tagsText(t) { return Object.entries(t).map(([k, v]) => k + '=' + v).join(' '); }

function tourOeffnen(id) {
  const t = tourenLesen().find(x => x.id === id);
  if (!t) return;
  const pts = spurEntpacken(t.spur);
  lauf++;   // eine noch laufende Berechnung darf die geöffnete Tour nicht überschreiben
  S.verlauf = []; S.tourId = t.id; S.name = t.name; $('tourname').value = t.name;
  S.profil = t.profil || 'wandern'; $('profilwahl').value = S.profil;
  // Tempo der Tour wiederherstellen, damit Geh- und Restzeit stimmen
  if (t.tempo && [...$('tempowahl').options].some(o => +o.value === +t.tempo)) { S.tempo = +t.tempo; $('tempowahl').value = String(S.tempo); }
  if (t.wps && t.stuecke) {
    // geplante Tour: Teilstücke aus der Spur zurückbauen, damit nichts neu angefragt werden muss
    S.fest = null;
    S.wps = t.wps.map(w => w.length > 2 ? { lat: w[0], lon: w[1], name: w[2] || undefined, min: w[3] || 0 } : { lat: w[0], lon: w[1] });
    if (t.modus) modusSetzen(t.modus, { karte: true });
    S.stuecke = planEntpacken(S.wps, S.profil, t.spur, t.stuecke);
    S.stueckeFuer = stueckSignatur();
    zeichenWegpunkte();
    auswertenUndZeigen();
    $('status').textContent = '';
  } else {
    spurAnzeigen(pts, t.name, t.art);
  }
  entwurfSichern();
  if (S.ergebnis) einpassen(L.latLngBounds(S.ergebnis.pts.map(p => [p.lat, p.lon])));
  reiter('planen');
}

// feste Spur (GPX oder Aufzeichnung) anzeigen
function spurAnzeigen(pts, name, art) {
  lauf++;
  S.verlauf = [];
  S.wps = []; S.fest = { pts, art: art || 'spur', abschnitte: [] };
  S.stuecke = [{ pts, abschnitte: [], quelle: 'spur' }];
  S.name = name || ''; $('tourname').value = S.name;
  zeichenWegpunkte();
  auswertenUndZeigen();
  $('status').innerHTML = '<div class="hinweis">Geöffnete Spur: Strecke und Höhen stammen aus der Datei. Wegtypen kennt Gipfel & Gasse hier nicht. Für eine neue Planung „✕ Neu“.</div>';
}

function tourLoeschen(id) {
  const t = tourenLesen().find(x => x.id === id);
  if (!t) return;
  const li = document.querySelector('[data-tour="' + id + '"]');
  if (li && !li.dataset.sicher) {
    li.dataset.sicher = '1';
    li.querySelector('.was small').textContent = 'Nochmal 🗑 tippen löscht die Tour.';
    setTimeout(() => { if (li.isConnected) { delete li.dataset.sicher; tourenZeigen(); } }, 4000);
    return;
  }
  tourenSchreiben(tourenLesen().filter(x => x.id !== id));
  if (S.tourId === id) S.tourId = null;
  tourenZeigen();
  melde('Gelöscht: ' + t.name);
}

function tourenZeigen() {
  const liste = tourenLesen(), ul = $('tourliste');
  ul.innerHTML = '';
  if (!liste.length) { ul.innerHTML = '<li style="cursor:default"><span class="was klein">Noch keine Touren. Plane eine Route und tippe auf 💾 Speichern, oder öffne eine GPX-Datei.</span></li>'; return; }
  for (const t of liste) {
    const li = document.createElement('li');
    li.dataset.tour = t.id;
    const zeichen = t.art === 'aufzeichnung' ? '⏺' : t.art === 'spur' ? '📄' : (t.profil === 'rad' ? '🚲' : t.modus === 'stadt' || t.profil === 'stadt' ? '🏛️' : '🥾');
    // Öffnen ist ein echter Knopf, damit es auch mit Tastatur und Bildschirmleser geht
    li.innerHTML = '<span class="zeichen">' + zeichen + '</span><button class="was oeffnen" title="Tour öffnen">' + R.esc(t.name) + '<small>' +
      R.kmText(t.kurz.laenge) + ' · ↑ ' + t.kurz.auf + ' m · ' + R.zeitText(t.kurz.zeit) + ' · ' + new Date(t.datum).toLocaleDateString('de-DE') + '</small></button>' +
      '<span class="aktionen"><button title="Als GPX herunterladen">⬇</button><button title="Löschen">🗑</button></span>';
    li.onclick = () => tourOeffnen(t.id);
    const [bG, bL] = li.querySelectorAll('.aktionen button');
    bG.onclick = ev => { ev.stopPropagation(); gpxHerunter(t.name, spurEntpacken(t.spur), t.wps ? t.wps.map((w, i) => ({ lat: w[0], lon: w[1], name: w[2] || (i === 0 ? 'Start' : 'Punkt ' + (i + 1)) })) : []); };
    bL.onclick = ev => { ev.stopPropagation(); tourLoeschen(t.id); };
    ul.appendChild(li);
  }
}

function dateiname(name) { return (name || 'tour').replace(/[^\wäöüÄÖÜß -]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'tour'; }

function gpxHerunter(name, pts, wps) {
  const blob = new Blob([R.gpxSchreiben(name, pts, wps)], { type: 'application/gpx+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = dateiname(name) + '.gpx';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

$('bSpeichern').onclick = tourSpeichern;
$('bGpx').onclick = () => {
  if (!S.ergebnis) return;
  const n = (S.name || '').trim() || 'Gipfel-und-Gasse-Tour';
  gpxHerunter(n, S.ergebnis.pts, S.wps.map((w, i) => ({ lat: w.lat, lon: w.lon, name: w.name || (i === 0 ? 'Start' : i === S.wps.length - 1 ? 'Ziel' : 'Punkt ' + (i + 1)) })));
};
$('bAlleGpx').onclick = () => {
  const liste = tourenLesen();
  if (!liste.length) { melde('Keine Touren gespeichert.'); return; }
  liste.forEach((t, i) => setTimeout(() => gpxHerunter(t.name, spurEntpacken(t.spur), []), i * 400));
};
$('bTeilen').onclick = async () => {
  if (!S.wps.length) return;
  const url = location.href.split('#')[0] + '#' + R.linkSchreiben(S.profil, S.wps);
  if (location.protocol === 'file:') melde('Hinweis: Die Datei liegt nur auf diesem Gerät; der Link öffnet die Tour nur, wo Gipfel & Gasse unter derselben Adresse liegt.', 7);
  try {
    if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) { await navigator.share({ title: S.name || 'Gipfel-und-Gasse-Tour', url }); return; }
    await navigator.clipboard.writeText(url);
    melde('Link kopiert.');
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    $('status').innerHTML = '<div class="hinweis">Link zum Kopieren:<br><input class="feld" readonly value="' + R.esc(url) + '" onclick="this.select()"></div>';
  }
};

$('bGpxOeffnen').onclick = () => $('gpxDatei').click();
$('gpxDatei').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const text = await f.text();
    const g = R.gpxLesen(text);
    let pts = g.pts.length ? g.pts : g.wpt;
    if (pts.length < 2) throw new Error('Die Datei hat weniger als zwei Punkte.');
    pts = pts.map(p => { const q = { lat: p.lat, lon: p.lon, ele: p.ele }; if (p.t) q.t = p.t; if (p.luecke) q.luecke = true; return q; });
    if (pts.some(p => p.ele == null)) { melde('Höhen fehlen in der Datei, werden ergänzt …'); await hoehenFuellen(pts); }
    S.tourId = null;   // importierte Datei ist eine neue Tour, sie ersetzt keine geöffnete
    spurAnzeigen(pts, g.name || f.name.replace(/\.gpx$/i, ''), 'spur');
    einpassen(L.latLngBounds(pts.map(p => [p.lat, p.lon])));
    reiter('planen');
    melde('Geöffnet: ' + (g.name || f.name) + '. Mit 💾 Speichern in „Touren“ ablegen.', 5);
  } catch (err) {
    melde('GPX nicht lesbar: ' + err.message, 6);
  }
};
