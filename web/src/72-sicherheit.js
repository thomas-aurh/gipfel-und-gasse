// Sicher zurück: Ausstiege entlang der Route, Umkehrzeit und Akku unterwegs.
// Im Browser warnt diese Datei selbst (Meldung, Vibration, Vorlesen); in der Android-App sagt der Navigationsdienst die
// Warnungen an (auch bei gesperrtem Bildschirm), die Oberfläche zeigt sie nur an (75-app.js ruft sicherZeigen).

// ---------- Ausstiege: Bus und Bahn, Bergbahn, Parkplatz, Hütte entlang der Route ----------
// liste gehört zu fuer (Auswertung der ganzen Route, S.ergebnis); eine Neuberechnung macht sie ungültig
const AUS = { fuer: null, liste: null, laedt: null };
const ebeneAusstieg = L.layerGroup().addTo(karte);
// die App schickt die Ausstiege dann an den Dienst (75-app.js)
let ausstiegeGeladen = () => {};

function ausstiegeLaden(e) {
  if (!e || e.pts.length < 2) return Promise.resolve(null);
  if (AUS.fuer === e && AUS.liste) return Promise.resolve(AUS.liste);
  if (AUS.fuer === e && AUS.laedt) return AUS.laedt;
  AUS.fuer = e; AUS.liste = null;
  // wie „Orte entlang der Route“: zuerst das Kartenpaket (ohne Netz), sonst Overpass; 400 m neben der Route
  const p = orteHolen(e.pts, 400).then(json => {
    if (AUS.fuer !== e) return null;
    AUS.liste = R.ausstiege(R.orteLesen(json, e.pts), e.laenge);
    ausstiegeGeladen();
    return AUS.liste;
  }).finally(() => { if (AUS.laedt === p) AUS.laedt = null; });
  AUS.laedt = p;
  return p;
}
// Ausstiege für das, was die Navigation verfolgt (Mehrtagestour: nur die des Tages, Meter ab dessen Start); null, solange
// keine geladen sind
function ausstiegeFuerPlan(plan) {
  if (!AUS.liste || AUS.fuer !== S.ergebnis) return null;
  if (plan.tag == null) return AUS.liste;
  const s = (etappenAktuell() || [])[plan.tag];
  if (!s) return null;
  return AUS.liste.filter(a => a.d >= s.vonD && a.d <= s.bisD).map(a => Object.assign({}, a, { d: a.d - s.vonD }));
}

// Planen › Vorbereiten: Liste mit Lage auf der Route und Gehzeit ab Start; Antippen zeigt den Ort
function ausstiegeZeigen() {
  const e = S.ergebnis, liste = $('ausstiegListe');
  liste.innerHTML = ''; ebeneAusstieg.clearLayers();
  if (!AUS.liste || AUS.fuer !== e) return;
  if (!AUS.liste.length) { $('ausstiegStatus').textContent = 'Keine Haltestelle, kein Parkplatz und keine Hütte bis 400 m neben der Route gefunden (in OpenStreetMap). Abbrechen heißt hier: umkehren.'; return; }
  $('ausstiegStatus').textContent = AUS.liste.length + (AUS.liste.length === 1 ? ' Stelle' : ' Stellen') + ', an denen du abbrechen kannst. Bergbahnen fahren nur zu ihren Betriebszeiten.';
  for (const a of AUS.liste) {
    const m = L.marker([a.lat, a.lon], { icon: L.divIcon({ className: '', html: '<div class="ort-mk">' + a.zeichen + '</div>', iconSize: [30, 30], iconAnchor: [15, 15] }) })
      .bindPopup('<b>' + a.zeichen + ' ' + R.esc(a.name) + '</b><br><span class="klein">Ausstieg bei ' + R.esc(R.kmText(a.d)) + ' der Route</span>').addTo(ebeneAusstieg);
    const li = document.createElement('li');
    const t = R.zeitBis(e.pts, a.d, tempoAktuell(), artAktuell());
    li.innerHTML = '<span class="zeichen">' + a.zeichen + '</span><span class="was">' + R.esc(a.name) + '<small>bei ' + R.esc(R.kmText(a.d)) +
      ' · nach etwa ' + R.esc(R.zeitText(t)) + (a.abw > 40 ? ' · ' + Math.round(a.abw / 10) * 10 + ' m abseits' : ' · an der Route') + '</small></span>';
    li.onclick = () => { karte.setView([a.lat, a.lon], Math.max(karte.getZoom(), 15)); m.openPopup(); };
    liste.appendChild(li);
  }
}
$('bAusstiege').onclick = async () => {
  const e = S.ergebnis;
  if (!e || e.pts.length < 2) return;
  $('ausstiegStatus').textContent = 'Suche Haltestellen, Parkplätze und Hütten entlang der Route …';
  $('bAusstiege').disabled = true;
  try {
    await ausstiegeLaden(e);
    if (S.ergebnis === e) ausstiegeZeigen();
  } catch (err) {
    if (S.ergebnis === e) $('ausstiegStatus').textContent = 'Ausstiege nicht abrufbar: ' + err.message;
  } finally { $('bAusstiege').disabled = false; }
};
// nach jeder Neuberechnung (zeitplanZeigen): eine alte Liste gehört nicht mehr zur Route; in der Stadt kein Thema
function ausstiegePruefen() {
  $('ausstiegBox').hidden = S.modus === 'stadt' || !S.ergebnis;
  if (AUS.fuer !== S.ergebnis && ($('ausstiegListe').children.length || ebeneAusstieg.getLayers().length)) {
    $('ausstiegListe').innerHTML = ''; ebeneAusstieg.clearLayers();
    $('ausstiegStatus').textContent = '';
  }
}

