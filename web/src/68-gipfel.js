// Gipfelbuch: erreichte Gipfel aus gegangenen Touren (Aufzeichnungen). Erkannt an der Spur: sie kommt bis auf 50 m an
// einen benannten Gipfel aus OpenStreetMap (aus dem Kartenpaket, sonst Overpass). Bleibt auf dem Gerät, kommt mit in die Sicherung.
function gipfelbuchLesen() { return R.gipfelbuchPruefen(SPEICHER.lesen('gipfelbuch', null)); }
function gipfelbuchSchreiben(buch) {
  if (SPEICHER.schreiben('gipfelbuch', buch)) return true;
  melde('Gipfelbuch nicht gespeichert: Der Speicher ist voll oder gesperrt.', 6);
  return false;
}

// Gipfel an einer Spur: ohne Netz aus der Orte-Datei des Pakets, sonst Overpass
async function gipfelAnSpur(pts) {
  if (pts.length < 2) return [];
  const off = await orteOffline(pts, 120);
  if (off) return R.gipfelErreicht(pts, off.elements);
  const j = await overpassHolen(R.gipfelAbfrage(pts, 120), 30);
  return R.gipfelErreicht(pts, j.elements || []);
}

// eine gegangene Tour ins Gipfelbuch; liefert { gefunden, neu }
async function gipfelFuerTour(t) {
  const gefunden = await gipfelAnSpur(spurEntpacken(t.spur));
  if (!gefunden.length) return { gefunden, neu: [] };
  const buch = gipfelbuchLesen();
  const neu = R.gipfelbuchDazu(buch, gefunden, { datum: t.datum, tour: t.id, name: t.name });
  gipfelbuchSchreiben(buch);
  return { gefunden, neu };
}

// gleich nach dem Speichern einer Aufzeichnung; ohne Netz und ohne Paket still (später „Touren durchsuchen“)
async function gipfelNachTour(t) {
  try {
    const { gefunden, neu } = await gipfelFuerTour(t);
    if (!gefunden.length) return;
    const namen = gefunden.map(g => g.name + (g.ele != null ? ' (' + g.ele + ' m)' : '')).join(', ');
    melde('⛰️ ' + (neu.length ? 'Neu im Gipfelbuch: ' : 'Wieder oben: ') + namen, 8);
    if (seite === 'gipfelbuch') gipfelbuchZeigen();
  } catch (e) { /* ohne Netz: über „Gegangene Touren durchsuchen“ nachholen */ }
}

function gipfelbuchZeigen() {
  const { liste, anzahl, besuche, hoechster } = R.gipfelbuchListe(gipfelbuchLesen());
  $('gbZahlen').innerHTML = anzahl ? [[anzahl, anzahl === 1 ? 'Gipfel' : 'Gipfel'], [besuche, besuche === 1 ? 'Besuch' : 'Besuche'],
    [hoechster ? hoechster.ele + ' m' : '–', hoechster ? 'höchster: ' + hoechster.name : 'höchster']]
    .map(([w, t]) => '<div class="zahl"><b>' + R.esc(String(w)) + '</b><span>' + R.esc(t) + '</span></div>').join('') : '';
  $('gbZahlen').hidden = !anzahl;
  const ul = $('gbListe');
  ul.innerHTML = '';
  if (!anzahl) { ul.innerHTML = '<li style="cursor:default"><span class="was klein">Noch keine Gipfel. Eine Tour aufzeichnen und speichern, oder unten die gegangenen Touren durchsuchen.</span></li>'; return; }
  for (const g of liste) {
    const li = document.createElement('li');
    const erstes = g.besuche[0], mal = g.besuche.length;
    li.innerHTML = '<span class="zeichen">⛰️</span><button class="was" title="Auf der Karte zeigen">' + R.esc(g.name) + '<small>' +
      (g.ele != null ? g.ele + ' m · ' : '') + (mal > 1 ? mal + '× oben, zuerst ' : 'am ') + new Date(erstes.datum).toLocaleDateString('de-DE') +
      (erstes.name ? ' · ' + R.esc(erstes.name) : '') + '</small></button>';
    li.onclick = () => {
      reiter('karte');
      karte.setView([g.lat, g.lon], Math.max(karte.getZoom(), 14));
      L.popup().setLatLng([g.lat, g.lon]).setContent('<b>⛰️ ' + R.esc(g.name) + '</b>' + (g.ele != null ? '<br>' + g.ele + ' m' : '')).openOn(karte);
    };
    ul.appendChild(li);
  }
}

// alle gegangenen Touren (neu) durchsuchen, z. B. nach dem Laden einer Sicherung oder für Touren von vor dem Gipfelbuch
$('gbSuchen').onclick = async () => {
  const touren = tourenLesen().filter(t => t.art === 'aufzeichnung');
  if (!touren.length) { melde('Noch keine gegangenen Touren.'); return; }
  const knopf = $('gbSuchen');
  knopf.disabled = true;
  let neu = 0, fehler = 0;
  try {
    for (let i = 0; i < touren.length; i++) {
      $('gbStatus').textContent = 'Suche Gipfel: Tour ' + (i + 1) + ' von ' + touren.length + ' …';
      try { neu += (await gipfelFuerTour(touren[i])).neu.length; } catch (e) { fehler++; }
    }
  } finally { knopf.disabled = false; }
  $('gbStatus').textContent = (neu ? neu + ' Gipfel neu im Gipfelbuch.' : 'Keine neuen Gipfel.') +
    (fehler ? ' ' + fehler + ' Touren ließen sich nicht prüfen (kein Netz oder Overpass ausgelastet), später noch einmal.' : '');
  gipfelbuchZeigen();
};

// ---------- Sicherung: Gipfel und Besuche, die noch fehlen, kommen dazu ----------
function gipfelbuchEinlesen(text) {
  let roh;
  try { roh = JSON.parse(text).gipfelbuch; } catch (e) { return 0; }
  const aus = R.gipfelbuchPruefen(roh), buch = gipfelbuchLesen();
  let dazu = 0;
  for (const [id, g] of Object.entries(aus.gipfel)) {
    if (!buch.gipfel[id]) { buch.gipfel[id] = g; dazu++; continue; }
    for (const b of g.besuche) if (!buch.gipfel[id].besuche.some(x => x.tour === b.tour && x.datum === b.datum)) buch.gipfel[id].besuche.push(b);
    buch.gipfel[id].besuche.sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
  }
  return gipfelbuchSchreiben(buch) ? dazu : 0;
}
