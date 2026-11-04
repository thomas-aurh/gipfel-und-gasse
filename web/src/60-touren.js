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
    // erneutes Speichern behält das ursprüngliche Datum (Statistik je Jahr)
    name, datum: ((liste.find(t => t.id === (S.tourId || '')) || {}).datum) || new Date().toISOString(),
    profil: S.profil, tempo: S.tempo, pace: S.pace,
    wps: S.fest ? null : S.wps.map(w => (w.name || w.min || w.info || w.nacht) ? [+w.lat.toFixed(6), +w.lon.toFixed(6), w.name || '', +w.min || 0].concat(w.info || w.nacht ? [w.info || 0] : [], w.nacht ? [1] : []) : [+w.lat.toFixed(6), +w.lon.toFixed(6)]),
    modus: S.modus,
    zeit: S.fest ? null : zeitplanLesen(),
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
// extra (aus GPX-Dateien): profil, punkte [[lat, lon, Name, Art]], quelle, dateiDauer
function spurAlsTour(name, pts, art, extra) {
  extra = extra || {};
  const profil = PROFILE[extra.profil] ? extra.profil : 'wandern', pArt = PROFILE[profil].art;
  const e = R.auswerten([{ pts, abschnitte: [] }], pArt === 'lauf' ? S.pace : S.tempo, pArt);
  const liste = tourenLesen();
  const tour = { id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, datum: new Date().toISOString(), profil, tempo: S.tempo, pace: S.pace, wps: null,
    spur: spurPacken(e.pts), stuecke: null, art, kurz: { laenge: e.laenge, auf: e.auf, ab: e.ab, zeit: e.zeit } };
  if (extra.punkte && extra.punkte.length) tour.punkte = extra.punkte;
  if (extra.quelle) tour.quelle = extra.quelle;
  if (extra.dateiDauer) tour.dateiDauer = extra.dateiDauer;
  liste.unshift(tour);
  if (!tourenSchreiben(liste)) return false;
  tourenZeigen();
  melde('Gespeichert: ' + name);
  if (art === 'aufzeichnung') gipfelNachTour(liste[0]);   // Gipfelbuch (im Hintergrund, braucht Paket oder Netz)
  return liste[0].id;
}
function tagsText(t) { return Object.entries(t).map(([k, v]) => k + '=' + v).join(' '); }

// Einstieg „Letzte Tour“ im leeren Planen: die zuletzt gespeicherte geplante Tour
function letzteTourZeigen() {
  const t = tourenLesen().find(x => x.art === 'plan');
  $('eLetzte').hidden = !t;
  if (!t) return;
  $('eLetzte').dataset.id = t.id;
  $('eLetzteName').textContent = t.name + (t.kurz && t.kurz.laenge ? ' · ' + R.kmText(t.kurz.laenge) : '');
}
$('eLetzte').onclick = () => tourAnsehen($('eLetzte').dataset.id);
$('eAufz').onclick = () => reiter('unterwegs');

