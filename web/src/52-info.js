// Karte antippen: Planen (Punkt setzen, wie bisher) oder Info (was ist hier? Name, Art, geöffnet jetzt, Wikipedia).
// Info sucht benannte Objekte im Umkreis: aus dem Kartenpaket (geht ohne Netz) und bei Overpass; beides zusammen.

// Fenster auf der Karte nicht hinter Suchleiste und Blatt (Telefon) aufgehen lassen: Leaflet schiebt die Karte nur
// innerhalb des Kartenrands, und die Karte reicht am Telefon bis unter das Blatt.
(function () {
  const alt = L.Popup.prototype._adjustPan;
  L.Popup.prototype._adjustPan = function () {
    if (this._map) {
      const k = this._map.getContainer().getBoundingClientRect();
      const ueber = $('infoHinweis').hidden ? $('oben') : $('infoHinweis');   // Suche, im Info-Modus der Hinweis darunter
      const oben = ueber.getBoundingClientRect().bottom - k.top + 8;
      const blatt = window.innerWidth <= 760 ? Math.max(0, k.bottom - $('panel').getBoundingClientRect().top) : 0;
      const links = window.innerWidth > 760 ? Math.max(0, $('panel').getBoundingClientRect().right - k.left) : 0;
      this.options.autoPanPaddingTopLeft = L.point(links + 10, Math.max(10, oben));
      this.options.autoPanPaddingBottomRight = L.point(62, blatt + 10);
    }
    return alt.apply(this, arguments);
  };
})();

let infoAn = !!SPEICHER.lesen('infoModus', false);
function infoModus(an) {
  infoAn = an;
  SPEICHER.schreiben('infoModus', an);
  $('bInfo').classList.toggle('an', an);
  $('bInfo').setAttribute('aria-pressed', String(an));
  $('infoHinweis').hidden = !an;
  $('leerHinweis').textContent = an ? 'ℹ️ Info ist an: Antippen zeigt, was dort ist. Zum Planen ✏️ tippen oder ℹ️ rechts ausschalten.' : '👆 Tippe auf die Karte, um den Start zu setzen.';
}
$('bInfo').onclick = () => { infoModus(!infoAn); melde(infoAn ? 'Info: Antippen zeigt, was dort ist.' : 'Planen: Antippen setzt Punkte.'); };
$('bInfoAus').onclick = () => { infoModus(false); melde('Planen: Antippen setzt Punkte.'); };
infoModus(infoAn);

// benannte Orte aus dem Kartenpaket um einen Punkt; [] ohne Paket
async function infoOffline(lat, lon, radius) {
  try {
    const ps = typeof ortePakete === 'function' ? await ortePakete([{ lat, lon }], radius) : null;
    if (!ps) return { elements: [] };
    const dLat = radius / 110540, dLon = radius / (111320 * Math.cos(lat * Math.PI / 180)), els = [];
    for (const p of ps) els.push(...R.orteAusschnitt((await orteLaden(p)).orte, [lat - dLat, lon - dLon, lat + dLat, lon + dLon], 200).elements);
    return { elements: els.filter(e => R.abstand({ lat, lon }, e) <= radius) };
  } catch (e) { return { elements: [] }; }
}

let infoNr = 0;
async function infoZeigen(ll) {
  const nr = ++infoNr, punkt = { lat: ll.lat, lon: ll.lng };
  const radius = R.infoRadius(R.meterJePixel(karte.getZoom(), ll.lat));
  const popup = L.popup({ maxWidth: 290, className: 'info-fenster' }).setLatLng(ll);
  const box = document.createElement('div');
  box.innerHTML = '<p class="klein">Suche, was hier ist …</p>';
  popup.setContent(box).openOn(karte);
  // beides gleichzeitig: das Paket antwortet sofort, Overpass ergänzt (oder fehlt ohne Netz)
  const off = infoOffline(punkt.lat, punkt.lon, radius);
  const on = overpassHolen(R.infoAbfrage(punkt.lat, punkt.lon, radius), 15).catch(e => ({ fehler: e.message }));
  const zeigeListe = (listen, fertig, fehler) => {
    if (nr !== infoNr || !popup.isOpen()) return;
    const treffer = R.infoLesen(listen, punkt);
    // genau ein Treffer ganz nah: gleich seine Infos
    if (fertig && treffer.length === 1 && treffer[0].d <= radius) { infoDetail(popup, treffer[0], ll, null); return; }
    const inhalt = document.createElement('div');
    if (treffer.length) {
      inhalt.innerHTML = '<b>Was ist hier?</b>';
      const ul = document.createElement('ul');
      ul.className = 'info-liste';
      for (const o of treffer) {
        const li = document.createElement('li');
        li.innerHTML = '<button type="button">' + R.esc(o.name) + '<small>' + R.esc(o.art) + ' · ' + Math.round(o.d) + ' m' +
          (o.tags.opening_hours ? ' · ' + oeffnungKurz(o.tags.opening_hours) : '') + '</small></button>';
        // ein Knopf, der den Inhalt tauscht, ist danach nicht mehr im Fenster: Leaflet hielte den Klick sonst für einen
        // Tipp auf die Karte und schlösse das Fenster (darum hier anhalten)
        li.querySelector('button').onclick = ev => { ev.stopPropagation(); infoDetail(popup, o, ll, () => zeigeListe(listen, true, fehler)); };
        ul.appendChild(li);
      }
      inhalt.appendChild(ul);
    } else inhalt.innerHTML = fertig ? '<b>Hier ist nichts mit Namen eingetragen.</b>' : '<p class="klein">Suche, was hier ist …</p>';
    if (fertig && fehler && !treffer.length) inhalt.insertAdjacentHTML('beforeend', '<p class="klein">OpenStreetMap gerade nicht erreichbar (' + R.esc(fehler) + '), gesucht nur im Kartenpaket. Gleich noch einmal antippen.</p>');
    infoFuss(inhalt, ll);
    popup.setContent(inhalt);
  };
  const offJ = await off;
  zeigeListe([offJ], false);
  const onJ = await on;
  zeigeListe(onJ.fehler ? [offJ] : [offJ, onJ], true, onJ.fehler);
}

