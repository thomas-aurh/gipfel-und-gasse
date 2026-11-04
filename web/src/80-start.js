// Start: Seiten (Menü links oben, Leiste unten), Blatt unten (Telefon), Entwurf und Teilen-Link wiederherstellen
const SEITEN = { karte: 'Karte', planen: 'Tour planen', unterwegs: 'Unterwegs', entdecken: 'Entdecken', touren: 'Geplante Touren',
  gegangen: 'Gegangene Touren', tagebuch: 'Reisetagebuch', ziele: 'Reiseziele', gipfelbuch: 'Gipfelbuch', offline: 'Offline-Karten', notfall: 'Notfall', daten: 'Sicherung', info: 'Info' };
let seite = 'planen';
function reiter(name) {
  if (!SEITEN[name]) name = 'planen';
  seite = name;
  menue(false);
  // Fadenkreuz gehört zum Planen (Karte und Planen); auf anderen Seiten ist der Knopf weg und das Kreuz aus
  document.body.dataset.seite = name;
  if (name !== 'planen' && name !== 'karte' && kreuzAn) kreuz(false);
  // in der Leiste stehen nur die vier Hauptbereiche; Geplant und Gegangen gehören zu „Touren“
  const leiste = name === 'gegangen' ? 'touren' : name;
  document.querySelectorAll('nav.reiter button').forEach(b => b.classList.toggle('an', b.dataset.reiter === leiste));
  document.querySelectorAll('#menue [data-ziel], .umschalter [data-ziel]').forEach(b => b.classList.toggle('an', b.dataset.ziel === name));
  const vorher = document.body.classList.contains('ohneBlatt');
  document.body.classList.toggle('ohneBlatt', name === 'karte');
  if (vorher !== (name === 'karte')) setTimeout(() => karte.invalidateSize(), 230);
  // auch bei „Karte“ alle Seiten aus: unsichtbare Knöpfe dürfen nicht per Tastatur erreichbar bleiben
  document.querySelectorAll('.inhalt>section').forEach(s => s.classList.toggle('an', s.dataset.reiter === name));
  $('seitenTitel').textContent = SEITEN[name];
  if (name === 'karte') return;
  $('kopfZahlen').hidden = name !== 'planen' && name !== 'unterwegs';
  $('panel').querySelector('.inhalt').scrollTop = 0;
  if (name === 'entdecken') wetterLaden();
  if (name === 'touren' || name === 'gegangen') tourenZeigen();
  if (name === 'tagebuch') tagebuchZeigen();
  if (name === 'ziele') zieleZeigen();
  if (name === 'gipfelbuch') gipfelbuchZeigen();
  if (name === 'planen') requestAnimationFrame(() => profilZeichnen());
  if ($('panel').classList.contains('klein')) blatt('mittel');
}
document.querySelectorAll('nav.reiter button').forEach(b => b.addEventListener('click', () => reiter(b.dataset.reiter)));
document.querySelectorAll('#menue [data-ziel], .umschalter [data-ziel]').forEach(b => b.addEventListener('click', () => reiter(b.dataset.ziel)));

// Menü links oben
function menue(auf) {
  const warAuf = !$('menue').hidden;
  $('menue').hidden = !auf; $('menueHg').hidden = !auf;
  $('bMenue').setAttribute('aria-expanded', String(!!auf));
  // solange das Menü offen ist, ist der Rest nicht bedienbar (auch nicht per Tastatur); Fokus ins Menü und zurück
  ['oben', 'panel', 'kartenknoepfe', 'karte', 'kreuzFeld'].forEach(id => { $(id).inert = !!auf; });
  if (auf) {
    document.querySelectorAll('#menue [data-ziel]').forEach(b => b.classList.toggle('an', b.dataset.ziel === seite));
    ($('menue').querySelector('button.an') || $('menue').querySelector('button')).focus();
  } else if (warAuf && $('menue').contains(document.activeElement)) $('bMenue').focus();
}
$('bMenue').addEventListener('click', e => { e.stopPropagation(); menue($('menue').hidden); });
$('menueHg').addEventListener('click', () => menue(false));
// Darstellung umschalten: automatisch → hell → dunkel
$('bThema').addEventListener('click', () => themaSetzen({ auto: 'hell', hell: 'dunkel', dunkel: 'auto' }[thema]));
window.__gugBereit = true;
if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => themaSetzen(thema, false));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('menue').hidden) menue(false); });