// Tourseite: die Tour liegt geöffnet auf der Karte; hier Kennzahlen und die nächsten Schritte (Los, Bearbeiten, Teilen)
function tourAnsehen(id) {
  parkLauf++; $('tParkListe').innerHTML = ''; $('tParkStatus').hidden = true;
  tourOeffnen(id);
  if (S.tourId === id) reiter('tour');
}
function tourSeiteZeigen() {
  const t = tourenLesen().find(x => x.id === S.tourId);
  $('tourName').textContent = S.name || (t && t.name) || 'Tour';
  $('tourArt').textContent = t ? tourZeichen(t) + ' ' + ({ aufzeichnung: 'gegangen', spur: 'GPX-Spur' }[t.art] || 'geplant') + (t.quelle ? ' aus ' + t.quelle : '') +
    ' · gespeichert am ' + new Date(t.datum).toLocaleDateString('de-DE') : '';
  const zahl = (id, text) => '<div class="zahl"><b>' + R.esc($(id).textContent) + '</b><span>' + R.esc(text) + '</span></div>';
  $('tourZahlen').innerHTML = S.ergebnis ? zahl('zLaenge', 'Strecke') + zahl('zZeit', $('zZeitText').textContent) + zahl('zAuf', 'Aufstieg') +
    zahl('zAb', 'Abstieg') + zahl('zHoch', 'Höchster Punkt') + zahl('zSchwer', 'Schwierigkeit') +
    (t && t.dateiDauer ? '<div class="zahl"><b>' + R.esc(R.zeitText(t.dateiDauer, true)) + '</b><span>Dauer laut Datei</span></div>' : '') : '';
  dateiPunkteZeigen(t);
  tourFotosZeigen(t);
  $('tLos').disabled = !S.ergebnis || !!S.rechnet;
  $('tLos').textContent = /beenden/.test($('bNavi').textContent) ? '🧭 Zur Navigation' : '▶ Los';
  $('tTeilen').hidden = $('bTeilen').hidden; $('tTeilen').disabled = $('bTeilen').disabled;
  $('tGpx').disabled = $('bGpx').disabled; $('tDrucken').disabled = $('bDrucken').disabled;
  tourAnreiseZeigen();
}
// Wegpunkte aus der GPX-Datei (z. B. Highlights aus komoot): auf der Karte und als Liste mit Lage an der Strecke
const PUNKT_ZEICHEN = { gipfel: '⛰️', einkehr: '🏠', parken: '🅿️', punkt: '📍' };
function dateiPunkteZeigen(t) {
  const ul = $('tourPunkte');
  ebeneDateiPunkte.clearLayers();
  ul.innerHTML = '';
  const pk = (t && t.punkte) || [];
  $('tourPunkteBox').hidden = !pk.length;
  if (!pk.length) return;
  const pts = S.ergebnis && S.ergebnis.pts;
  const liste = pk.map(p => {
    const lage = pts && pts.length > 1 ? R.aufStrecke(pts, { lat: p[0], lon: p[1] }) : null;
    return { lat: p[0], lon: p[1], name: p[2] || 'Wegpunkt', art: p[3], d: lage ? lage.d : null, abw: lage ? lage.abw : null };
  }).sort((a, b) => (a.d == null ? 1e9 : a.d) - (b.d == null ? 1e9 : b.d));
  $('tourPunkteTitel').textContent = 'Wegpunkte aus der Datei (' + liste.length + ')';
  for (const p of liste) {
    const z = PUNKT_ZEICHEN[p.art] || '📍';
    const wo = p.d != null ? 'bei ' + R.kmText(p.d) + (p.abw > 100 ? ' · ' + R.kmText(p.abw) + ' abseits' : '') : '';
    const m = L.marker([p.lat, p.lon], { icon: L.divIcon({ className: '', html: '<div class="ort-mk">' + z + '</div>', iconSize: [30, 30], iconAnchor: [15, 15] }) })
      .bindPopup('<b>' + z + ' ' + R.esc(p.name) + '</b>' + (wo ? '<br><span class="klein">' + R.esc(wo) + '</span>' : '')).addTo(ebeneDateiPunkte);
    const li = document.createElement('li');
    li.innerHTML = '<span class="zeichen">' + z + '</span><span class="was">' + R.esc(p.name) + (wo ? '<small>' + R.esc(wo) + '</small>' : '') + '</span>';
    li.onclick = () => { karte.setView([p.lat, p.lon], Math.max(karte.getZoom(), 15)); m.openPopup(); };
    ul.appendChild(li);
  }
}