// ---------- unterwegs: Umkehrzeit, Dunkelheit, Ausstieg, Akku ----------
// je Navigation: welche Warnungen schon kamen, Akku-Proben, Umkehrzeit des verfolgten Plans
const SICHER = { gesagt: new Set(), proben: [], akku: null, planE: null, planTag: null, dunkel: null };
function sicherStart() {
  SICHER.gesagt = new Set(); SICHER.proben = []; SICHER.planE = null; SICHER.dunkel = null;
  if (!NATIV && navigator.getBattery && !SICHER.akku) navigator.getBattery().then(b => { SICHER.akku = b; }).catch(() => {});
  if (S.ergebnis && S.modus !== 'stadt') ausstiegeLaden(S.ergebnis).catch(() => {});   // ohne Netz und Paket: ohne Ausstiege
}
// Dunkelgrenze und Umkehrzeit für heute und den verfolgten Plan (gleich für Browser und Dienst der App)
function dunkelFuer(plan) {
  if (SICHER.planE === S.ergebnis && SICHER.planTag === plan.tag && SICHER.dunkel) return SICHER.dunkel;
  SICHER.planE = S.ergebnis; SICHER.planTag = plan.tag;
  const e = plan.e, ziel = e && e.pts[e.pts.length - 1];
  const untergang = ziel && S.modus !== 'stadt' ? R.sonnenuntergang(new Date(), ziel.lat, ziel.lon) : null;
  const uk = untergang ? umkehrFuer(e, plan.wps, new Date()) : null;
  SICHER.dunkel = { dunkelAb: untergang ? untergang.valueOf() - 30 * 60000 : 0, untergang, umkehrD: uk ? uk.punkt.d : 0, umkehrZeit: uk ? uk.zeit.valueOf() : 0,
    umkehrOrt: uk ? { lat: uk.punkt.lat, lon: uk.punkt.lon } : null };
  return SICHER.dunkel;
}
// o: { d (Fortschritt, Meter), rest (Stunden bis zum Ziel), akku ({ prozent, stunden } aus dem Dienst; im Browser selbst gemessen) }
function sicherZeigen(o) {
  const plan = naviPlan(), jetzt = Date.now();
  // nächster Ausstieg vorn und zurück
  const aus = ausstiegeFuerPlan(plan), n = aus && o.d != null ? R.naechsteAusstiege(aus, o.d) : null;
  const ausText = n && n.vorn ? R.ausstiegText(n.vorn) : n && n.zurueck ? R.ausstiegText(n.zurueck, true) : '';
  $('uAusstieg').hidden = !n || !(n.vorn || n.zurueck);
  if (n) $('uAusstieg').textContent = '🚪 Ausstieg: ' + [n.vorn && n.vorn.zeichen + ' ' + R.ausstiegText(n.vorn), n.zurueck && n.zurueck.zeichen + ' ' + R.ausstiegText(n.zurueck, true)].filter(Boolean).join(' · ');
  // Umkehrzeit und Dunkelheit
  const warn = [];
  const dk = plan.e ? dunkelFuer(plan) : null;
  if (dk && dk.dunkelAb && o.rest != null) {
    const w = { jetzt, ankunft: jetzt + o.rest * 3600e3, dunkelAb: dk.dunkelAb, umkehrD: dk.umkehrD, umkehrZeit: dk.umkehrZeit, d: o.d, untergang: dk.untergang, ausstieg: ausText };
    for (const art of R.dunkelLage(w)) {
      const text = R.dunkelText(art, w);
      warn.push(text);
      if (!SICHER.gesagt.has(art)) { SICHER.gesagt.add(art); if (!NATIV) warnen(text); }
    }
  }
  // Akku: im Browser höchstens jede Minute eine Probe; beim Laden von vorn
  let akku = o.akku || null;
  if (!NATIV && SICHER.akku) {
    const b = SICHER.akku, letzte = SICHER.proben[SICHER.proben.length - 1];
    if (b.charging) SICHER.proben = [];
    else if (!letzte || jetzt - letzte.t >= 60000) SICHER.proben.push({ t: jetzt, l: b.level });
    akku = b.charging ? { prozent: Math.round(b.level * 100), stunden: null, laedt: true } : R.akkuSchaetzung(SICHER.proben);
  }
  $('uAkku').hidden = !akku;
  if (akku) {
    $('uAkku').textContent = '🔋 ' + akku.prozent + ' %' + (akku.laedt ? ' · lädt' : akku.stunden != null ? ' · reicht bei diesem Verbrauch etwa ' + R.zeitText(akku.stunden) + (o.rest != null ? ' · bis zum Ziel ' + R.zeitText(o.rest) : '')
      : ' · wie lange er reicht, zeigt sich nach etwa 10 min');
    const art = akku.laedt ? '' : R.akkuWarnung(akku, o.rest);
    if (art) {
      warn.push(R.akkuText(art, akku, o.rest));
      if (!SICHER.gesagt.has('akku-' + art)) { SICHER.gesagt.add('akku-' + art); if (!NATIV) warnen(R.akkuText(art, akku, o.rest)); }
    }
  }
  $('uSicher').hidden = !warn.length;
  $('uSicher').textContent = warn.map(t => '⚠️ ' + t).join('\n');
}
function sicherAus() { ['uAusstieg', 'uAkku', 'uSicher'].forEach(id => { $(id).hidden = true; }); }
function warnen(text) {
  melde(text, 12);
  if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
  sagenBrowser(text);
}