// Blatt unten: klein (nur Kopf), mittel, groß. Am Kopf ziehen oder am Griff tippen.
function blatt(stufe) {
  const p = $('panel');
  p.classList.toggle('klein', stufe === 'klein');
  p.classList.toggle('gross', stufe === 'gross');
  setTimeout(() => { karte.invalidateSize(); profilZeichnen(); kreuzZeigen(); }, 230);
}
// Höhe des Blatts für den Kartennachweis (er steht am Telefon darüber, damit er sichtbar bleibt)
if (window.ResizeObserver) new ResizeObserver(() => {
  // Abstand vom unteren Rand bis zur Oberkante des Blatts (inklusive der Leiste unten)
  document.documentElement.style.setProperty('--blatt', (window.innerWidth <= 760 ? Math.max(0, window.innerHeight - $('panel').getBoundingClientRect().top) : 0) + 'px');
  kreuzZeigen();
}).observe($('panel'));
// Ziehen: am Kopf des Blatts (Griff und Titel) in beide Richtungen, im Inhalt nach unten, wenn er ganz oben steht.
// Das Blatt folgt dem Finger und rastet beim Loslassen auf der nächsten Stufe ein; ein schneller Wisch geht eine Stufe weiter.
const BLATT_STUFEN = ['klein', 'mittel', 'gross'];
function blattHoehen() { const h = window.innerHeight; return [62, h * 0.46, h * 0.88 - 58]; }
function blattStufe() { const p = $('panel'); return p.classList.contains('klein') ? 0 : p.classList.contains('gross') ? 2 : 1; }
const zug = { y0: null, h0: 0, t0: 0, y: 0, t: 0, v: 0, bewegt: false };
function zugStart(y) {
  if (window.innerWidth > 760 || document.body.classList.contains('ohneBlatt')) return false;
  Object.assign(zug, { y0: y, h0: $('panel').getBoundingClientRect().height, y, t: performance.now(), v: 0, bewegt: false });
  return true;
}
function zugZiehen(y) {
  if (zug.y0 == null) return;
  const jetzt = performance.now(), dy = y - zug.y0;
  if (!zug.bewegt && Math.abs(dy) < 8) return;
  if (!zug.bewegt) { zug.bewegt = true; $('panel').classList.add('zieht'); }
  // Geschwindigkeit geglättet, positiv nach unten (px je ms)
  if (jetzt > zug.t) zug.v = 0.7 * ((y - zug.y) / (jetzt - zug.t)) + 0.3 * zug.v;
  zug.y = y; zug.t = jetzt;
  const [min, , max] = blattHoehen();
  $('panel').style.height = Math.round(Math.max(min, Math.min(max, zug.h0 - dy))) + 'px';
}
function zugEnde(tippen) {
  if (zug.y0 == null) return;
  const p = $('panel'), war = zug.bewegt;
  zug.y0 = null;
  p.classList.remove('zieht');
  if (!war) { if (tippen) tippen(); return; }
  const h = p.getBoundingClientRect().height, hs = blattHoehen();
  p.style.height = '';
  let neu;
  if (Math.abs(zug.v) > 0.5) {
    // Wisch: von der Stufe aus, über die der Finger zuletzt gezogen hat, eine weiter in Wischrichtung
    const unter = hs.filter(x => x <= h).length - 1;
    neu = zug.v > 0 ? Math.max(0, unter) : Math.min(2, unter + 1);
  } else neu = hs.reduce((b, x, i) => Math.abs(x - h) < Math.abs(hs[b] - h) ? i : b, 0);
  blatt(BLATT_STUFEN[neu]);
}
(function griff() {
  const kopf = $('panel').querySelector('header');
  let amGriff = false;   // beim Festhalten (Pointer-Capture) zeigt pointerup auf den Kopf, darum hier merken
  kopf.addEventListener('pointerdown', e => {
    amGriff = e.target === $('griff');
    // die Leiste unten liegt im Kopf, ihre Knöpfe bleiben Knöpfe
    if (e.target.closest('button, a, input, select, nav')) return;
    if (zugStart(e.clientY)) kopf.setPointerCapture(e.pointerId);
  });
  kopf.addEventListener('pointermove', e => zugZiehen(e.clientY));
  // Tippen: am Griff durch die Stufen, auf den Titel nur aus der kleinen Stufe heraus aufklappen
  kopf.addEventListener('pointerup', () => {
    zugEnde(() => { const s = blattStufe(); if (amGriff) blatt(BLATT_STUFEN[(s + 1) % 3]); else if (s === 0) blatt('mittel'); });
  });
  kopf.addEventListener('pointercancel', () => zugEnde());
  // im Inhalt: nur ganz oben und nur nach unten zieht das Blatt mit, sonst scrollt der Inhalt wie gewohnt
  const inhalt = $('panel').querySelector('.inhalt');
  let x0 = 0, mitnehmen = null;
  inhalt.addEventListener('touchstart', e => {
    mitnehmen = null;
    if (e.touches.length !== 1 || inhalt.scrollTop > 0 || e.target.closest('input, select, textarea, canvas')) return;
    x0 = e.touches[0].clientX;
    mitnehmen = zugStart(e.touches[0].clientY) ? undefined : null;
  }, { passive: true });
  inhalt.addEventListener('touchmove', e => {
    if (mitnehmen === null || zug.y0 == null) return;
    const t = e.touches[0], dy = t.clientY - zug.y0, dx = t.clientX - x0;
    if (mitnehmen === undefined) {
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
      mitnehmen = dy > 0 && Math.abs(dy) > Math.abs(dx) && inhalt.scrollTop <= 0;
      if (!mitnehmen) { zug.y0 = null; mitnehmen = null; return; }
    }
    e.preventDefault();
    zugZiehen(t.clientY);
  }, { passive: false });
  const loslassen = () => { if (mitnehmen) zugEnde(); else zug.y0 = null; mitnehmen = null; };
  inhalt.addEventListener('touchend', loslassen);
  inhalt.addEventListener('touchcancel', loslassen);
})();

