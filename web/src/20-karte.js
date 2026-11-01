// Karte, Kartenarten, Hilfen für Meldungen und Speicher
const $ = id => document.getElementById(id);
// läuft die Oberfläche in der Android-App (Capacitor)?
// registerPlugin kommt aus @capacitor/core im Offline-Bündel; fehlt es (Bau ohne npm ci), läuft die Oberfläche wie im Browser
const NATIV = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform() &&
  typeof window.Capacitor.registerPlugin === 'function');

let meldUhr = null;
function melde(text, sek) {
  const m = $('meldung');
  m.textContent = text;
  clearTimeout(meldUhr);
  meldUhr = setTimeout(() => { m.textContent = ''; }, (sek || 3.5) * 1000);
}

const SPEICHER = {
  lesen(k, ersatz) { try { const v = localStorage.getItem('gug.' + k); return v == null ? ersatz : JSON.parse(v); } catch (e) { return ersatz; } },
  schreiben(k, v) { try { localStorage.setItem('gug.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
// Daten aus den früheren Namen (Murmel, Wegwerk) einmalig übernehmen, damit gespeicherte Touren bleiben
try {
  if (!localStorage.getItem('gug.uebernommen')) {
    for (const alt of ['wegwerk.', 'murmel.']) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(alt)) localStorage.setItem('gug.' + k.slice(alt.length), localStorage.getItem(k));
      }
    }
    localStorage.setItem('gug.uebernommen', '1');
  }
} catch (e) { /* ohne Speicher geht es auch */ }

const OSM_HINWEIS = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap-Mitwirkende</a>';
const LAGEN = {
  topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    subdomains: 'abc', maxZoom: 19, maxNativeZoom: 17,   // über 17 vergrößert (z. B. beim Wechsel von der Offline-Karte)
    attribution: 'Kartendaten ' + OSM_HINWEIS + ', SRTM | Darstellung © <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC-BY-SA)'
  }),
  osm: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: OSM_HINWEIS }),
  wander: L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png', {
    maxZoom: 18, opacity: 0.85, attribution: 'Wanderwege © <a href="https://waymarkedtrails.org" target="_blank" rel="noopener">waymarkedtrails.org</a> (CC-BY-SA)'
  }),
  rad: L.tileLayer('https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png', {
    maxZoom: 18, opacity: 0.85, attribution: 'Radrouten © <a href="https://waymarkedtrails.org" target="_blank" rel="noopener">waymarkedtrails.org</a> (CC-BY-SA)'
  })
};

// Start: zuletzt gesehener Ausschnitt, sonst Penzberg und das Voralpenland
const blick = SPEICHER.lesen('blick', { lat: 47.70, lon: 11.37, z: 11 });
const karte = L.map('karte', { zoomControl: false, attributionControl: true, maxZoom: 19 }).setView([blick.lat, blick.lon], blick.z);
karte.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');

const lagenWahl = Object.assign({ basis: 'topo', wander: true, rad: false, sehens: false, touren: true }, SPEICHER.lesen('lagen', {}));
// gespeicherte Touren als Punkte am Start (60-touren.js füllt die Ebene)
const ebeneTouren = L.layerGroup();
// Grundkarten und Ebenen darüber; „offline“ und „relief“ kommen aus 58-offline.js dazu, wenn Kartenpakete da sind
const BASIS = ['topo', 'osm', 'offline'], DARUEBER = ['relief', 'wander', 'rad'];
function lagenAnwenden() {
  // gewählte Grundkarte noch nicht da (Offline-Pakete werden erst gelesen) oder Offline-Karte außerhalb jedes Pakets:
  // solange topografisch zeigen, Wahl behalten (zurück im Paketgebiet erscheint wieder die Offline-Karte)
  const basis = LAGEN[lagenWahl.basis] && !(lagenWahl.basis === 'offline' && offlineAusserhalb()) ? lagenWahl.basis : 'topo';
  for (const k of BASIS) if (LAGEN[k]) { if (k === basis) LAGEN[k].addTo(karte); else LAGEN[k].remove(); }
  for (const k of DARUEBER) if (LAGEN[k]) { if (lagenWahl[k]) LAGEN[k].addTo(karte); else LAGEN[k].remove(); }
  document.querySelectorAll('input[name=basis]').forEach(r => { r.checked = r.value === basis; });
  $('lageWander').checked = !!lagenWahl.wander;
  $('lageRad').checked = !!lagenWahl.rad;
  $('lageSehens').checked = !!lagenWahl.sehens;
  $('lageRelief').checked = !!lagenWahl.relief;
  $('lageTouren').checked = !!lagenWahl.touren;
  if (lagenWahl.touren) ebeneTouren.addTo(karte); else ebeneTouren.remove();
  SPEICHER.schreiben('lagen', lagenWahl);
  if (stadtBereit) sehensPruefen();   // Sehenswürdigkeiten laden oder ausblenden (55-stadt.js)
}
lagenAnwenden();
document.querySelectorAll('input[name=basis]').forEach(r => r.addEventListener('change', () => { lagenWahl.basis = r.value; lagenAnwenden(); }));
$('lageWander').addEventListener('change', e => { lagenWahl.wander = e.target.checked; lagenAnwenden(); });
$('lageRad').addEventListener('change', e => { lagenWahl.rad = e.target.checked; lagenAnwenden(); });
$('lageSehens').addEventListener('change', e => { lagenWahl.sehens = e.target.checked; lagenAnwenden(); });
$('lageRelief').addEventListener('change', e => { lagenWahl.relief = e.target.checked; lagenAnwenden(); });
$('lageTouren').addEventListener('change', e => { lagenWahl.touren = e.target.checked; lagenAnwenden(); });
$('bLagen').addEventListener('click', e => { e.stopPropagation(); $('lagenwahl').hidden = !$('lagenwahl').hidden; });
document.addEventListener('click', e => { if (!$('lagenwahl').hidden && !$('lagenwahl').contains(e.target)) $('lagenwahl').hidden = true; });
$('bPlus').addEventListener('click', () => karte.zoomIn());
$('bMinus').addEventListener('click', () => karte.zoomOut());

karte.on('moveend', () => {
  const c = karte.getCenter();
  SPEICHER.schreiben('blick', { lat: +c.lat.toFixed(5), lon: +c.lng.toFixed(5), z: karte.getZoom() });
});

// Ebenen für Route, Wegpunkte, Hervorhebung, Orte, eigene Position
const ebeneRoute = L.layerGroup().addTo(karte);
const ebeneHervor = L.layerGroup().addTo(karte);
const ebenePunkte = L.layerGroup().addTo(karte);
const ebeneOrte = L.layerGroup().addTo(karte);
const ebeneSehens = L.layerGroup().addTo(karte);
const ebeneIch = L.layerGroup().addTo(karte);

// Ein Popup schließt sich beim Tipp auf die Karte; dieser Tipp soll keinen Wegpunkt setzen.
let popupZuSeit = 0;
karte.on('popupclose', () => { popupZuSeit = Date.now(); });

// Auf dem Telefon verdeckt das Blatt unten einen Teil der Karte: beim Einpassen Rand lassen
function einpassen(grenzen) {
  const tel = window.innerWidth <= 760;
  const unten = tel ? $('panel').getBoundingClientRect().height : 0;
  karte.fitBounds(grenzen, { paddingTopLeft: [30, 80], paddingBottomRight: [70, unten + 30], maxZoom: 16 });
}