// Anreise zum Start (Google Maps) und Parkplätze in der Nähe (OpenStreetMap, Kartenpaket oder Overpass)
function tourAnreiseZeigen() {
  const p = S.ergebnis && S.ergebnis.pts[0];
  ['tOepnv', 'tAuto', 'tParken'].forEach(id => { $(id).hidden = !p; });
  if (!p) return;
  $('tOepnv').href = R.anreiseLink(p.lat, p.lon, 'oepnv');
  $('tAuto').href = R.anreiseLink(p.lat, p.lon, 'auto');
}
let parkLauf = 0;
$('tParken').onclick = async () => {
  const p = S.ergebnis && S.ergebnis.pts[0];
  if (!p) return;
  const nr = ++parkLauf, st = $('tParkStatus'), ul = $('tParkListe');
  st.hidden = false; st.textContent = 'Suche Parkplätze bis 1 km um den Start …'; ul.innerHTML = '';
  try {
    const json = await orteHolen([{ lat: p.lat, lon: p.lon }], 1000);
    if (nr !== parkLauf) return;
    const plaetze = R.parkplaetze(R.orteLesen(json, null), p).slice(0, 6);
    st.textContent = plaetze.length ? plaetze.length + (plaetze.length === 1 ? ' Parkplatz' : ' Parkplätze') + ' bis 1 km um den Start' + (json.offline ? ' (aus dem Kartenpaket)' : '') + ':'
      : 'Kein öffentlicher Parkplatz bis 1 km um den Start in OpenStreetMap.';
    ebeneOrte.clearLayers();
    for (const o of plaetze) {
      const li = document.createElement('li');
      li.innerHTML = '<span class="zeichen">🅿️</span><span class="was">' + R.esc(o.name) + '<small>' + R.esc(R.parkText(o)) + '</small></span>' +
        '<a class="knopf" target="_blank" rel="noopener" href="' + R.esc(R.anreiseLink(o.lat, o.lon, 'auto')) + '">🚗 hin</a>';
      li.querySelector('a').onclick = ev => ev.stopPropagation();
      li.onclick = () => karte.setView([o.lat, o.lon], Math.max(karte.getZoom(), 16));
      ul.appendChild(li);
      L.marker([o.lat, o.lon], { icon: L.divIcon({ className: '', html: '<div class="ort-mk">🅿️</div>', iconSize: [30, 30], iconAnchor: [15, 15] }) })
        .bindPopup('<b>🅿️ ' + R.esc(o.name) + '</b><br><span class="klein">' + R.esc(R.parkText(o)) + '</span>').addTo(ebeneOrte);
    }
  } catch (err) {
    if (nr === parkLauf) st.textContent = 'Parkplätze nicht abrufbar: ' + err.message;
  }
};

$('tLos').onclick = () => {
  const laeuft = /beenden/.test($('bNavi').textContent);
  reiter('unterwegs');
  if (!laeuft) $('bNavi').click();
};
$('tBearbeiten').onclick = () => reiter('planen');
$('tTeilen').onclick = () => $('bTeilen').click();
$('tGpx').onclick = () => $('bGpx').click();
$('tDrucken').onclick = () => $('bDrucken').click();

