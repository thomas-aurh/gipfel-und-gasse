// Start: Reiter, Blatt unten (Telefon), Entwurf und Teilen-Link wiederherstellen
function reiter(name) {
  document.querySelectorAll('nav.reiter button').forEach(b => b.classList.toggle('an', b.dataset.reiter === name));
  document.querySelectorAll('.inhalt>section').forEach(s => s.classList.toggle('an', s.dataset.reiter === name));
  if (name === 'entdecken') wetterLaden();
  if (name === 'touren') tourenZeigen();
  if (name === 'planen') requestAnimationFrame(() => profilZeichnen());
  if ($('panel').classList.contains('klein')) blatt('mittel');
}
document.querySelectorAll('nav.reiter button').forEach(b => b.addEventListener('click', () => reiter(b.dataset.reiter)));

// Blatt unten: klein (nur Kopf), mittel, groß. Am Griff ziehen oder tippen.
function blatt(stufe) {
  const p = $('panel');
  p.classList.toggle('klein', stufe === 'klein');
  p.classList.toggle('gross', stufe === 'gross');
  setTimeout(() => { karte.invalidateSize(); profilZeichnen(); }, 230);
}
// Höhe des Blatts für den Kartennachweis (er steht am Telefon darüber, damit er sichtbar bleibt)
if (window.ResizeObserver) new ResizeObserver(() => {
  document.documentElement.style.setProperty('--blatt', (window.innerWidth <= 760 ? $('panel').getBoundingClientRect().height : 0) + 'px');
}).observe($('panel'));
(function griff() {
  const g = $('griff');
  let y0 = null;
  g.addEventListener('pointerdown', e => { y0 = e.clientY; g.setPointerCapture(e.pointerId); });
  g.addEventListener('pointerup', e => {
    if (y0 == null) return;
    const dy = e.clientY - y0, p = $('panel');
    y0 = null;
    const jetzt = p.classList.contains('klein') ? 0 : p.classList.contains('gross') ? 2 : 1;
    let neu = jetzt;
    if (Math.abs(dy) < 8) neu = (jetzt + 1) % 3;
    else if (dy < -30) neu = Math.min(2, jetzt + 1);
    else if (dy > 30) neu = Math.max(0, jetzt - 1);
    blatt(['klein', 'mittel', 'gross'][neu]);
  });
})();

// Gespeicherte Einstellungen
modusSetzen(SPEICHER.lesen('modus', 'berg'));
S.profil = SPEICHER.lesen('profil', 'wandern');
if (!PROFILE[S.profil]) S.profil = 'wandern';
S.tempo = SPEICHER.lesen('tempo', 1);
$('profilwahl').value = S.profil;
$('tempowahl').value = String(S.tempo);
if ($('tempowahl').value !== String(S.tempo)) { S.tempo = 1; $('tempowahl').value = '1'; }

// Teilen-Link hat Vorrang vor dem Entwurf
function ausLink() {
  const l = R.linkLesen(location.hash);
  if (!l) return false;
  // die bisherige Planung samt Wegewahl bleibt über „Rückgängig“ erreichbar
  const ent = SPEICHER.lesen('entwurf', null) || {};
  const vorher = S.wps.length ? S.wps : (ent.wps || []);
  const vorherProfil = S.wps.length ? S.profil : (ent.profil || S.profil);
  S.fest = null; S.tourId = null; S.verlauf = vorher.length ? [JSON.stringify({ wps: vorher, profil: vorherProfil })] : [];
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
    S.wps = ent.wps; S.name = ent.name || ''; S.tourId = ent.tourId || null; $('tourname').value = S.name;
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
if (window.innerWidth <= 760 && !S.wps.length) blatt('klein');
