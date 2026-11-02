// Stadt: Umschalter Berg/Stadt, Sehenswürdigkeiten im Kartenausschnitt, Rundgang vorschlagen
var stadtBereit = false;   // 20-karte.js ruft sehensPruefen erst, wenn diese Datei geladen ist

// ---------- Umschalter ----------
// Berg: topografische Karte, Wanderwege, Orte entlang der Route. Stadt: Stadtplan, Sehenswürdigkeiten, Stopps.
// opt.karte: Kartenart und Ebenen passend stellen; opt.profil: Wegewahl passend stellen (und neu rechnen)
function modusSetzen(m, opt) {
  opt = opt || {};
  if (m !== 'stadt') m = 'berg';
  const wechsel = S.modus !== m;
  S.modus = m;
  SPEICHER.schreiben('modus', m);
  document.querySelectorAll('.modus button').forEach(b => b.classList.toggle('an', b.dataset.modus === m));
  $('stadtBox').hidden = m !== 'stadt';
  $('bergBox').hidden = m === 'stadt';
  if (opt.karte && wechsel) {
    lagenWahl.basis = m === 'stadt' ? 'osm' : 'topo';
    lagenWahl.wander = m === 'berg';
    lagenWahl.sehens = m === 'stadt';
    lagenAnwenden();
  }
  // passende Wegewahl, ohne eine bewusste Wahl (Rad, kürzester Weg, gerade Linie) zu überschreiben
  const neuProfil = m === 'stadt' && S.profil === 'wandern' ? 'stadt' : m === 'berg' && S.profil === 'stadt' ? 'wandern' : null;
  if (opt.profil && neuProfil) {
    S.profil = neuProfil; $('profilwahl').value = neuProfil; SPEICHER.schreiben('profil', neuProfil);
    if (S.wps.length > 1) neuBerechnen();
  }
  zeigen();
}
document.querySelectorAll('.modus button').forEach(b => b.addEventListener('click', () => modusSetzen(b.dataset.modus, { karte: true, profil: true })));

// ---------- Sehenswürdigkeiten ----------
let sehens = [];             // geladene Orte
let sehensGrenze = null;     // Ausschnitt, für den sie geladen sind
let sehensUhr = null, sehensNr = 0;
const stadtAus = new Set(SPEICHER.lesen('stadtAus', ['wc']));

function sehensPruefen() {
  clearTimeout(sehensUhr);
  if (!lagenWahl.sehens || karte.getZoom() < 14) sehensNr++;   // laufende Anfrage verwerfen
  if (!lagenWahl.sehens) { ebeneSehens.clearLayers(); $('stadtStatus').textContent = 'Sehenswürdigkeiten sind ausgeblendet (Knopf Kartenart und Ebenen rechts an der Karte).'; return; }
  if (karte.getZoom() < 14) {
    ebeneSehens.clearLayers();
    $('stadtStatus').textContent = 'Bis Zoomstufe 14 heranzoomen, dann erscheinen sie auf der Karte.';
    return;
  }
  // schon geladen für diesen Ausschnitt: nur neu zeichnen; nicht, solange ein Fenster an einer Marke offen ist (Neuzeichnen
  // nähme die Marke und damit das Fenster weg, z. B. wenn Leaflet die Karte für ein großes Fenster verschiebt)
  if (sehensGrenze && sehensGrenze.contains(karte.getBounds())) {
    if (!ebeneSehens.getLayers().some(m => m.isPopupOpen && m.isPopupOpen())) sehensZeichnen();
    return;
  }
  sehensUhr = setTimeout(sehensLaden, 700);   // erst laden, wenn die Karte ruht
}
karte.on('moveend', () => { if (stadtBereit) sehensPruefen(); });

async function sehensLaden() {
  const g = karte.getBounds().pad(0.25), nr = ++sehensNr;
  $('stadtStatus').textContent = 'Lade Sehenswürdigkeiten …';
  try {
    const json = await stadtHolen([g.getSouth(), g.getWest(), g.getNorth(), g.getEast()]);
    if (nr !== sehensNr) return;
    sehens = R.stadtLesen(json);
    sehensGrenze = g;
    if (!lagenWahl.sehens || karte.getZoom() < 14) { sehensPruefen(); return; }
    sehensZeichnen();
  } catch (e) {
    if (nr === sehensNr && lagenWahl.sehens) $('stadtStatus').textContent = 'Sehenswürdigkeiten nicht erreichbar: ' + e.message;
  }
}

