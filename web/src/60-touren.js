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
    wps: S.fest ? null : S.wps.map(w => (w.name || w.min) ? [+w.lat.toFixed(6), +w.lon.toFixed(6), w.name || '', +w.min || 0] : [+w.lat.toFixed(6), +w.lon.toFixed(6)]),
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
  S.verlauf = []; S.tourId = t.id; S.name = t.name; $('tourname').value = t.name; zeitplanSetzen(t.zeit);
  S.profil = t.profil || 'wandern'; $('profilwahl').value = S.profil;
  // Tempo der Tour wiederherstellen, damit Geh- und Restzeit stimmen
  if (t.tempo && [...$('tempowahl').options].some(o => +o.value === +t.tempo)) { S.tempo = +t.tempo; $('tempowahl').value = String(S.tempo); }
  if (t.pace && [...$('pacewahl').options].some(o => +o.value === +t.pace)) { S.pace = +t.pace; $('pacewahl').value = String(S.pace); }
  if (t.wps && t.stuecke) {
    // geplante Tour: Teilstücke aus der Spur zurückbauen, damit nichts neu angefragt werden muss
    S.fest = null;
    S.wps = t.wps.map(w => w.length > 2 ? { lat: w[0], lon: w[1], name: w[2] || undefined, min: w[3] || 0 } : { lat: w[0], lon: w[1] });
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
      k.onclick = () => { karte.closePopup(); tourOeffnen(t.id); };
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

function listeZeigen(ul, liste, leer) {
  ul.innerHTML = '';
  if (!liste.length) { ul.innerHTML = '<li style="cursor:default"><span class="was klein">' + R.esc(leer) + '</span></li>'; return; }
  for (const t of liste) {
    const li = document.createElement('li');
    li.dataset.tour = t.id;
    const zeichen = tourZeichen(t);
    // Öffnen ist ein echter Knopf, damit es auch mit Tastatur und Bildschirmleser geht
    li.innerHTML = '<span class="zeichen">' + zeichen + '</span><button class="was oeffnen" title="Tour öffnen">' + R.esc(t.name) + '<small>' +
      R.kmText(t.kurz.laenge) + ' · ↑ ' + Math.round(+t.kurz.auf || 0) + ' m · ' + R.zeitText(t.kurz.zeit) + ' · ' + new Date(t.datum).toLocaleDateString('de-DE') + '</small></button>' +
      '<span class="aktionen"><button title="Als GPX herunterladen">⬇</button><button title="Löschen">🗑</button></span>';
    li.onclick = () => tourOeffnen(t.id);
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
  if (!liste.length && !tb.tagebuch.reisen.length && !ziele.ziele.length) { melde('Keine Touren, kein Tagebuch und keine Reiseziele gespeichert.'); return; }
  const tag = new Date().toISOString().slice(0, 10);
  dateiAusgeben('gipfel-und-gasse-sicherung-' + tag + '.json',
    JSON.stringify({ app: 'gipfel-und-gasse', version: 1, erstellt: new Date().toISOString(), touren: liste, tagebuch: tb.tagebuch, fotos: tb.fotos, reiseziele: ziele }), 'application/json');
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
  tourenZeigen();
  const teile = [];
  if (!tourenOk) teile.push(dazu.length + ' Touren NICHT übernommen (Speicher voll)');
  else if (dazu.length) teile.push(dazu.length + ' Touren übernommen' + (neu.length > dazu.length ? ' (' + (neu.length - dazu.length) + ' waren schon da)' : ''));
  if (tb) teile.push(tb + ' Reisen und Tagebuch-Einträge übernommen');
  if (zl) teile.push(zl + ' Reiseziele übernommen');
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