// Fuß jedes Info-Fensters: die Stelle selbst als Start oder Ziel (Info ersetzt das Planen nicht)
function infoFuss(box, ll) {
  const f = document.createElement('div');
  f.className = 'info-fuss';
  f.innerHTML = '<span class="klein">' + ll.lat.toFixed(5) + ', ' + ll.lng.toFixed(5) + '</span>';
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'popup-knopf';
  b.textContent = S.wps.length ? '➕ Diese Stelle als Ziel' : '📍 Hier starten';
  b.onclick = () => { karte.closePopup(); wegpunktDazu(ll.lat, ll.lng); };
  f.appendChild(b);
  box.appendChild(f);
}

function infoDetail(popup, o, ll, zurueck) {
  const t = o.tags, box = document.createElement('div'), z = [];
  z.push('<b>' + R.esc(o.name) + '</b>', '<span class="klein">' + R.esc(o.art) + ' · ' + Math.round(o.d) + ' m entfernt</span>');
  if (t.opening_hours) z.push(oeffnungHtml(t.opening_hours));
  if (t.fee === 'yes' || t.charge) z.push('Eintritt: ' + R.esc(t.charge || 'ja'));
  if (t.fee === 'no') z.push('Eintritt frei');
  if (t.wheelchair === 'yes') z.push('♿ rollstuhlgerecht');
  if (t.ele && !isNaN(parseFloat(t.ele))) z.push(Math.round(parseFloat(t.ele)) + ' m hoch');
  const web = t.website || t['contact:website'];
  if (web && /^https?:\/\//.test(web)) z.push('<a href="' + R.esc(web) + '" target="_blank" rel="noopener">Webseite</a>');
  z.push(googleLinkHtml(o.name, t, o.lat, o.lon));
  z.push('<a href="https://www.openstreetmap.org/' + o.id + '" target="_blank" rel="noopener" class="klein">in OpenStreetMap ansehen</a>');
  box.innerHTML = z.join('<br>');
  const knoepfe = document.createElement('div');
  knoepfe.className = 'info-fuss';
  const stopp = document.createElement('button');
  stopp.type = 'button'; stopp.className = 'popup-knopf';
  stopp.textContent = S.wps.length ? '➕ Als Stopp' : '📍 Hier starten';
  stopp.onclick = () => { karte.closePopup(); stoppDazu({ lat: o.lat, lon: o.lon, name: o.name, tags: o.tags }); };
  knoepfe.appendChild(stopp);
  const merken = document.createElement('button');
  merken.type = 'button'; merken.className = 'popup-knopf'; merken.textContent = '⭐ Merken';
  merken.title = 'Als Reiseziel merken';
  merken.onclick = ev => { ev.stopPropagation(); karte.closePopup(); zielForm(null, { name: o.name, wo: o.art, lat: o.lat, lon: o.lon, wikipedia: t.wikipedia, wikidata: t.wikidata }); };
  knoepfe.appendChild(merken);
  if (zurueck) {
    const z2 = document.createElement('button');
    z2.type = 'button'; z2.className = 'popup-knopf'; z2.textContent = '‹ Liste';
    z2.onclick = ev => { ev.stopPropagation(); zurueck(); };
    knoepfe.appendChild(z2);
  }
  box.appendChild(knoepfe);
  popup.setContent(box);
  // Wikipedia hängt sich an; neu ausmessen über das Fenster selbst (Inhalt ist das Element, keine Funktion)
  wikiAnhaengen(box, t, { getPopup: () => popup, once: () => {} });
}