function tourOeffnen(id) {
  const t = tourenLesen().find(x => x.id === id);
  if (!t) return;
  ebeneDateiPunkte.clearLayers();
  // Wegpunkte einer GPX-Tour bleiben auch im Planen auf der Karte, solange die Tour offen ist
  if (t.punkte) setTimeout(() => { if (S.tourId === t.id) dateiPunkteZeigen(t); }, 0);
  const pts = spurEntpacken(t.spur);
  lauf++;   // eine noch laufende Berechnung darf die geöffnete Tour nicht überschreiben
  S.rechnet = false;   // sie setzt das selbst nicht mehr zurück
  S.verlauf = []; S.tourId = t.id; S.name = t.name; $('tourname').value = t.name; zeitplanSetzen(t.zeit);
  S.profil = t.profil || 'wandern'; $('profilwahl').value = S.profil;
  // Tempo der Tour wiederherstellen, damit Geh- und Restzeit stimmen
  if (t.tempo && [...$('tempowahl').options].some(o => +o.value === +t.tempo)) { S.tempo = +t.tempo; $('tempowahl').value = String(S.tempo); }
  if (t.pace && [...$('pacewahl').options].some(o => +o.value === +t.pace)) { S.pace = +t.pace; $('pacewahl').value = String(S.pace); }
  if (t.wps && t.stuecke) {
    // geplante Tour: Teilstücke aus der Spur zurückbauen, damit nichts neu angefragt werden muss
    S.fest = null;
    S.wps = t.wps.map(w => w.length > 2 ? Object.assign({ lat: w[0], lon: w[1], name: w[2] || undefined, min: w[3] || 0 }, w[4] ? { info: w[4] } : {}, w[5] === 1 ? { nacht: true } : {}) : { lat: w[0], lon: w[1] });
    if (t.modus) modusSetzen(t.modus, { karte: true });
    S.stuecke = planEntpacken(S.wps, S.profil, t.spur, t.stuecke);
    S.stueckeFuer = stueckSignatur();
    zeichenWegpunkte();
    auswertenUndZeigen();
    // ältere Tour ohne Abbiegehinweise: im Hintergrund neu rechnen (scheitert das, bleibt die gespeicherte Linie)
    if (t.stuecke.some(s => s.q === 'brouter' && !s.h)) neuBerechnen();
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
  lauf++; S.rechnet = false;
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
  // Kennungen aus einer Sicherung können Zeichen wie " oder ] enthalten
  const li = document.querySelector('[data-tour="' + CSS.escape(id) + '"]');
  if (li && !li.dataset.sicher) {
    li.dataset.sicher = '1';
    li.querySelector('.was small').textContent = 'Nochmal 🗑 tippen löscht die Tour.';
    setTimeout(() => { if (li.isConnected) { delete li.dataset.sicher; tourenZeigen(); } }, 4000);
    return;
  }
  if (!tourenSchreiben(tourenLesen().filter(x => x.id !== id))) return;   // Speicher gesperrt: nichts ändern, Meldung steht schon
  if (S.tourId === id) S.tourId = null;
  tourenZeigen();
  melde('Gelöscht: ' + t.name);
}

function tourZeichen(t) {
  return t.art === 'aufzeichnung' ? '⏺' : t.art === 'spur' ? '📄' : (t.profil === 'rad' ? '🚲' : t.modus === 'stadt' || t.profil === 'stadt' ? '🏛️' : '🥾');
}

// gespeicherte Touren als Punkte am Start: geplante blau umrandet, gegangene (Aufzeichnungen) grün mit Haken
function tourenPunkte(liste) {
  ebeneTouren.clearLayers();
  for (const t of liste) {
    // nur der erste Punkt: die Spur nicht ganz entpacken
    const a = t.spur && t.spur.length ? { lat: t.spur[0][0], lon: t.spur[0][1] } : t.wps && t.wps[0] ? { lat: t.wps[0][0], lon: t.wps[0][1] } : null;
    if (!a) continue;
    const gegangen = t.art === 'aufzeichnung';
    const m = L.marker([a.lat, a.lon], {
      title: t.name, zIndexOffset: -500,
      icon: L.divIcon({ className: '', html: '<div class="tour-mk ' + (gegangen ? 'gegangen' : 'geplant') + '">' + (gegangen ? '✓' : tourZeichen(t)) + '</div>', iconSize: [28, 28], iconAnchor: [14, 14] })
    });
    m.bindPopup(() => {
      const box = document.createElement('div');
      box.innerHTML = '<b>' + R.esc(t.name) + '</b><br><span class="klein">' + (gegangen ? 'gegangen' : t.art === 'spur' ? 'GPX-Spur' : 'geplant') + ' · ' +
        R.kmText(t.kurz.laenge) + ' · ↑ ' + Math.round(+t.kurz.auf || 0) + ' m · ' + R.zeitText(t.kurz.zeit) + ' · ' + new Date(t.datum).toLocaleDateString('de-DE') + '</span><br>';
      const k = document.createElement('button');
      k.className = 'popup-knopf'; k.textContent = 'Öffnen';
      k.onclick = () => { karte.closePopup(); tourAnsehen(t.id); };
      box.appendChild(k);
      return box;
    });
    m.addTo(ebeneTouren);
  }
}

// Touren getrennt: geplante (Planungen und geöffnete GPX-Spuren) und gegangene (Aufzeichnungen) mit Statistik
function tourenZeigen() {
  const liste = tourenLesen();
  tourenPunkte(liste);
  const gegangen = liste.filter(t => t.art === 'aufzeichnung'), geplant = liste.filter(t => t.art !== 'aufzeichnung');
  listeZeigen($('tourliste'), geplant, 'Noch keine geplanten Touren. Plane eine Route und tippe auf 💾 Speichern, oder öffne eine GPX-Datei.');
  listeZeigen($('gangliste'), gegangen, 'Noch keine gegangenen Touren. Unter „Unterwegs“ aufzeichnen, danach „Als Tour speichern“.');
  const sum = (f) => gegangen.reduce((s, t) => s + (+t.kurz[f] || 0), 0);
  // gemessene Dauer und Aufnahmetag aus den Zeitstempeln der Spur; ohne Zeitstempel die geschätzte Gehzeit und das Speicherdatum
  const dauer = t => { const a = t.spur[0] && t.spur[0][3], b = t.spur[t.spur.length - 1] && t.spur[t.spur.length - 1][3]; return a && b > a ? (b - a) / 3.6e6 : (+t.kurz.zeit || 0); };
  const tag = t => (t.spur[0] && t.spur[0][3]) ? new Date(t.spur[0][3]) : new Date(t.datum);
  const jahr = new Date().getFullYear(), diesesJahr = gegangen.filter(t => tag(t).getFullYear() === jahr);
  $('gangStatistik').innerHTML = gegangen.length ? [
    [gegangen.length, gegangen.length === 1 ? 'Tour' : 'Touren'], [R.kmText(sum('laenge')), 'Strecke'], [Math.round(sum('auf')) + ' m', 'bergauf'],
    [R.zeitText(gegangen.reduce((s, t) => s + dauer(t), 0), true), 'unterwegs'], [diesesJahr.length, 'Touren ' + jahr], [R.kmText(diesesJahr.reduce((s, t) => s + (+t.kurz.laenge || 0), 0)), 'Strecke ' + jahr]
  ].map(([w, t]) => '<div class="zahl"><b>' + R.esc(String(w)) + '</b><span>' + R.esc(t) + '</span></div>').join('') : '';
  $('gangStatistik').hidden = !gegangen.length;
  zeitraeumeZeigen(gegangen);
}

// Suchen, Sortieren und (bei geplanten) Art: die Leiste über der Liste erscheint ab drei Touren
function tourArt(t) {
  if (t.art === 'spur') return 'spur';
  if (t.profil === 'laufen') return 'laufen';
  if (t.profil === 'rad') return 'rad';
  if (t.modus === 'stadt' || t.profil === 'stadt') return 'stadt';
  return 'wandern';
}
function tourenFiltern(liste, f) {
  const suche = (f.querySelector('.tf-suche').value || '').trim().toLowerCase();
  const art = f.querySelector('.tf-art') ? f.querySelector('.tf-art').value : '';
  const fam = R.FAMILIE[f.querySelector('.tf-familie') ? f.querySelector('.tf-familie').value : ''];
  const sort = f.querySelector('.tf-sort').value;
  const kurz = (t, k) => +((t.kurz || {})[k]) || 0;
  const wann = t => Date.parse(t.datum) || 0;
  const aus = liste.filter(t => (!suche || String(t.name || '').toLowerCase().includes(suche)) && (!art || tourArt(t) === art) &&
    (!fam || (kurz(t, 'laenge') <= fam.meter && kurz(t, 'auf') <= fam.hm)));
  const vergleich = { neu: (a, b) => wann(b) - wann(a), alt: (a, b) => wann(a) - wann(b), name: (a, b) => String(a.name).localeCompare(String(b.name), 'de'),
    lang: (a, b) => kurz(b, 'laenge') - kurz(a, 'laenge'), kurz: (a, b) => kurz(a, 'laenge') - kurz(b, 'laenge'), hm: (a, b) => kurz(b, 'auf') - kurz(a, 'auf') }[sort];
  return vergleich ? aus.slice().sort(vergleich) : aus;
}
document.querySelectorAll('.tourfilter').forEach(f => {
  f.querySelectorAll('input, select').forEach(e => e.addEventListener(e.tagName === 'INPUT' ? 'input' : 'change', () => {
    // die gewählte Familien-Grenze gilt auch für den Familien-Check im Planen
    if (e.classList.contains('tf-familie') && e.value) SPEICHER.schreiben('familie', e.value);
    tourenZeigen();
  }));
});

function listeZeigen(ul, liste, leer) {
  ul.innerHTML = '';
  if (!liste.length) { ul.innerHTML = '<li style="cursor:default"><span class="was klein">' + R.esc(leer) + '</span></li>'; return; }
  const f = document.querySelector('.tourfilter[data-liste="' + ul.id + '"]');
  if (f) {
    f.hidden = liste.length < 3;
    if (!f.hidden) {
      liste = tourenFiltern(liste, f);
      if (!liste.length) { ul.innerHTML = '<li style="cursor:default"><span class="was klein">Keine Tour passt zur Suche.</span></li>'; return; }
    }
  }
  for (const t of liste) {
    const li = document.createElement('li');
    li.dataset.tour = t.id;
    const zeichen = tourZeichen(t);
    // Öffnen ist ein echter Knopf, damit es auch mit Tastatur und Bildschirmleser geht
    li.innerHTML = '<span class="zeichen">' + zeichen + '</span><button class="was oeffnen" title="Tour öffnen">' + R.esc(t.name) + '<small>' +
      R.kmText(t.kurz.laenge) + ' · ↑ ' + Math.round(+t.kurz.auf || 0) + ' m · ' + R.zeitText(t.kurz.zeit) + ' · ' + new Date(t.datum).toLocaleDateString('de-DE') + '</small></button>' +
      '<span class="aktionen"><button title="Als GPX herunterladen">⬇</button><button title="Löschen">🗑</button></span>';
    li.onclick = () => tourAnsehen(t.id);
    const [bG, bL] = li.querySelectorAll('.aktionen button');
    bG.onclick = ev => { ev.stopPropagation(); gpxHerunter(t.name, spurEntpacken(t.spur), t.wps ? t.wps.map((w, i) => ({ lat: w[0], lon: w[1], name: w[2] || (i === 0 ? 'Start' : 'Punkt ' + (i + 1)) })) : []); };
    bL.onclick = ev => { ev.stopPropagation(); tourLoeschen(t.id); };
    ul.appendChild(li);
  }
}

function dateiname(name) { return (name || 'tour').replace(/[^\wäöüÄÖÜß -]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'tour'; }

// Datei ausgeben: im Browser herunterladen; die App ersetzt das durch das Teilen-Menü (75-app.js)
function dateiAusgeben(datei, text, mime) {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = datei;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function gpxHerunter(name, pts, wps) {
  dateiAusgeben(dateiname(name) + '.gpx', R.gpxSchreiben(name, pts, wps), 'application/gpx+xml');
}

// Sicherung: alle Touren samt Planung (Wegpunkte, Stücke, Hinweise) als eine Datei; Laden ergänzt, was fehlt
// Das Reisetagebuch kommt samt Fotos mit (65-tagebuch.js)
async function sicherungSpeichern() {
  const liste = tourenLesen();
  const tb = await tagebuchFuerSicherung();
  const ziele = zieleLesenSp();
  if (!liste.length && !tb.tagebuch.reisen.length && !ziele.ziele.length && !Object.keys(gipfelbuchLesen().gipfel).length) { melde('Keine Touren, kein Tagebuch, keine Reiseziele und kein Gipfelbuch gespeichert.'); return; }
  const tag = new Date().toISOString().slice(0, 10);
  dateiAusgeben('gipfel-und-gasse-sicherung-' + tag + '.json',
    JSON.stringify({ app: 'gipfel-und-gasse', version: 1, erstellt: new Date().toISOString(), touren: liste, tagebuch: tb.tagebuch, fotos: tb.fotos, reiseziele: ziele, gipfelbuch: gipfelbuchLesen() }), 'application/json');
  // nicht still: ein Foto, das sich nicht lesen ließ, fehlt in dieser Sicherung
  if (tb.fehlen) melde('Achtung: ' + tb.fehlen + (tb.fehlen === 1 ? ' Foto ließ' : ' Fotos ließen') + ' sich nicht lesen und fehlen in der Sicherung.', 8);
}

async function sicherungEinlesen(text) {
  const neu = R.sicherungLesen(text);
  const liste = tourenLesen(), ids = new Set(liste.map(t => t.id));
  const dazu = neu.filter(t => !ids.has(t.id));
  // die drei Teile unabhängig: passen die Touren nicht in den Speicher, kommen Tagebuch und Reiseziele trotzdem
  const tourenOk = !dazu.length || tourenSchreiben(dazu.concat(liste));
  const tb = await tagebuchEinlesen(text);
  const zl = zieleEinlesen(text);
  const gb = gipfelbuchEinlesen(text);
  tourenZeigen();
  const teile = [];
  if (!tourenOk) teile.push(dazu.length + ' Touren NICHT übernommen (Speicher voll)');
  else if (dazu.length) teile.push(dazu.length + ' Touren übernommen' + (neu.length > dazu.length ? ' (' + (neu.length - dazu.length) + ' waren schon da)' : ''));
  if (tb) teile.push(tb + ' Reisen und Tagebuch-Einträge übernommen');
  if (zl) teile.push(zl + ' Reiseziele übernommen');
  if (gb) teile.push(gb + ' Gipfelbesuche ins Gipfelbuch übernommen');
  melde(teile.length ? 'Aus der Sicherung: ' + teile.join(', ') + '.' : 'Alles aus der Sicherung ist schon da.', 6);
}

$('bSpeichern').onclick = tourSpeichern;
$('bGpx').onclick = () => {
  if (!S.ergebnis) return;
  const n = (S.name || '').trim() || 'Gipfel-und-Gasse-Tour';
  gpxHerunter(n, S.ergebnis.pts, S.wps.map((w, i) => ({ lat: w.lat, lon: w.lon, name: w.name || (i === 0 ? 'Start' : i === S.wps.length - 1 ? 'Ziel' : 'Punkt ' + (i + 1)) })));
};
// nicht still scheitern: wer sich auf die Sicherung verlässt, muss wissen, dass keine Datei entstand
$('bSichern').onclick = () => sicherungSpeichern().catch(e => melde('Sicherung fehlgeschlagen: ' + (e && e.message || e) + '. Es wurde keine Datei gespeichert.', 10));
$('bSicherungLaden').onclick = () => $('sicherungDatei').click();
$('sicherungDatei').onchange = async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try { await sicherungEinlesen(await f.text()); } catch (err) { melde('Sicherung nicht lesbar: ' + err.message, 6); }
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

// GPX laden (Touren und Menü › Werkzeuge): jede Datei kommt gleich als geplante Tour (Spur) in die Liste;
// eine Datei öffnet danach ihre Tourseite, mehrere die Liste „Geplant“
$('bGpxOeffnen').onclick = () => $('gpxDatei').click();
$('bMenueGpx').onclick = () => { menue(false); $('gpxDatei').click(); };
$('gpxDatei').onchange = async e => {
  const dateien = [...e.target.files];
  e.target.value = '';
  if (!dateien.length) return;
  const neu = [], fehler = [];
  for (const f of dateien) {
    try {
      const g = R.gpxLesen(await f.text());
      let pts = g.pts.length ? g.pts : g.wpt;
      if (pts.length < 2) throw new Error('weniger als zwei Punkte');
      pts = pts.map(p => { const q = { lat: p.lat, lon: p.lon, ele: p.ele }; if (p.t) q.t = p.t; if (p.luecke) q.luecke = true; return q; });
      if (pts.some(p => p.ele == null)) { melde('Höhen fehlen in ' + f.name + ', werden ergänzt …'); await hoehenFuellen(pts); }
      const punkte = (g.pts.length ? g.wpt : []).slice(0, 200).map(w => [+w.lat.toFixed(6), +w.lon.toFixed(6), w.name || '', R.gpxPunktArt(w.sym, w.name)]);
      const id = spurAlsTour(g.name || f.name.replace(/\.gpx$/i, ''), pts, 'spur',
        { profil: R.gpxProfil(g.typ), punkte, quelle: g.quelle, dateiDauer: R.gpxDauer(pts) });
      if (!id) throw new Error('Speicher voll');
      neu.push(id);
    } catch (err) {
      fehler.push(f.name + ': ' + err.message);
    }
  }
  if (neu.length === 1) tourAnsehen(neu[0]);
  else if (neu.length) reiter('touren');
  const text = (neu.length ? (neu.length === 1 ? '1 Tour' : neu.length + ' Touren') + ' unter „Geplant“ gespeichert.' : '') +
    (fehler.length ? ' Nicht lesbar: ' + fehler.join('; ') : '');
  melde(text.trim(), fehler.length ? 8 : 5);
};

// Woche und Monat im Vergleich, darunter Kilometer der letzten 12 Monate als Säulen (Wert beim Antippen, Tabelle zum Aufklappen)
function zeitraeumeZeigen(gegangen) {
  const st = R.statistik(gegangen, Date.now());
  const km = z => (z.km >= 10 ? Math.round(z.km) : Math.round(z.km * 10) / 10).toLocaleString('de-DE') + ' km';
  const zeile = (name, z, vor, vorName) => '<b>' + name + ':</b> ' + km(z) + ' · ' + z.touren + (z.touren === 1 ? ' Tour' : ' Touren') +
    (z.auf ? ' · ↑ ' + Math.round(z.auf) + ' m' : '') + ' <span class="klein">(' + vorName + ' ' + km(vor) + ')</span>';
  $('gangZeitraum').innerHTML = zeile('Diese Woche', st.woche, st.vorwoche, 'Vorwoche') + '<br>' + zeile('Dieser Monat', st.monat, st.vormonat, 'Vormonat');
  $('gangZeitraum').hidden = !gegangen.length;
  const fig = $('gangMonate');
  fig.hidden = !gegangen.length;
  if (!gegangen.length) return;
  const max = Math.max(...st.monate.map(m => m.km));
  const maxI = st.monate.findIndex(m => m.km === max);
  const wert = m => km(m) + ', ' + m.touren + (m.touren === 1 ? ' Tour' : ' Touren');
  fig.innerHTML = '<figcaption>Kilometer je Monat</figcaption><div class="saeulen" role="img" aria-label="Kilometer der letzten 12 Monate">' +
    st.monate.map((m, i) => {
      const h = max > 0 ? Math.round(m.km / max * 100) : 0;
      // Zahl nur am höchsten und am aktuellen Monat (nicht an jeder Säule)
      const zahl = (i === maxI || i === 11) && m.km > 0 ? '<b style="bottom:calc(' + h + '% + 2px)">' + km(m).replace(' km', '') + '</b>' : '';
      return '<button type="button" class="saeule" title="' + R.esc(m.name + ' ' + m.jahr + ': ' + wert(m)) + '" aria-label="' + R.esc(m.name + ' ' + m.jahr + ': ' + wert(m)) + '">' +
        '<i style="height:' + h + '%"></i>' + zahl + '</button>';
    }).join('') + '</div><div class="namen">' + st.monate.map(m => '<span>' + R.esc(m.name.slice(0, 3)) + '</span>').join('') + '</div>' +
    '<details><summary>Als Tabelle</summary><table><tr><th>Monat</th><th>Strecke</th><th>Touren</th></tr>' +
    st.monate.slice().reverse().map(m => '<tr><td>' + R.esc(m.name + ' ' + m.jahr) + '</td><td>' + km(m) + '</td><td>' + m.touren + '</td></tr>').join('') + '</table></details>';
  // Antippen zeigt den Wert (am Telefon gibt es kein Überfahren)
  fig.querySelectorAll('.saeule').forEach(b => { b.onclick = () => melde(b.getAttribute('aria-label'), 3); });
}