function sehensSichtbar() {
  const g = karte.getBounds();
  return sehens.filter(o => !stadtAus.has(o.kat) && g.contains([o.lat, o.lon]));
}

function sehensZeichnen() {
  ebeneSehens.clearLayers();
  const sicht = sehensSichtbar();
  // höchstens 250 Marken, bekannte zuerst (die Liste ist so sortiert)
  sicht.slice(0, 250).forEach(o => {
    const kat = R.STADT.find(k => k.k === o.kat);
    const gr = o.bekannt ? 36 : 30;
    const m = L.marker([o.lat, o.lon], {
      zIndexOffset: o.bekannt ? 500 : 0,
      icon: L.divIcon({ className: '', html: '<div class="ort-mk' + (o.bekannt ? ' bekannt' : '') + '">' + kat.zeichen + '</div>', iconSize: [gr, gr], iconAnchor: [gr / 2, gr / 2] })
    });
    m.bindTooltip(R.esc(o.name), { direction: 'top', offset: [0, -gr / 2] });
    m.bindPopup(lage => sehensPopup(o, kat, lage));
    m.addTo(ebeneSehens);
    o.marke = m;
  });
  // Chips und Liste im Reiter Entdecken
  const zahl = {};
  sehens.forEach(o => { if (karte.getBounds().contains([o.lat, o.lon])) zahl[o.kat] = (zahl[o.kat] || 0) + 1; });
  const chips = $('stadtChips');
  chips.innerHTML = '';
  for (const k of R.STADT) {
    if (!zahl[k.k]) continue;
    const b = document.createElement('button');
    b.textContent = k.zeichen + ' ' + k.name + ' ' + zahl[k.k];
    b.classList.toggle('aus', stadtAus.has(k.k));
    b.onclick = () => { if (stadtAus.has(k.k)) stadtAus.delete(k.k); else stadtAus.add(k.k); SPEICHER.schreiben('stadtAus', [...stadtAus]); sehensZeichnen(); };
    chips.appendChild(b);
  }
  const ul = $('stadtListe');
  ul.innerHTML = '';
  sicht.filter(o => o.tags.name).slice(0, 60).forEach(o => {
    const kat = R.STADT.find(k => k.k === o.kat);
    const li = document.createElement('li');
    li.innerHTML = '<span class="zeichen">' + kat.zeichen + '</span><span class="was">' + (o.bekannt ? '⭐ ' : '') + R.esc(o.name) +
      '<small>' + R.esc(R.stadtArt(o.tags)) + (o.tags.opening_hours ? ' · ' + oeffnungKurz(o.tags.opening_hours) : '') + '</small></span>' +
      '<span class="aktionen"><button title="Als Stopp in die Tour">➕</button></span>';
    // erst nach dem Verschieben öffnen: moveend zeichnet die Marken neu (sehensPruefen), ein vorher geöffnetes Fenster hinge an der alten
    li.onclick = () => { karte.once('moveend', () => { if (o.marke) o.marke.openPopup(); }); karte.setView([o.lat, o.lon], Math.max(karte.getZoom(), 16)); };
    li.querySelector('button').onclick = ev => { ev.stopPropagation(); stoppDazu(o); };
    ul.appendChild(li);
  });
  const anzahl = sicht.length;
  $('stadtStatus').textContent = anzahl ? anzahl + ' Orte im Ausschnitt' + (anzahl > 250 ? ', die 250 wichtigsten auf der Karte' : '') + '. Antippen zeigt Infos und „Als Stopp“.' : 'Hier sind keine Sehenswürdigkeiten eingetragen.';
}

