// Gipfelbuch: erreichte Gipfel aus gegangenen Touren (Aufzeichnungen). Erkannt an der Spur: sie kommt bis auf 50 m an
// einen benannten Gipfel aus OpenStreetMap (aus dem Kartenpaket, sonst Overpass). Bleibt auf dem Gerät, kommt mit in die Sicherung.
function gipfelbuchLesen() { return R.gipfelbuchPruefen(SPEICHER.lesen('gipfelbuch', null)); }
function gipfelbuchSchreiben(buch) {
  if (SPEICHER.schreiben('gipfelbuch', buch)) return true;
  melde('Gipfelbuch nicht gespeichert: Der Speicher ist voll oder gesperrt.', 6);
  return false;
}

// Gipfel an einer Spur: ohne Netz aus der Orte-Datei des Pakets (nur benannte Gipfel im Rahmen der Spur, ohne die
// Obergrenze aller Orte, an der sonst Haltestellen und Parkplätze die Gipfel verdrängen), sonst Overpass
async function gipfelAnSpur(pts) {
  if (pts.length < 2) return [];
  const ps = await ortePakete(pts, R.GIPFEL_RADIUS);
  if (ps) {
    const [s, w, n, o] = R.streckenRahmen(pts, 100), els = [];
    for (const p of ps) for (const e of (await orteLaden(p)).orte) {
      const t = e[3];
      if (t && t.natural === 'peak' && t.name && e[0] >= s && e[0] <= n && e[1] >= w && e[1] <= o) els.push(R.ortElement(e));
    }
    return R.gipfelErreicht(pts, els);
  }
  const j = await overpassHolen(R.gipfelAbfrage(pts), 30);
  return R.gipfelErreicht(pts, j.elements || []);
}

// eine gegangene Tour ins Gipfelbuch; liefert { gefunden, neu }
async function gipfelFuerTour(t) {
  const gefunden = await gipfelAnSpur(spurEntpacken(t.spur));
  const buch = gipfelbuchLesen();
  const neu = gefunden.length ? R.gipfelbuchDazu(buch, gefunden, { datum: t.datum, tour: t.id, name: t.name }) : [];
  if (!buch.geprueft.includes(t.id)) buch.geprueft.push(t.id);
  if (!gipfelbuchSchreiben(buch)) throw new Error('Speicher voll');
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
  // Fotos aus dem Reisetagebuch, die oben entstanden sind (bis 150 m vom Gipfel, an einem Tag mit Besuch)
  const tb = tagebuchLesen(), fotoliste = R.fotoListe(tb, tourenLesen()), eintraege = new Map(tb.eintraege.map(e => [e.id, e]));
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
    const fotos = fotoliste.length ? R.gipfelFotos(g, fotoliste, eintraege, 150) : [];
    if (fotos.length) {
      li.classList.add('mitFotos');
      li.querySelector('small').insertAdjacentText('beforeend', ' · 📷 ' + fotos.length);
      const box = document.createElement('div');
      box.className = 'foto-raster klein gb-fotos';
      box.onclick = e => e.stopPropagation();   // Foto groß, nicht zur Karte
      fotoRaster(box, fotos.slice(0, 8));
      li.appendChild(box);
    }
    li.onclick = () => {
      reiter('karte');
      karte.setView([g.lat, g.lon], Math.max(karte.getZoom(), 14));
      L.popup().setLatLng([g.lat, g.lon]).setContent('<b>⛰️ ' + R.esc(g.name) + '</b>' + (g.ele != null ? '<br>' + g.ele + ' m' : '')).openOn(karte);
    };
    ul.appendChild(li);
  }
}

// alle gegangenen Touren (neu) durchsuchen, z. B. nach dem Laden einer Sicherung oder für Touren von vor dem Gipfelbuch
// (schon geprüfte Touren überspringt es; zwischen zwei Anfragen an Overpass eine Pause, bei „zu viele Anfragen“ Schluss)
$('gbSuchen').onclick = async () => {
  const alle = tourenLesen().filter(t => t.art === 'aufzeichnung');
  if (!alle.length) { melde('Noch keine gegangenen Touren.'); return; }
  const geprueft = new Set(gipfelbuchLesen().geprueft), touren = alle.filter(t => !geprueft.has(t.id));
  if (!touren.length) { $('gbStatus').textContent = 'Alle ' + alle.length + ' gegangenen Touren sind schon durchsucht.'; return; }
  const knopf = $('gbSuchen');
  knopf.disabled = true;
  let neu = 0, fehler = 0, abbruch = false;
  try {
    for (let i = 0; i < touren.length; i++) {
      $('gbStatus').textContent = 'Suche Gipfel: Tour ' + (i + 1) + ' von ' + touren.length + ' …';
      try { neu += (await gipfelFuerTour(touren[i])).neu.length; }
      catch (e) {
        fehler++;
        if (/zu viele Anfragen|Speicher voll/.test(e.message)) { abbruch = true; break; }
      }
      if (i < touren.length - 1) await new Promise(r => setTimeout(r, 1500));
    }
  } finally { knopf.disabled = false; }
  $('gbStatus').textContent = (neu ? neu + ' Gipfel neu im Gipfelbuch.' : 'Keine neuen Gipfel.') +
    (abbruch ? ' Abgebrochen (Overpass ausgelastet oder Speicher voll), später noch einmal: geprüfte Touren werden übersprungen.'
      : fehler ? ' ' + fehler + ' Touren ließen sich nicht prüfen (kein Netz), später noch einmal.' : '');
  gipfelbuchZeigen();
};

// ---------- Sicherung: Gipfel und Besuche, die noch fehlen, kommen dazu ----------
function gipfelbuchEinlesen(text) {
  let roh;
  try { roh = (typeof text === 'string' ? JSON.parse(text) : text).gipfelbuch; } catch (e) { return 0; }
  const aus = R.gipfelbuchPruefen(roh), buch = gipfelbuchLesen();
  let dazu = 0;
  for (const [id, g] of Object.entries(aus.gipfel)) {
    if (!buch.gipfel[id]) { buch.gipfel[id] = g; dazu += g.besuche.length; continue; }
    for (const b of g.besuche) if (!buch.gipfel[id].besuche.some(x => R.gipfelBesuchGleich(x, b))) { buch.gipfel[id].besuche.push(b); dazu++; }
    buch.gipfel[id].besuche.sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
  }
  for (const t of aus.geprueft) if (!buch.geprueft.includes(t)) buch.geprueft.push(t);
  return gipfelbuchSchreiben(buch) ? dazu : 0;
}
