// Start: Seiten (Menü links oben, Leiste unten), Blatt unten (Telefon), Entwurf und Teilen-Link wiederherstellen
const SEITEN = { karte: 'Karte', planen: 'Tour planen', unterwegs: 'Unterwegs', entdecken: 'Entdecken', touren: 'Geplante Touren',
  gegangen: 'Gegangene Touren', tagebuch: 'Reisetagebuch', offline: 'Offline-Karten', notfall: 'Notfall', daten: 'Sicherung und GPX', info: 'Info' };
let seite = 'planen';
function reiter(name) {
  if (!SEITEN[name]) name = 'planen';
  seite = name;
  menue(false);
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

// Blatt unten: klein (nur Kopf), mittel, groß. Am Griff ziehen oder tippen.
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
if (window.innerWidth <= 760 && !S.wps.length) blatt('klein');