// Gespeicherte Einstellungen
modusSetzen(SPEICHER.lesen('modus', 'berg'));
S.profil = SPEICHER.lesen('profil', 'wandern');
if (!PROFILE[S.profil]) S.profil = 'wandern';
S.tempo = SPEICHER.lesen('tempo', 1);
$('profilwahl').value = S.profil;
$('tempowahl').value = String(S.tempo);
if ($('tempowahl').value !== String(S.tempo)) { S.tempo = 1; $('tempowahl').value = '1'; }
S.pace = SPEICHER.lesen('pace', 6);
$('pacewahl').value = String(S.pace);
if ($('pacewahl').value !== String(S.pace)) { S.pace = 6; $('pacewahl').value = '6'; }
$('kmAnsage').checked = !!SPEICHER.lesen('kmAnsage', false);
tempoFelder();

// Teilen-Link hat Vorrang vor dem Entwurf
function ausLink() {
  const l = R.linkLesen(location.hash);
  if (!l) return false;
  // die bisherige Planung samt Wegewahl bleibt über „Rückgängig“ erreichbar
  const ent = SPEICHER.lesen('entwurf', null) || {};
  const vorher = S.wps.length ? S.wps : (ent.wps || []);
  const vorherProfil = S.wps.length ? S.profil : (ent.profil || S.profil);
  // eine fremde Tour: Name und Zeitplan der vorigen Planung gehören nicht dazu
  S.fest = null; S.tourId = null; S.name = ''; $('tourname').value = ''; zeitplanSetzen(null); S.verlauf = vorher.length ? [JSON.stringify({ wps: vorher, profil: vorherProfil })] : [];
  const key = Object.keys(PROFILE).find(k => k === l.profil);
  S.profil = key || 'wandern'; $('profilwahl').value = S.profil;
  if (vorher.length) melde('Geteilte Tour geöffnet. „↶ Rückgängig“ holt deine vorige Planung zurück.', 6);
  S.wps = l.wps;
  neuBerechnen().then(() => { if (S.ergebnis) einpassen(L.latLngBounds(S.ergebnis.pts.map(p => [p.lat, p.lon]))); });
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* egal */ }
  return true;
}
window.addEventListener('hashchange', ausLink);

if (!ausLink()) {
  const ent = SPEICHER.lesen('entwurf', null);
  if (ent && ent.wps && ent.wps.length) {
    if (ent.modus) modusSetzen(ent.modus);
    S.wps = ent.wps; S.name = ent.name || ''; S.tourId = ent.tourId || null; $('tourname').value = S.name; zeitplanSetzen(ent.zeit);
    // eine gespeicherte Tour füllt den Speicher der Teilstücke, dann muss nichts neu angefragt werden
    if (ent.spur && ent.stuecke && ent.stuecke.length === S.wps.length - 1) {
      S.profil = PROFILE[ent.profil] ? ent.profil : S.profil; $('profilwahl').value = S.profil;
      try { planEntpacken(S.wps, S.profil, ent.spur, ent.stuecke); } catch (e) { /* dann wird neu gefragt */ }
      // Entwurf ohne Abbiegehinweise (vor Stufe 4): neuBerechnen holt sie, die alte Linie bleibt Ersatz
    }
    neuBerechnen();
  } else zeigen();
}
tourenZeigen();
// Telefon ohne Route: Start mit der reinen Karte (Thomas, 04.11.); Planen mit den Einstiegen ist einen Tipp entfernt
if (window.innerWidth <= 760 && !S.wps.length && !S.fest) reiter('karte');