function sehensPopup(o, kat, lage) {
  const t = o.tags, box = document.createElement('div');
  const z = ['<b>' + kat.zeichen + ' ' + R.esc(o.name) + '</b>' + (o.bekannt ? ' ⭐' : ''), '<span class="klein">' + R.esc(R.stadtArt(t)) + '</span>'];
  if (t.opening_hours) z.push(oeffnungHtml(t.opening_hours));
  if (t.fee === 'yes' || t.charge) z.push('Eintritt: ' + R.esc(t.charge || 'ja'));
  if (t.fee === 'no') z.push('Eintritt frei');
  if (t.wheelchair === 'yes') z.push('♿ rollstuhlgerecht');
  const wiki = R.wikiLink(t);
  if (wiki) z.push('<a href="' + R.esc(wiki) + '" target="_blank" rel="noopener">Wikipedia</a>');
  const web = t.website || t['contact:website'];
  if (web && /^https?:\/\//.test(web)) z.push('<a href="' + R.esc(web) + '" target="_blank" rel="noopener">Webseite</a>');
  z.push(googleLinkHtml(o.name, t, o.lat, o.lon));
  z.push('<a href="https://www.openstreetmap.org/' + o.id + '" target="_blank" rel="noopener" class="klein">in OpenStreetMap ansehen</a>');
  box.innerHTML = z.join('<br>');
  wikiAnhaengen(box, t, lage);
  const k = document.createElement('button');
  k.className = 'popup-knopf';
  k.textContent = '➕ Als Stopp' + (o.min ? ' (' + o.min + ' min)' : '');
  k.onclick = () => { karte.closePopup(); stoppDazu(o); };
  box.appendChild(document.createElement('br'));
  box.appendChild(k);
  return box;
}

// Stopp ans Ende hängen; bei einer Rundtour vor die Rückkehr zum Start
function stoppDazu(o) {
  if (S.fest) { melde('Das ist eine geöffnete Spur. Für eine neue Planung „✕ Neu“ tippen.'); return; }
  if (S.wps.some(w => w.name === o.name && R.abstand(w, o) < 30)) { melde(o.name + ' ist schon in der Tour.'); return; }
  const n = S.wps.length;
  const rund = n > 2 && R.abstand(S.wps[0], S.wps[n - 1]) < 30;
  wegpunktDazu(o.lat, o.lon, rund ? n - 1 : null, { name: o.name, min: o.min });
  melde(n ? o.name + ' als Stopp dazu.' : o.name + ' ist der Start. Jetzt weitere Orte wählen.');
}

// ---------- Rundgang vorschlagen ----------
$('bRundgang').onclick = async () => {
  if (S.fest) { melde('Erst „✕ Neu“ tippen.'); return; }
  if (karte.getZoom() < 14) { melde('Erst näher heranzoomen (die Stadt oder das Viertel ins Bild).'); return; }
  if (!sehensGrenze || !sehensGrenze.contains(karte.getBounds())) {
    if (!lagenWahl.sehens) { lagenWahl.sehens = true; lagenAnwenden(); }
    await sehensLaden();
  }
  const anzahl = +$('rundAnzahl').value;
  const kandidaten = sehensSichtbar().filter(o => /^(sehens|museum|aussicht|park|kunst)$/.test(o.kat) && o.tags.name);
  if (kandidaten.length < 2) { melde('Zu wenige Sehenswürdigkeiten im Ausschnitt.'); return; }
  const c = karte.getCenter();
  const start = S.wps[0] ? { lat: S.wps[0].lat, lon: S.wps[0].lon, name: S.wps[0].name, min: S.wps[0].min }
    : (U.pos && karte.getBounds().contains([U.pos.lat, U.pos.lon])) ? { lat: U.pos.lat, lon: U.pos.lon, name: 'Mein Standort' }
    : { lat: c.lat, lon: c.lng };
  // Auswahl: bekannte zuerst; nicht zwei Orte fast am selben Fleck und nicht der Start selbst
  const gleich = (a, b) => R.abstand(a, b) < 80 || (a.name && a.name === b.name);
  const wahl = [];
  for (const o of kandidaten) {
    if (wahl.length >= anzahl) break;
    if (gleich(start, o) || wahl.some(w => gleich(w, o))) continue;
    wahl.push(o);
  }
  if (!wahl.length) { melde('Zu wenige Sehenswürdigkeiten im Ausschnitt.'); return; }
  const reihe = R.rundgangOrdnen(start, wahl.map(o => ({ lat: o.lat, lon: o.lon, name: o.name, min: o.min })));
  merken();
  S.wps = [start].concat(reihe, [{ lat: start.lat, lon: start.lon }]);
  if (S.profil === 'wandern') { S.profil = 'stadt'; $('profilwahl').value = 'stadt'; }
  if (!S.name) { S.name = 'Stadtrundgang'; $('tourname').value = S.name; }
  reiter('planen');
  melde('Rundgang mit ' + reihe.length + ' Orten vorgeschlagen. Zeiten und Reihenfolge lassen sich anpassen.', 5);
  await neuBerechnen();
  if (S.ergebnis) einpassen(L.latLngBounds(S.ergebnis.pts.map(p => [p.lat, p.lon])));
};

stadtBereit = true;
sehensPruefen();   // gespeicherter Ausschnitt beim Start: Sehenswürdigkeiten gleich laden, nicht erst nach dem Verschieben
