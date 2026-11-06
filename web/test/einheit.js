// Einheitstests für src/00-rechnen.js (reine Rechnungen, ohne Browser und ohne Netz).
// Aufruf: node test/einheit.js
const R = require('../src/00-rechnen.js');
let ok = 0, fehler = 0;
function pruef(name, bed, info) {
  if (bed) ok++;
  else { fehler++; console.error('✗ ' + name + (info !== undefined ? ' → ' + JSON.stringify(info) : '')); }
}
const nahe = (a, b, tol) => Math.abs(a - b) <= tol;

// Abstand: ein Breitengrad ≈ 111,2 km
pruef('Abstand 1° Breite', nahe(R.abstand({ lat: 47, lon: 11 }, { lat: 48, lon: 11 }), 111195, 50));
// Penzberg Bahnhof → Kirche ungefähr 600 m (Größenordnung)
pruef('Abstand 0', R.abstand({ lat: 47.75, lon: 11.37 }, { lat: 47.75, lon: 11.37 }) === 0);

// Gehzeit DIN 33466: 12 km, 600 Hm auf und ab → h = 3, v = 2 + 1,2 = 3,2 → 3,2 + 1,5 = 4,7 h
pruef('Gehzeit DIN', nahe(R.gehzeit(12000, 600, 600, 1), 4.7, 1e-9), R.gehzeit(12000, 600, 600, 1));
pruef('Gehzeit Kindertempo länger', R.gehzeit(12000, 600, 600, 0.7) > 6.7);
pruef('Zeittext', R.zeitText(4.7) === '4:40 h', R.zeitText(4.7));
pruef('Zeittext kurz', R.zeitText(0.3) === '20 min', R.zeitText(0.3));
pruef('Zeittext genau (gemessene Dauer)', R.zeitText(1 / 60, true) === '1 min' && R.zeitText(0.001, true) === '0 min', [R.zeitText(1 / 60, true), R.zeitText(0.001, true)]);
pruef('km-Text', R.kmText(12345) === '12 km' && R.kmText(5432) === '5,4 km' && R.kmText(250) === '250 m', [R.kmText(12345), R.kmText(5432)]);

// Höhenmeter mit Schwelle: Wackler unter 5 m zählen nicht (600→650 +50, →640 −10, →700 +60, →600 −100)
pruef('Höhenmeter', JSON.stringify(R.hoehenmeter([600, 602, 601, 603, 650, 640, 700, 600])) === JSON.stringify({ auf: 110, ab: 110 }), R.hoehenmeter([600, 602, 601, 603, 650, 640, 700, 600]));
pruef('Höhenmeter mit Lücken', R.hoehenmeter([null, 500, null, 520]).auf === 20);

// Tags, Wegtyp, Untergrund
const t = R.tagsLesen('highway=path surface=ground sac_scale=mountain_hiking');
pruef('Tags lesen', t.highway === 'path' && t.sac_scale === 'mountain_hiking');
pruef('Wegtyp Pfad', R.wegtyp(t) === 'Pfad');
pruef('Untergrund Naturboden', R.untergrund(t) === 'Naturboden');
pruef('Untergrund Forstweg grade2', R.untergrund({ highway: 'track', tracktype: 'grade2' }) === 'Schotter');
pruef('Untergrund Straße ohne surface', R.untergrund({ highway: 'residential' }) === 'Befestigt');
pruef('Untergrund Pfad ohne surface unbekannt', R.untergrund({ highway: 'path' }) === 'Unbekannt');

// BRouter-Antwort lesen (Aufbau wie format=geojson)
const gj = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: {
      'track-length': '1500',
      messages: [
        ['Longitude', 'Latitude', 'Elevation', 'Distance', 'CostPerKm', 'ElevCost', 'TurnCost', 'NodeCost', 'InitialCost', 'WayTags', 'NodeTags', 'Time', 'Energy'],
        ['11374700', '47753500', '600', '700', '1000', '0', '0', '0', '0', 'highway=residential surface=asphalt', '', '0', '0'],
        ['11380000', '47760000', '650', '800', '1500', '0', '0', '0', '0', 'highway=path surface=ground sac_scale=mountain_hiking', '', '0', '0']
      ]
    },
    geometry: { type: 'LineString', coordinates: [[11.3747, 47.7535, 600], [11.377, 47.756, 620], [11.38, 47.76, 650]] }
  }]
};
const br = R.brouterLesen(gj);
pruef('BRouter Punkte', br.pts.length === 3 && br.pts[0].ele === 600 && br.pts[2].lat === 47.76);
pruef('BRouter Abschnitte', br.abschnitte.length === 2 && br.abschnitte[1].tags.sac_scale === 'mountain_hiking');
let kaputt = false; try { R.brouterLesen({}); } catch (e) { kaputt = true; }
pruef('BRouter leere Antwort wirft', kaputt);

// Auswerten zweier Teilstücke: gemeinsamer Punkt nur einmal
const a = R.linie({ lat: 47.75, lon: 11.37 }, { lat: 47.76, lon: 11.37 });
const b = R.linie({ lat: 47.76, lon: 11.37 }, { lat: 47.76, lon: 11.38 });
const ges = R.auswerten([a, b], 1);
pruef('Auswerten Punkte', ges.pts.length === a.pts.length + b.pts.length - 1);
pruef('Auswerten Länge', nahe(ges.laenge, R.abstand({ lat: 47.75, lon: 11.37 }, { lat: 47.76, lon: 11.37 }) + R.abstand({ lat: 47.76, lon: 11.37 }, { lat: 47.76, lon: 11.38 }), 1), ges.laenge);
const bw = R.auswerten([br], 1);
pruef('Schwierigkeit T2', bw.sac && bw.sac.stufe === 2, bw.sac);
pruef('Kinderwagen nein bei T2', bw.kinderwagen.urteil === 'nein', bw.kinderwagen);
pruef('Wegtypen-Anteile', bw.wege[0][0] === 'Pfad' && bw.wege[0][1] === 800, bw.wege);
const flach = R.kinderwagen([{ m: 3000, tags: { highway: 'track', surface: 'compacted' } }, { m: 1000, tags: { highway: 'residential' } }], 5);
pruef('Kinderwagen ja', flach.urteil === 'ja', flach);

pruef('Abschnitte von/bis', nahe(ges.abschnitte[1].bis, ges.laenge, 0.5) && nahe(ges.abschnitte[1].von, ges.stueckEnde[0], 0.5), ges.abschnitte);
pruef('Fahrzeit Rad', nahe(R.fahrzeit(16000, 600, 1), 2, 1e-9) && R.auswerten([a, b], 1, 'rad').zeit < ges.zeit);

// Position auf der Strecke
const lage = R.aufStrecke(ges.pts, { lat: 47.755, lon: 11.3701 });
pruef('Position auf Strecke', lage.abw < 10 && nahe(lage.d, 556, 15), lage);
// Rundtour: am Start (= Ziel) mit Fortschritt 0 nicht ans Ende springen
const rund = R.auswerten([R.linie({ lat: 47.75, lon: 11.37 }, { lat: 47.76, lon: 11.37 }), R.linie({ lat: 47.76, lon: 11.37 }, { lat: 47.75, lon: 11.37 })], 1);
const amStart = R.aufStrecke(rund.pts, { lat: 47.7501, lon: 11.37 }, 0);
pruef('Rundtour bleibt am Anfang', amStart.d < 50, amStart);
const amEnde = R.aufStrecke(rund.pts, { lat: 47.7501, lon: 11.37 }, rund.laenge - 100);
pruef('Rundtour am Ende erkannt', amEnde.d > rund.laenge - 50, amEnde);
const r = R.rest(ges.pts, lage.d, 1);
pruef('Rest', nahe(r.meter, ges.laenge - lage.d, 1));
pruef('Rest mit Rad-Zeit', R.rest(ges.pts, 0, 1, 'rad').zeit < R.rest(ges.pts, 0, 1).zeit);

// Steigung: 100 m Höhe auf 1000 m → 10 %
const steil = [{ lat: 0, lon: 0, ele: 0, d: 0 }, { lat: 0, lon: 0, ele: 50, d: 500 }, { lat: 0, lon: 0, ele: 100, d: 1000 }];
pruef('Max-Steigung', R.maxSteigung(steil, 100) === 10, R.maxSteigung(steil, 100));

// GPX hin und zurück
const pts = [{ lat: 47.75, lon: 11.37, ele: 600 }, { lat: 47.76, lon: 11.38, ele: 650.5 }];
const gpx = R.gpxSchreiben('Runde <Test> & mehr', pts, [{ lat: 47.75, lon: 11.37, name: 'Start' }]);
const zur = R.gpxLesen(gpx);
pruef('GPX Name', zur.name === 'Runde <Test> & mehr', zur.name);
pruef('GPX Punkte', zur.pts.length === 2 && zur.pts[1].ele === 650.5 && zur.pts[0].lat === 47.75, zur.pts);
pruef('GPX Wegpunkt', zur.wpt.length === 1 && zur.wpt[0].name === 'Start');
const rte = R.gpxLesen("<gpx><rte><name>R</name><rtept lon='11.1' lat='47.1'/><rtept lat='47.2' lon='11.2'></rtept></rte></gpx>");
pruef('GPX Route mit einfachen Anführungszeichen', rte.pts.length === 2 && rte.pts[0].lon === 11.1 && rte.name === 'R', rte);
let leer = false; try { R.gpxLesen('<gpx></gpx>'); } catch (e) { leer = true; }
pruef('GPX leer wirft', leer);

// Teilen-Link
const link = R.linkSchreiben('hiking-mountain', [{ lat: 47.7535, lon: 11.3747 }, { lat: -1.5, lon: -70.25 }]);
const zl = R.linkLesen('#' + link);
pruef('Link hin und zurück', zl && zl.profil === 'hiking-mountain' && zl.wps.length === 2 && zl.wps[1].lon === -70.25, zl);
pruef('Link Unsinn', R.linkLesen('#abc') === null && R.linkLesen('#tour-x-99_1') === null);

// Overpass
const q = R.overpassAbfrage(ges.pts, 300);
pruef('Overpass-Abfrage', q.startsWith('[out:json]') && q.includes('around:300,47.75000,11.37000') && q.includes('alpine_hut'));
const orte = R.orteLesen({ elements: [
  { type: 'node', id: 1, lat: 47.7555, lon: 11.3702, tags: { natural: 'peak', name: 'Testgipfel', ele: '1731.4' } },
  { type: 'way', id: 2, center: { lat: 47.752, lon: 11.3701 }, tags: { leisure: 'playground' } },
  { type: 'node', id: 3, lat: 47.7, lon: 11.3, tags: { shop: 'bakery' } }
] }, ges.pts);
pruef('Orte lesen', orte.length === 2 && orte[0].kat === 'spiel' && orte[0].name === 'Spielplatz' && orte[1].name === 'Testgipfel (1731 m)', orte);

pruef('Wetter Gewitter', R.wetterText(95)[1] === 'Gewitter' && R.wetterText(0)[1] === 'sonnig');

// Stadt
const sq = R.stadtAbfrage([48.13, 11.56, 48.15, 11.59]);
pruef('Stadt-Abfrage mit Ausschnitt', sq.includes('[bbox:48.13000,11.56000,48.15000,11.59000]') && sq.includes('museum'));
const st = R.stadtLesen({ elements: [
  { type: 'node', id: 1, lat: 48.1, lon: 11.5, tags: { tourism: 'artwork' } },
  { type: 'way', id: 2, center: { lat: 48.14, lon: 11.57 }, tags: { tourism: 'museum', name: 'Testmuseum', wikipedia: 'de:Test Museum' } },
  { type: 'node', id: 3, lat: 48.14, lon: 11.57, tags: { tourism: 'museum', name: 'Testmuseum' } },
  { type: 'node', id: 4, lat: 48.2, lon: 11.6, tags: { historic: 'castle', name: 'Burg', wikidata: 'Q1' } },
  { type: 'node', id: 5, lat: 48.2, lon: 11.6, tags: { shop: 'bakery' } }
] });
pruef('Stadt lesen: doppelt nur einmal, Bekannte zuerst', st.length === 3 && st[0].bekannt && st[2].name === 'Kunstwerk', st.map(x => x.name));
pruef('Besichtigungszeit Museum 60, bekannte Burg 30', st.find(x => x.name === 'Testmuseum').min === 60 && st.find(x => x.name === 'Burg').min === 30);
pruef('Wikipedia-Link', R.wikiLink({ wikipedia: 'de:Test Museum' }) === 'https://de.wikipedia.org/wiki/Test_Museum' && R.wikiLink({}) === null);
// Rundgang: vier Ecken eines Quadrats durcheinander → Runde ums Quadrat
const ecke = (a, b) => ({ lat: 48 + a * 0.01, lon: 11 + b * 0.01 });
const durch = [ecke(1, 1), ecke(0, 1), ecke(1, 0)];
const geordnet = R.rundgangOrdnen(ecke(0, 0), durch);
const umfang = R.rundgangLaenge(ecke(0, 0), geordnet);
pruef('Rundgang ums Quadrat', geordnet.length === 3 && geordnet[1] === durch[0] && umfang < R.rundgangLaenge(ecke(0, 0), [durch[0], durch[1], durch[2]]) + 1, geordnet);
const viele = Array.from({ length: 12 }, (_, i) => ({ lat: 48 + Math.sin(i * 2.4) * 0.02, lon: 11 + Math.cos(i * 2.4) * 0.02 }));
pruef('Rundgang nicht länger als Zufallsreihenfolge', R.rundgangLaenge(ecke(0, 0), R.rundgangOrdnen(ecke(0, 0), viele)) <= R.rundgangLaenge(ecke(0, 0), viele));

// Restaufstieg ab einer Stelle zwischen zwei Punkten (600 → 800 m, halbe Strecke → 100 m)
const zwei = [{ lat: 47, lon: 11, ele: 600 }, { lat: 47.01, lon: 11, ele: 800 }];
R.laengen(zwei);
pruef('Rest zwischen Punkten', R.rest(zwei, zwei[1].d / 2, 1).auf === 100, R.rest(zwei, zwei[1].d / 2, 1));
// GPX mit zwei Abschnitten: der Sprung zählt nicht als Weg und bleibt beim Schreiben getrennt
const zweiSeg = '<gpx><trk><trkseg><trkpt lat="47" lon="11"><time>2026-11-01T10:00:00Z</time></trkpt><trkpt lat="47.001" lon="11"/></trkseg>' +
  '<trkseg><trkpt lat="48" lon="11"/><trkpt lat="48.001" lon="11"/></trkseg></trk></gpx>';
const zs = R.gpxLesen(zweiSeg);
pruef('GPX-Abschnitte erkannt', zs.pts.length === 4 && zs.pts[2].luecke === true && !zs.pts[1].luecke, zs.pts);
const zsAus = R.auswerten([{ pts: zs.pts, abschnitte: [] }], 1);
pruef('Sprung zwischen Abschnitten zählt nicht', zsAus.laenge < 300, zsAus.laenge);
pruef('Zeitstempel bleiben in der Auswertung', zsAus.pts[0].t === Date.parse('2026-11-01T10:00:00Z'));
pruef('GPX schreibt Abschnitte getrennt', (R.gpxSchreiben('x', zsAus.pts).match(/<trkseg>/g) || []).length === 2 && R.gpxSchreiben('x', zsAus.pts).includes('<time>'));
// offener Weg: ohne Rückweg ordnen
const linieOrte = [ecke(0, 3), ecke(0, 1), ecke(0, 2)];
const offen = R.wegOrdnen(ecke(0, 0), linieOrte, false);
pruef('Offener Weg der Reihe nach', offen[0] === linieOrte[1] && offen[1] === linieOrte[2] && offen[2] === linieOrte[0], offen);
pruef('Offene Länge ohne Rückweg', R.wegLaenge(ecke(0, 0), offen, false) < R.wegLaenge(ecke(0, 0), offen, true));

// Höhendaten
pruef('Terrarium Meereshöhe 0', R.terrarium(128, 0, 0) === 0 && R.terrarium(131, 232, 0) === 1000, R.terrarium(131, 232, 0));
const rgba = new Uint8ClampedArray([128, 10, 128, 255, 127, 255, 0, 255]);
const tg = R.terrariumGitter(rgba);
pruef('Terrarium-Gitter', tg.length === 2 && tg[0] === 10.5 && tg[1] === -1, Array.from(tg));
pruef('Meter je Pixel z12 am Äquator ≈ 38 m', Math.abs(R.meterJePixel(12, 0) - 38.2) < 0.1, R.meterJePixel(12, 0));
// Rampe nach Osten ansteigend: Höhenlinien senkrecht, eine je 10 m
const W = 32, rampe = new Float32Array(W * W);
for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) rampe[y * W + x] = x * 3.3;
const hl = R.hoehenlinien(rampe, W, W, 10);
const stufen = [...new Set(hl.map(s => s[4]))];
pruef('Höhenlinien: Stufen 10 … 100', stufen.length === 10 && stufen[0] === 10 && stufen[9] === 100, stufen);
pruef('Höhenlinien senkrecht bei x = Höhe / 3,3', hl.filter(s => s[4] === 33).every(s => Math.abs(s[0] - 10) < 1e-6 && Math.abs(s[2] - 10) < 1e-6), hl.filter(s => s[4] === 33).slice(0, 2));
pruef('Flaches Gelände: keine Linien', R.hoehenlinien(new Float32Array(16).fill(500), 4, 4, 20).length === 0);
// Schummerung: Hang nach Nordwesten (zum Licht) heller als nach Südosten
const hang = (fx, fy) => { const a = new Float32Array(W * W); for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) a[y * W + x] = (fx * x + fy * y) * 10; return a; };
const nw = R.schummerung(hang(1, 1), W, W, 30)[W * 16 + 16];   // steigt nach SO an = Hang schaut nach NW
const so = R.schummerung(hang(-1, -1), W, W, 30)[W * 16 + 16];
const eben = R.schummerung(new Float32Array(W * W), W, W, 30)[W * 16 + 16];
pruef('Schummerung: zum Licht heller, abgewandt dunkler', nw > eben && eben > so, [nw, eben, so]);
// Gitter mit Rand: Rampe über zwei Quellkacheln nebeneinander; der Rand kommt aus der Nachbarkachel
const quelle = (tx) => { const a = new Float32Array(65536); for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) a[j * 256 + i] = (tx * 256 + i) * 2; return a; };
const qk = { '10,5': quelle(10), '11,5': quelle(11) };
const rg = R.randGitter((tx, ty) => qk[tx + ',' + ty] || null, 10, 5, 3, 3);
// Zeile 100 (mitten in der Kachel): rechts außen kommt der erste Pixel der rechten Nachbarkachel
pruef('Rand aus Nachbarkachel', rg.length === 258 * 258 && rg[258 * 100 + 1] === 10 * 256 * 2 && rg[258 * 100 + 257] === (11 * 256) * 2, [rg[258 * 100 + 1], rg[258 * 100 + 257]]);
pruef('Rand fehlt: am Rand gehalten', rg[0] === rg[1]);
const rgz = R.randGitter((tx, ty) => qk[tx + ',' + ty] || null, 41, 20, 5, 3);   // Zoom 5 aus Stufe 3: Viertel von Kachel 10/5
pruef('Hochgerechnet aus Elternkachel steigt gleichmäßig', rgz[258 * 100 + 101] > rgz[258 * 100 + 100] && Math.abs((rgz[258 * 100 + 101] - rgz[258 * 100 + 100]) - 0.5) < 1e-3, rgz[258 * 100 + 101] - rgz[258 * 100 + 100]);
pruef('Benötigte Quellkacheln', JSON.stringify(R.randKacheln(10, 5, 3, 3)) === JSON.stringify([[9, 4], [10, 4], [11, 4], [9, 5], [10, 5], [11, 5], [9, 6], [10, 6], [11, 6]]) &&
  // Zoom 5 aus Stufe 3: Kachel 41/20 liegt oben in Quellkachel 10/5, ihr oberer Rand kommt aus 10/4
  JSON.stringify(R.randKacheln(41, 20, 5, 3)) === JSON.stringify([[10, 4], [10, 5]]), R.randKacheln(41, 20, 5, 3));
const az = R.aufziehen(rampe, W, 0, 0, 8, 32);
pruef('Aufziehen: Ausschnitt weich vergrößert', az.length === 1024 && az[0] < az[31] && Math.abs(az[31] - 7.5 * 3.3) < 1, [az[0], az[31]]);
pruef('Lesbarer Winkel', Math.abs(R.lesbarerWinkel(Math.PI * 0.9) - (-Math.PI * 0.1)) < 1e-9 && R.lesbarerWinkel(0.3) === 0.3 && Math.abs(R.lesbarerWinkel(-Math.PI * 0.75) - Math.PI * 0.25) < 1e-9);
const kp = R.kachelPixel(47.6, 11.35, 12);
pruef('Kachel für Punkt', kp.x === 2177 && kp.y >= 1430 && kp.y <= 1436 && kp.px >= 0 && kp.px < 256, kp);
pruef('Linienabstand je Zoom', R.linienAbstand(15)[0] === 20 && R.linienAbstand(12)[0] === 50 && R.linienAbstand(9)[0] === 200);

// Abbiegehinweise aus einer echten BRouter-Antwort (Offline-Engine, Testgebiet Dreieich aus BRouters Testdaten)
const dreieich = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'brouter-dreieich.json'), 'utf8'));
const dr = R.brouterLesen(dreieich);
pruef('Hinweise gelesen', dr.hinweise.length >= 5 && dr.hinweise[0].i === 5 && dr.hinweise[0].cmd === 5, dr.hinweise.slice(0, 2));
const kreis = dr.hinweise.find(h => h.cmd === 14);
pruef('Kreisverkehr mit Ausfahrt (BRouter liefert sie negativ)', kreis && kreis.exit === 1 && R.hinweisText(kreis.cmd, kreis.exit) === 'im Kreisverkehr die 1. Ausfahrt', kreis);
const dz = R.auswerten([dr, dr], 1);
dz.hinweise = dz.hinweise.filter(h => !h.uebergang);   // nur die Hinweise aus den Teilstücken (der Sprung zählt hier nicht)
const zweite = dz.hinweise.filter(h => h.d > dz.stueckEnde[0]);
// im zweiten Teilstück zeigt Punktindex i auf den Gesamtpunkt (Punkte des ersten − 1) + i
pruef('Hinweise je Teilstück auf die ganze Strecke verschoben', zweite.length === dz.hinweise.length / 2 && zweite[0].d === dz.pts[dr.pts.length - 1 + dr.hinweise[0].i].d, [dz.hinweise[0], zweite[0]]);
pruef('Hinweistexte', R.hinweisText(2) === 'links abbiegen' && R.hinweisText(13, 2) === 'im Kreisverkehr die 2. Ausfahrt' && R.hinweisText(1) === null && R.hinweisText(16) === null);
// Abbiegen an einem Zwischenziel: Ost, dann Nord → links
const ostTeil = { pts: [{ lat: 48, lon: 11.000 }, { lat: 48, lon: 11.0005 }, { lat: 48, lon: 11.001 }], abschnitte: [], hinweise: [] };
const nordTeil = { pts: [{ lat: 48, lon: 11.001 }, { lat: 48.0004, lon: 11.001 }, { lat: 48.0008, lon: 11.001 }], abschnitte: [], hinweise: [] };
const ue = R.auswerten([ostTeil, nordTeil], 1).hinweise;
pruef('Übergang am Zwischenziel: links abbiegen', ue.length === 1 && ue[0].cmd === 2 && ue[0].uebergang, ue);
pruef('Geradeaus am Zwischenziel: kein Hinweis', R.auswerten([ostTeil, { pts: [{ lat: 48, lon: 11.001 }, { lat: 48, lon: 11.0015 }, { lat: 48, lon: 11.002 }], abschnitte: [] }], 1).hinweise.length === 0);
pruef('Abbiegebefehle', R.abbiegeBefehl(90, 0) === 2 && R.abbiegeBefehl(90, 180) === 5 && R.abbiegeBefehl(0, 40) === 6 && R.abbiegeBefehl(0, 200) === 4 && R.abbiegeBefehl(10, 350) === null);
pruef('Routen-Kachel', R.routenKachel(11.57, 48.13) === 'E10_N45' && R.routenKachel(-3.2, -7.5) === 'W5_S10');

// Orte und Suche ohne Netz (Format von karten/orte.py)
const offOrte = [[47.629, 11.317, 'n2', { name: 'Herzogstand', natural: 'peak', ele: '1731' }], [47.755, 11.376, 'w3', { name: 'Gasthof Post', amenity: 'restaurant' }],
  [48.137, 11.575, 'r9', { name: 'Neues Rathaus', tourism: 'attraction', wikidata: 'Q1' }]];
pruef('Ort als Overpass-Element', JSON.stringify(R.ortElement(offOrte[1])) === JSON.stringify({ type: 'way', id: 3, lat: 47.755, lon: 11.376, tags: { name: 'Gasthof Post', amenity: 'restaurant' } }));
const umkreis = R.orteUmkreis(offOrte, [{ lat: 47.75, lon: 11.37 }, { lat: 47.76, lon: 11.38 }], 1000).elements;
pruef('Orte im Umkreis der Strecke', umkreis.length === 1 && umkreis[0].tags.name === 'Gasthof Post', umkreis);
pruef('Orte im Umkreis: Herzogstand weit weg', R.orteUmkreis(offOrte, [{ lat: 47.64, lon: 11.317 }], 2000).elements.length === 1 && R.orteUmkreis(offOrte, [{ lat: 47.66, lon: 11.317 }], 2000).elements.length === 0);
const lese = R.orteLesen(R.orteUmkreis(offOrte, [{ lat: 47.629, lon: 11.317 }], 500), null);
pruef('Offline-Orte gehen durch orteLesen', lese.length === 1 && lese[0].kat === 'gipfel' && lese[0].name === 'Herzogstand (1731 m)' && lese[0].id === 'node/2', lese);
// Hütte genau zwischen zwei 1,5 km entfernten Routenpunkten, 100 m neben der Linie: zählt bei 150 m Radius
const zwischen = R.orteUmkreis([[47.70, 11.3100 + 0.00002, 'n5', { name: 'Mittelhütte', tourism: 'alpine_hut' }]],
  [{ lat: 47.6993, lon: 11.30 }, { lat: 47.6993, lon: 11.32 }], 150).elements;
pruef('Orte im Umkreis: Abstand zum Abschnitt, nicht zu den Punkten', zwischen.length === 1, zwischen);
pruef('Abstand zur Linie', nahe(R.abstandZurLinie([{ lat: 47, lon: 11 }, { lat: 47, lon: 11.01 }], 47.001, 11.005), 110.5, 1) &&
  nahe(R.abstandZurLinie([{ lat: 47, lon: 11 }], 47.001, 11), 110.5, 1), R.abstandZurLinie([{ lat: 47, lon: 11 }, { lat: 47, lon: 11.01 }], 47.001, 11.005));
const rahmen = R.streckenRahmen([{ lat: 47, lon: 11 }, { lat: 47.1, lon: 11.2 }], 1000);
pruef('Rahmen um die Strecke', nahe(rahmen[0], 47 - 1000 / 110540, 1e-9) && rahmen[3] > 11.2 && rahmen[2] > 47.1 && rahmen[1] < 11, rahmen);
pruef('Orte im Ausschnitt', R.orteAusschnitt(offOrte, [48.1, 11.5, 48.2, 11.6]).elements.length === 1 && R.stadtLesen(R.orteAusschnitt(offOrte, [48.1, 11.5, 48.2, 11.6]))[0].bekannt);
pruef('Such-Schreibweise', R.suchNorm('Straße am Höllentalanger-Hütte') === 'strasse am hollentalanger hutte' && R.suchNorm('Café  Résumé!') === 'cafe resume', R.suchNorm('Straße am Höllentalanger-Hütte'));
const suchListe = [['Penzberg', 47.7535, 11.3747, 'Stadt', '', 80], ['Herzogstand', 47.629, 11.317, 'Gipfel', '', 73], ['Bahnhofstraße', 47.751, 11.371, 'Straße', 'Penzberg', 20],
  ['Bahnhofstraße', 48.14, 11.56, 'Straße', 'München', 20], ['Herzogstandbahn', 47.63, 11.33, 'Bergbahn', 'Walchensee', 40], ['Penzberger Hof', 47.75, 11.37, 'Gasthaus', 'Penzberg', 22]];
const s1 = R.sucheOffline(suchListe, 'herzog');
pruef('Offline-Suche: Wortanfang, Rang', s1.length === 2 && s1[0].name === 'Herzogstand' && s1[0].wo === 'Gipfel' && s1[0].offline, s1);
const s2 = R.sucheOffline(suchListe, 'Bahnhofstr', { lat: 48.13, lng: 11.57 });
pruef('Offline-Suche: Nähe entscheidet bei gleichem Namen', s2[0].wo === 'Straße · München' && s2[1].wo === 'Straße · Penzberg', s2);
pruef('Offline-Suche: Ort als zweites Wort', R.sucheOffline(suchListe, 'bahnhofstrasse penzberg').map(x => x.wo).join() === 'Straße · Penzberg');
pruef('Offline-Suche: genauer Name zuerst', R.sucheOffline(suchListe, 'Penzberg')[0].name === 'Penzberg' && R.sucheOffline(suchListe, 'x').length === 0);
pruef('Offline-Suche: Teilwort ab 4 Zeichen', R.sucheOffline(suchListe, 'stand')[0].name === 'Herzogstand');

pruef('Abseits nah und weit', R.abseitsText(72) === 'Du bist 72 m neben der Route' && R.abseitsText(4284, 4500) === 'Du bist 4,3 km von der Route entfernt · zum Start 4,5 km', R.abseitsText(4284, 4500));
pruef('Gewittertage', R.gewitterTage([1, 95, 96], ['2026-11-01', '2026-11-02', '2026-11-03']).join() === 'morgen,am Di' && R.gewitterTage([95], ['2026-11-01']).join() === 'heute');
const sich = JSON.stringify({ app: 'gipfel-und-gasse', version: 1, touren: [{ id: 'a', name: 'A', spur: [[47, 11, 600]], kurz: { laenge: 1 } }, { id: 'b' }] });
pruef('Sicherung lesen: nur gültige Touren', R.sicherungLesen(sich).length === 1);
const boese = JSON.stringify({ app: 'gipfel-und-gasse', touren: [
  { id: 'x', name: 'X', spur: [[47, 11, 600]], kurz: { laenge: 1, auf: '<img src=x onerror=alert(1)>' }, datum: '2026-11-01T10:00:00Z' },
  { id: 'y', name: 'Y', spur: [null], kurz: {} },
  { id: 'z', name: 'Z', spur: [[47, 11, null], [47.01, 11.01, null]], wps: [[47, 11], [47.01, 11.01]], stuecke: [{ n: 2, q: 'brouter', a: [[1500, 'highway=path']], h: [[1, 2, null]] }], art: 'plan', kurz: { laenge: 1500 } },
  { id: 'w', name: 'W', spur: [[47, 11, null], [47.01, 11.01, null]], wps: [[47, 11], [47.01, 11.01]], stuecke: [{ n: 5, q: 'brouter', a: [] }], art: 'plan', kurz: { laenge: 1 } }] });
const geprueft = R.sicherungLesen(boese);
pruef('Sicherung: HTML in Kennzahlen wird zur Zahl, Datum bleibt', geprueft[0].kurz.auf === 0 && geprueft[0].datum === '2026-11-01T10:00:00Z', geprueft[0]);
pruef('Sicherung: kaputte Spur fällt weg', !geprueft.some(t => t.id === 'y'));
pruef('Sicherung: passende Teilstücke bleiben (Planung)', geprueft.find(t => t.id === 'z').stuecke.length === 1 && geprueft.find(t => t.id === 'z').art === 'plan');
pruef('Sicherung: unpassende Teilstücke → Tour als Spur', geprueft.find(t => t.id === 'w').stuecke === null && geprueft.find(t => t.id === 'w').art === 'spur');
let sichFehler = ''; try { R.sicherungLesen('{"app":"anders","touren":[]}'); } catch (e) { sichFehler = e.message; }
pruef('Sicherung lesen: fremde Datei abgelehnt', sichFehler.includes('keine Sicherung'));

// Sonne: Referenzwert der verbreiteten Sonnenformel (SunCalc-Test: 5.3.2013, 50,5 N / 30,5 O → 15:46:57 UTC)
const su = R.sonnenuntergang(new Date(Date.UTC(2013, 2, 5, 12)), 50.5, 30.5);
pruef('Sonnenuntergang wie Referenz', Math.abs(su - Date.parse('2013-03-05T15:46:57Z')) < 60000, su && su.toISOString());
pruef('Sonnenuntergang: Polarnacht ohne Wert', R.sonnenuntergang(new Date(Date.UTC(2026, 11, 21, 12)), 85, 0) === null);
const unterg = new Date(Date.UTC(2026, 10, 1, 16, 0));
const zp1 = R.zeitplan(null, 4, 30, unterg);
pruef('Zeitplan: spätester Start = Untergang − Reserve − Dauer', zp1.spaetestens.toISOString() === '2026-11-01T11:00:00.000Z', zp1.spaetestens);
const zp2 = R.zeitplan(new Date(Date.UTC(2026, 10, 1, 12, 0)), 3, 15, unterg);
pruef('Zeitplan: Ankunft mit Pause, 45 min Reserve reichen', zp2.ankunft.toISOString() === '2026-11-01T15:15:00.000Z' && zp2.puffer === 45 && !zp2.knapp, zp2);
pruef('Zeitplan: 20 min vor Untergang ist knapp', R.zeitplan(new Date(Date.UTC(2026, 10, 1, 12, 40)), 3, 0, unterg).knapp === true);
pruef('Zeitplan: genug Reserve', R.zeitplan(new Date(Date.UTC(2026, 10, 1, 9, 0)), 3, 0, unterg).knapp === false);
pruef('Notfall: Grad/Minuten/Sekunden', R.gradMinSek(47.6122, 'N', 'S') === '47° 36′ 43,9″ N' && R.gradMinSek(-0.5, 'O', 'W') === '0° 30′ 0,0″ W', R.gradMinSek(47.6122, 'N', 'S'));
pruef('Notfall: Übertrag beim Runden', R.gradMinSek(47.999999, 'N', 'S') === '48° 0′ 0,0″ N', R.gradMinSek(47.999999, 'N', 'S'));
pruef('Notfall: alter Standort benannt', R.notfallText({ lat: 47, lon: 11 }, true).startsWith('Mein letzter bekannter Standort (nicht aktuell): 47.00000, 11.00000'));
const nt = R.notfallText({ lat: 47.6122, lon: 11.3117, ele: 1731.4, gen: 8 });
pruef('Notfall-Text', nt.startsWith('Mein Standort: 47.61220, 11.31170 (47° 36′ 43,9″ N, 11° 18′ 42,1″ O), Höhe etwa 1731 m, Genauigkeit ± 8 m') && nt.includes('mlat=47.61220'), nt);

pruef('Sicherung: Zeitplan geprüft übernommen', JSON.stringify(R.sicherungLesen(JSON.stringify({ app: 'gipfel-und-gasse', touren: [{ id: 'q', name: 'Q', spur: [[47, 11, null]], kurz: {}, zeit: { tag: '2026-11-01', start: '<b>', pause: 45 } }] }))[0].zeit) === JSON.stringify({ tag: '2026-11-01', start: '', pause: 45 }));

// Laufen: Leistungs-km (100 Hm = 1 km), Tempo als Text, Ansage je km (gleich wie NaviRechnenTest)
const mitPace = R.sicherungLesen(JSON.stringify({ app: 'gipfel-und-gasse', touren: [{ id: 'l1', name: 'Lauf', spur: [[47, 11, null]], kurz: {}, pace: 5 }, { id: 'l2', name: 'Unsinn', spur: [[47, 11, null]], kurz: {}, pace: 999 }] }));
pruef('Sicherung: Lauftempo je Tour, unsinniges fällt weg', mitPace[0].pace === 5 && mitPace[1].pace === undefined);
// Auto-Pause (gleich wie AutoPauseTest.java)
const gehen = (p, bis) => { for (let t = 5000; t <= bis; t += 5000) p.bewegt(t); };   // GPS meldet alle 5 s Bewegung
const ap = R.autoPause(0, 0);
gehen(ap, 60000);
pruef('Auto-Pause: 5 s Stehen ist keine Pause, 11 s schon (einmal gemeldet)', !ap.takt(65000) && ap.takt(71000) && !ap.takt(80000));
pruef('Auto-Pause: Pause ab der letzten Bewegung', ap.bewegungMs(90000) === 60000);
const ap2 = R.autoPause(0, 0);
gehen(ap2, 60000); ap2.takt(65000); ap2.takt(70000);
pruef('Auto-Pause: Schwelle auch ohne Takt dazwischen (12 s Stehen zählen nicht)', ap2.bewegt(72000) === false && ap2.pauseMs === 12000 && ap2.bewegungMs(72000) === 60000);
pruef('Auto-Pause: weiter nach einer Minute Ampel', ap.bewegt(120000) === true && ap.pauseMs === 60000 && ap.bewegungMs(180000) === 120000);
// Rundkurs: Ecken auf einem Kreis, Start mit dabei, Umfang passt zur Wunschlänge
const rs = { lat: 47.75, lon: 11.37 };
const [r1, r2] = R.rundkursPunkte(rs, 8000, 90, 1.3);
const rUmfang = R.abstand(rs, r1) + R.abstand(r1, r2) + R.abstand(r2, rs);
pruef('Rundkurs: Dreieck so groß, dass Weg × 1,3 ≈ Wunschlänge', nahe(rUmfang * 1.3, 8000, 80), rUmfang);
pruef('Rundkurs: in die gewünschte Richtung (Osten)', r1.lon > rs.lon && r2.lon > rs.lon);
pruef('Versatz: 1000 m nach Norden', nahe(R.abstand(rs, R.versatz(rs, 1000, 0)), 1000, 2) && R.versatz(rs, 1000, 0).lat > rs.lat);
pruef('Laufzeit mit Höhe', nahe(R.laufzeit(10000, 200, 6), 1.2, 1e-9));
pruef('Zeit je Art', R.zeitFuer('lauf', 10000, 0, 0, 5) === 50 / 60 && R.zeitFuer('fuss', 12000, 600, 600, 1) === R.gehzeit(12000, 600, 600, 1));
pruef('Tempo als Text', R.paceText(5.7) === '5:42 min/km' && R.paceText(Infinity) === '–', R.paceText(5.7));
pruef('Kilometer-Ansage', R.kmAnsage(3, 1025000, 342000) === '3 Kilometer. Zeit 17 Minuten 5 Sekunden. Letzter Kilometer 5:42.', R.kmAnsage(3, 1025000, 342000));
pruef('Kilometer-Ansage über eine Stunde', R.kmAnsage(12, 4100000, 305000) === '12 Kilometer. Zeit 1 Stunde 8 Minuten. Letzter Kilometer 5:05.', R.kmAnsage(12, 4100000, 305000));
// Reisetagebuch
const ms = (s) => new Date(s).getTime();
pruef('Tag in Ortszeit', R.tagIso(new Date(2026, 10, 2, 0, 30)) === '2026-11-02');
const tbE = [{ id: 'a', zeit: ms('2026-08-01T18:00') }, { id: 'b', zeit: ms('2026-08-02T09:00') }, { id: 'c', zeit: ms('2026-08-01T08:00') }];
const tbT = R.tagebuchTage(tbE);
pruef('Tagebuch: neuester Tag zuerst, im Tag der Reihe nach', tbT.length === 2 && tbT[0].tag === '2026-08-02' && tbT[1].eintraege.map(e => e.id).join() === 'c,a', tbT);
const reise = { id: 'r1', name: 'Gardasee', von: '2026-08-01', bis: '2026-08-03' };
const tourenT = [{ id: 't1', art: 'aufzeichnung', datum: '2026-08-02T10:00:00' }, { id: 't2', art: 'tour', datum: '2026-08-02T10:00:00' }, { id: 't3', art: 'aufzeichnung', datum: '2026-08-05T10:00:00' }];
pruef('Reise: nur gegangene Touren im Zeitraum', R.reiseTouren(tourenT, reise).map(t => t.id).join() === 't1');
// nach der Reise gespeicherte Aufzeichnung: zählt der Aufnahmetag aus der Spur, nicht das Speicherdatum
const spaet = { id: 't4', art: 'aufzeichnung', datum: '2026-08-09T10:00:00', spur: [[45.6, 10.6, null, ms('2026-08-02T09:00')]] };
pruef('Reise: Aufnahmetag aus der Spur', R.reiseTouren([spaet], reise).length === 1 && R.tourZeit(spaet) === ms('2026-08-02T09:00'));
pruef('Reise heute', R.reiseHeute([reise, { id: 'r2', name: 'X', von: '2026-07-30', bis: '2026-08-10' }], '2026-08-02').id === 'r1' && R.reiseHeute([reise], '2026-09-01') === null);
const jpg = 'data:image/jpeg;base64,/9j/AAAA';
const tbP = R.tagebuchPruefen({
  reisen: [reise, { id: 'r<b>', name: 'böse', von: '2026-01-01', bis: '2026-01-02' }, { id: 'r3', name: 'verkehrt', von: '2026-02-02', bis: '2026-02-01' }],
  eintraege: [
    { id: 'e1', reise: 'r1', zeit: ms('2026-08-01T10:00'), text: 'Schön <b>', ort: { lat: 45.6, lon: 10.6, name: 'Malcesine' }, wetter: { temp: 27.5, code: 1 }, fotos: ['f1', 'f2', 'f3'] },
    { id: 'e2', reise: 'fremd', zeit: 1, text: 'x' },
    { id: 'e3', reise: 'r1', zeit: ms('2026-08-02T10:00'), ort: { lat: 99, lon: 0 }, wetter: { temp: 'warm', code: 1 } }
  ] }, { f1: jpg, f2: 'javascript:alert(1)', f3: 'data:image/svg+xml;base64,AAAA' });
pruef('Tagebuch aus Sicherung: nur gültige Reisen und Einträge', tbP.reisen.length === 1 && tbP.eintraege.length === 2, tbP);
pruef('Tagebuch aus Sicherung: Text bleibt Text, nur JPEG/PNG/WebP-Fotos', tbP.eintraege[0].text === 'Schön <b>' && tbP.eintraege[0].fotos.join() === 'f1' && Object.keys(tbP.fotos).join() === 'f1');
pruef('Tagebuch aus Sicherung: falscher Ort und falsches Wetter fallen weg', !tbP.eintraege[1].ort && !tbP.eintraege[1].wetter && tbP.eintraege[1].text === '');
const vieleFotos = {}, vieleIds = [];
for (let i = 0; i < 60; i++) { vieleFotos["g" + i] = jpg; vieleIds.push('g' + i); }
pruef('Tagebuch aus Sicherung: mehr als 50 Fotos je Eintrag bleiben', R.tagebuchPruefen({ reisen: [reise], eintraege: [{ id: 'e9', reise: 'r1', zeit: 1, fotos: vieleIds }] }, vieleFotos).eintraege[0].fotos.length === 60);
const sk = R.heftSkizze([{ lat: 45.6, lon: 10.6, nr: 1 }, { lat: 45.7, lon: 10.8, nr: 2 }], [[{ lat: 45.6, lon: 10.6 }, { lat: 45.65, lon: 10.7 }, { lat: 45.7, lon: 10.8 }]], 600, 300);
const kreise = [...sk.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)].map(m => [+m[1], +m[2]]);
pruef('Heft-Skizze: Orte innerhalb, Nord oben, Ost rechts', kreise.length === 2 && kreise.every(([x, y]) => x >= 24 && x <= 576 && y >= 24 && y <= 276) &&
  kreise[1][0] > kreise[0][0] && kreise[1][1] < kreise[0][1], kreise);
pruef('Heft-Skizze: Weg und Maßstab', sk.includes('<polyline') && /<text x="12"[^>]*>\d+(,\d)? k?m<\/text>/.test(sk), sk.slice(-160));
const teile = R.spurTeile([{ lat: 1, lon: 1 }, { lat: 1.1, lon: 1 }, { lat: 2, lon: 2, luecke: true }, { lat: 2.1, lon: 2 }, { lat: 3, lon: 3, luecke: true }]);
pruef('Spur an Lücken geteilt, Einzelpunkte fallen weg', teile.length === 2 && teile[0].length === 2 && teile[1][0].lat === 2);
pruef('Heft-Skizze: ein einzelner Ort geht, leer gibt nichts', R.heftSkizze([{ lat: 45.6, lon: 10.6, nr: 1 }], [], 600, 300).includes('<circle') && R.heftSkizze([], [], 600, 300) === '');
pruef('Sicherung ohne Tagebuch: leer', R.sicherungTagebuch('{"app":"gipfel-und-gasse","touren":[]}').reisen.length === 0);

// Gewitter in den nächsten Stunden
const jetztG = Date.UTC(2026, 6, 10, 12, 0) ;
const zeitenG = [0, 1, 2, 3].map(h => jetztG / 1000 + h * 3600);
pruef('Gewitter: erste Stunde mit Code ≥ 95 im Fenster', R.gewitterAb(zeitenG, [1, 3, 95, 96], jetztG, 3 * 3600e3) === jetztG + 2 * 3600e3);
pruef('Gewitter: außerhalb des Fensters zählt nicht', R.gewitterAb(zeitenG, [1, 3, 61, 95], jetztG, 2 * 3600e3) === null);
// Statistik: Mittwoch, 11.11.2026; Woche ab Montag 9.11.
const stat = R.statistik([
  { art: 'aufzeichnung', datum: '2026-11-10T10:00:00', kurz: { laenge: 5000, auf: 100 }, spur: [[47, 11, null]] },
  { art: 'aufzeichnung', datum: '2026-11-11T10:00:00', kurz: { laenge: 3000, auf: 50 }, spur: [[47, 11, null, new Date(2026, 10, 4, 9).getTime()]] },
  { art: 'aufzeichnung', datum: '2026-10-20T10:00:00', kurz: { laenge: 10000, auf: 400 }, spur: [[47, 11, null]] },
  { art: 'plan', datum: '2026-11-10T10:00:00', kurz: { laenge: 99000, auf: 0 }, spur: [[47, 11, null]] }
], new Date(2026, 10, 11, 18).getTime());
pruef('Statistik: Woche ab Montag, Aufnahmetag zählt, Planungen nicht', stat.woche.touren === 1 && stat.woche.km === 5 && stat.vorwoche.touren === 1 && stat.vorwoche.km === 3, st);
pruef('Statistik: Monat und Vormonat', stat.monat.km === 8 && stat.vormonat.km === 10 && stat.monat.auf === 150);
pruef('Statistik: 12 Monate bis zum aktuellen', stat.monate.length === 12 && stat.monate[11].monat === 10 && stat.monate[11].km === 8 && stat.monate[10].km === 10);

// Öffnungszeiten: der übliche Teil von opening_hours, alles andere „unbekannt“
const oj = (oh, t) => R.oeffnungJetzt(oh, new Date(t));
pruef('Öffnung: geöffnet bis', oj('Mo-Fr 10:00-18:00', '2026-11-02T12:00').text === 'geöffnet bis 18:00');
pruef('Öffnung: schließt bald (30 min)', oj('Mo-Fr 10:00-18:00', '2026-11-02T17:45').zustand === 'bald');
pruef('Öffnung: abends zu, öffnet morgen', oj('Mo-Fr 10:00-18:00', '2026-11-02T19:00').text === 'geschlossen, öffnet morgen 10:00');
pruef('Öffnung: Freitagabend, öffnet Mo', oj('Mo-Fr 10:00-18:00', '2026-11-06T19:00').text === 'geschlossen, öffnet Mo 10:00');
pruef('Öffnung: Ruhetag Montag', oj('Tu-Su 10:00-12:00,14:00-17:00', '2026-11-02T13:00').text === 'heute geschlossen, öffnet morgen 10:00');
pruef('Öffnung: Mittagspause, auch mit Leerzeichen', oj('Tu-Su 10:00-12:00, 14:00-17:00', '2026-11-03T13:00').text === 'geschlossen, öffnet um 14:00');
pruef('Öffnung: Tagesliste mit Leerzeichen', oj('Mo, We 09:00-12:00', '2026-11-04T10:00').zustand === 'offen' && oj('Mo, We 09:00-12:00', '2026-11-03T10:00').zustand === 'zu');
pruef('Öffnung: über Mitternacht (Vortag)', oj('Fr-Sa 18:00-02:00', '2026-11-07T01:00').text === 'geöffnet bis 02:00' && oj('Fr-Sa 18:00-02:00', '2026-11-06T20:00').text === 'geöffnet bis morgen 02:00');
pruef('Öffnung: Saison nach Monaten', oj('Apr-Oct Mo-Su 09:00-18:00; Nov-Mar Sa-Su 10:00-16:00', '2026-11-02T12:00').text === 'heute geschlossen, öffnet Sa 10:00' &&
  oj('Apr-Oct Mo-Su 09:00-18:00; Nov-Mar Sa-Su 10:00-16:00', '2026-07-01T12:00').zustand === 'offen');
pruef('Öffnung: spätere Regel ersetzt den Tag', oj('Mo-Fr 08:00-12:00; We off', '2026-11-04T09:00').zustand === 'zu' && oj('Mo-Fr 08:00-12:00; We off', '2026-11-05T09:00').zustand === 'offen');
pruef('Öffnung: Komma-Regel kommt dazu', oj('Mo-Fr 10:00-18:00, Sa 10:00-14:00', '2026-11-07T11:00').text === 'geöffnet bis 14:00');
pruef('Öffnung: Feiertage genannt, nicht ausgewertet', oj('Mo-Fr 10:00-18:00; PH off', '2026-11-02T12:00').text === 'geöffnet bis 18:00 (Feiertage nicht berücksichtigt)');
pruef('Öffnung: 24/7 und durchgehend', oj('24/7', '2026-11-02T03:00').text === 'rund um die Uhr geöffnet' && oj('Mo-Su 00:00-24:00', '2026-11-02T12:00').text === 'durchgehend geöffnet');
pruef('Öffnung: Unverstandenes bleibt unbekannt', ['sunrise-sunset', 'Dec 24 off', '2026 Mo-Fr 10:00-12:00', 'Mo[1] 10:00-12:00', '', null, 'nach Vereinbarung']
  .every(x => R.oeffnungJetzt(x, new Date('2026-11-02T12:00')).zustand === 'unbekannt'));
// Wikipedia: Quelle aus OSM, Wikidata-Sitelinks, Kurzfassung
pruef('Wiki: Titel aus OSM', JSON.stringify(R.wikiQuelle({ wikipedia: 'de:Kloster Benediktbeuern' })) === '{"sprache":"de","titel":"Kloster_Benediktbeuern"}' &&
  R.wikiQuelle({ wikidata: 'Q12345' }).wikidata === 'Q12345' && R.wikiQuelle({ wikidata: 'x' }) === null && R.wikiQuelle({}) === null);
pruef('Wiki: Wikidata deutsch vor englisch', R.wikiAusWikidata({ entities: { Q1: { sitelinks: { enwiki: { title: 'A b' }, dewiki: { title: 'C d' } } } } }, 'Q1').titel === 'C_d' &&
  R.wikiAusWikidata({ entities: { Q1: { sitelinks: { enwiki: { title: 'A b' } } } } }, 'Q1').sprache === 'en' && R.wikiAusWikidata({ entities: {} }, 'Q1') === null);
const wk = R.wikiKurz({ type: 'standard', extract: ' Ein Kloster. ', thumbnail: { source: 'https://upload.wikimedia.org/x.jpg' }, content_urls: { mobile: { page: 'https://de.m.wikipedia.org/wiki/K' } } });
pruef('Wiki: Kurzfassung mit Bild und Link', wk.text === 'Ein Kloster.' && wk.bild.endsWith('x.jpg') && wk.url.startsWith('https://de.m.'));
pruef('Wiki: Begriffsklärung und fremde Bildquellen nicht', R.wikiKurz({ type: 'disambiguation', extract: 'x' }) === null && R.wikiKurz({ extract: 'x', thumbnail: { source: 'javascript:1' } }).bild === null);
// Regenplan
pruef('Regen: Codes und Wahrscheinlichkeit', R.regenTag(61, 10) && R.regenTag(81, 0) && R.regenTag(95, 0) && R.regenTag(3, 70) && !R.regenTag(3, 30) && !R.regenTag(1, null));
pruef('Regen: Abfrage im Umkreis', /around:3000,47\.75350,11\.37470/.test(R.regenAbfrage(47.7535, 11.3747, 3000)) && R.regenAbfrage(1, 2, 3).includes('museum'));
const drin = R.regenLesen({ elements: [
  { type: 'node', id: 1, lat: 47.76, lon: 11.37, tags: { tourism: 'museum', name: 'Fern' } },
  { type: 'way', id: 2, center: { lat: 47.754, lon: 11.375 }, tags: { leisure: 'sports_centre', sport: 'swimming', name: 'Hallenbad' } },
  { type: 'node', id: 3, lat: 47.75, lon: 11.37, tags: { tourism: 'museum' } },
  { type: 'node', id: 4, lat: 47.75, lon: 11.37, tags: { amenity: 'cinema', name: 'Privat', access: 'private' } }] }, { lat: 47.7535, lon: 11.3747 });
pruef('Regen: nach Abstand, ohne Namenlose und Private', drin.length === 2 && drin[0].name === "Hallenbad" && drin[0].kat === "bad" && drin[1].id === "node/1");
pruef('Anreise: Link für Bus und Bahn und Auto', R.anreiseLink(47.7535, 11.3747) === 'https://www.google.com/maps/dir/?api=1&destination=47.75350,11.37470&travelmode=transit' &&
  R.anreiseLink(47.7535, 11.3747, 'auto').endsWith('travelmode=driving'));

// Info beim Antippen: Art, Reihenfolge, Umkreis
pruef('Info: Art aus den Merkmalen', R.infoArt({ historic: 'castle' }) === 'Burg oder Schloss' && R.infoArt({ tourism: 'museum' }) === 'Museum' &&
  R.infoArt({ amenity: 'restaurant' }) === 'Gasthaus' && R.infoArt({ shop: 'bakery' }) === 'Geschäft' && R.infoArt({ building: 'yes' }) === 'Gebäude' && R.infoArt({}) === 'Ort');
const inf = R.infoLesen([
  { elements: [{ type: 'node', id: 1, lat: 47.0001, lon: 11, tags: { name: 'Bäckerei', shop: 'bakery' } }, { type: 'node', id: 9, lat: 47, lon: 11, tags: { amenity: 'bench' } }] },
  { elements: [{ type: 'way', id: 2, center: { lat: 47.0002, lon: 11 }, tags: { name: 'Burg', historic: 'castle', wikidata: 'Q2' } },
    { type: 'node', id: 1, lat: 47.0001, lon: 11, tags: { name: 'Bäckerei', shop: 'bakery', opening_hours: 'Mo-Sa 06:00-18:00' } }] }], { lat: 47, lon: 11 });
pruef('Info: Burg mit Wikipedia vor der näheren Bäckerei, doppelte einmal mit mehr Merkmalen, Namenlose nicht',
  inf.length === 2 && inf[0].name === 'Burg' && inf[1].id === 'node/1' && inf[1].tags.opening_hours === 'Mo-Sa 06:00-18:00' && Math.round(inf[1].d) === 11, inf);
pruef('Info: Umkreis aus Maßstab, begrenzt', R.infoRadius(0.3) === 15 && R.infoRadius(2) === 60 && R.infoRadius(50) === 150);
pruef('Info: Abfrage ohne Straßen und Grenzen', /around:40,47\.000000,11\.000000\)\["name"\]\[!"highway"\]\[!"boundary"\]/.test(R.infoAbfrage(47, 11, 40)));

// Reiseziele: Dateien lesen, prüfen, als GPX
const zt = R.zieleLesen('# Ideen\nHerzogstand\nLindau, Bodensee https://lindau.de\n\nKloster Andechs', 'x.txt');
pruef('Ziele aus Text: Zeile je Ziel, Komma bleibt im Namen, Link abgetrennt, Kommentar weg', zt.art === 'Text' && zt.ziele.length === 3 && zt.ziele[1].name === 'Lindau, Bodensee' &&
  zt.ziele[1].link === 'https://lindau.de' && zt.ziele[1].suche === 'Lindau, Bodensee' && zt.ziele[0].lat === undefined);
const zc = R.zieleLesen('Name;Ort;Notiz;Lat;Lon\nGardasee;Riva del Garda;Baden;;\nAlm;;;47,5;11,25', 'z.csv');
pruef('Ziele aus CSV mit Kopfzeile: Suchbegriff und Koordinaten mit Komma', zc.art === 'CSV' && zc.ziele[0].suche === 'Riva del Garda' && zc.ziele[0].notiz === 'Baden' && zc.ziele[1].lat === 47.5 && zc.ziele[1].lon === 11.25);
const zg = R.zieleLesen('<gpx><wpt lon="11.3" lat="47.6"><name>Gipfel &amp; Hütte</name><desc><![CDATA[toll]]></desc><link href="https://a.b"/></wpt><wpt lat="0" lon="0"><name>Null</name></wpt></gpx>', 'a.gpx');
pruef('Ziele aus GPX: Wegpunkte, Entitäten und CDATA, 0/0 nicht', zg.ziele.length === 1 && zg.ziele[0].name === 'Gipfel & Hütte' && zg.ziele[0].notiz === 'toll' && zg.ziele[0].link === 'https://a.b');
const zk = R.zieleLesen('<kml><Placemark><name>Burg</name><description><![CDATA[Info https://x.y/z]]></description><Point><coordinates> 11.5,48.1,0 </coordinates></Point></Placemark><Placemark><name>Weg</name><LineString><coordinates>1,2 3,4</coordinates></LineString></Placemark></kml>', 'b.kml');
pruef('Ziele aus KML (Google My Maps): Punkte, Link aus der Beschreibung, Linien nicht', zk.ziele.length === 1 && zk.ziele[0].lat === 48.1 && zk.ziele[0].link === 'https://x.y/z');
const zj = R.zieleLesen(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [11, 47] }, properties: { name: 'A', url: 'javascript:x' } }] }), 'c.geojson');
pruef('Ziele aus GeoJSON: Punkte, nur http-Links', zj.ziele.length === 1 && zj.ziele[0].lat === 47 && zj.ziele[0].link === '');
let zFehler = '';
try { R.zieleLesen('{kaputt', 'd.geojson'); } catch (e) { zFehler = e.message; }
pruef('Ziele: kaputte Datei mit Meldung', zFehler.includes('GeoJSON'));
pruef('Ziele: höchstens 300', R.zieleLesen(Array.from({ length: 400 }, (_, i) => 'Ort ' + i).join('\n'), 'v.txt').ziele.length === 300);
const zp = R.zielePruefen({ listen: [{ id: 'l1', name: 'A' }, { name: 'ohne id' }], ziele: [
  { id: 'z1', liste: 'l1', name: 'Gut', lat: 47, lon: 11, stich: ['Berg', 'Quatsch'], stand: 'besucht', link: 'https://x' },
  { id: 'z2', liste: 'l9', name: 'Liste fehlt', lat: 47, lon: 11 }, { id: 'z3', liste: 'l1', name: 'Ohne Ort' }] });
pruef('Ziele prüfen: nur gültige Listen und Ziele, Stichworte und Stand aus der Auswahl', zp.listen.length === 1 && zp.ziele.length === 1 && zp.ziele[0].stich.join() === 'Berg' && zp.ziele[0].stand === 'besucht');
const zx = R.zieleGpx('Liste & Co', [{ name: 'A<B', lat: 47.1, lon: 11.2, notiz: 'n', link: 'https://x' }]);
pruef('Ziele als GPX: wieder lesbar', R.zieleLesen(zx, 'l.gpx').ziele[0].name === 'A<B' && zx.includes('<metadata><name>Liste &amp; Co</name>'));

pruef('Google Maps: Name mit Adresse aus OSM', R.googleSuche('Bäckerei Huber', { 'addr:street': 'Bahnhofstraße', 'addr:housenumber': '3', 'addr:postcode': '82377', 'addr:city': 'Penzberg' }, '', 47.75, 11.37) ===
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Bäckerei Huber, Bahnhofstraße 3, 82377 Penzberg'));
pruef('Google Maps: Name mit Ortsname, sonst Koordinaten', R.googleSuche('Café Rosa', {}, 'Penzberg', 47.75, 11.37).endsWith(encodeURIComponent('Café Rosa, Penzberg')) &&
  R.googleSuche('Café Rosa', {}, '', 47.7535, 11.3747).endsWith('query=47.753500%2C11.374700'));
// Durchsicht 03.11.: Lücken zwischen Abschnitten, Parser, Öffnungszeiten
const seil = '<gpx><trk><trkseg><trkpt lat="47.60" lon="11"><ele>800</ele></trkpt><trkpt lat="47.601" lon="11"><ele>810</ele></trkpt></trkseg>' +
  '<trkseg><trkpt lat="47.602" lon="11"><ele>1800</ele></trkpt><trkpt lat="47.603" lon="11"><ele>1810</ele></trkpt></trkseg></trk></gpx>';
const seilAus = R.auswerten([{ pts: R.gpxLesen(seil).pts, abschnitte: [] }], 1);
pruef('Seilbahn-Sprung zählt nicht als Aufstieg', seilAus.auf === 20 && seilAus.ab === 0, [seilAus.auf, seilAus.ab]);
pruef('Seilbahn-Sprung zählt nicht als Steigung', seilAus.steigung < 20, seilAus.steigung);
pruef('Rest unterwegs ohne Sprung', R.rest(seilAus.pts, 0, 1).auf === 20, R.rest(seilAus.pts, 0, 1));
pruef('Höchster und tiefster Punkt', seilAus.hoch === 1810 && seilAus.tief === 800);
pruef('Neben der gedachten Linie über die Lücke ist nicht auf der Route',
  R.aufStrecke(seilAus.pts, { lat: 47.6015, lon: 11 }).abw > 50, R.aufStrecke(seilAus.pts, { lat: 47.6015, lon: 11 }));
const vieleHoehen = Array.from({ length: 200000 }, (_, i) => ({ lat: 47 + i * 1e-6, lon: 11, ele: 500 + (i % 7) }));
let grossOk = true; try { R.auswerten([{ pts: vieleHoehen, abschnitte: [] }], 1); } catch (e) { grossOk = false; }
pruef('Sehr große Aufzeichnung ohne Stapelüberlauf', grossOk);
pruef('GPX-Name: nicht der Autor', R.gpxLesen('<gpx><metadata><author><name>Garmin</name></author></metadata><trk><name>Runde</name><trkseg><trkpt lat="47" lon="11"/><trkpt lat="47.1" lon="11"/></trkseg></trk></gpx>').name === 'Runde');
const wptZwei = R.zieleLesen('<gpx><wpt lat="47" lon="11"/><wpt lat="48" lon="12"><name>B</name></wpt></gpx>', 'w.gpx').ziele;
pruef('Ziele: selbstschließende Wegpunkte', wptZwei.length === 2 && wptZwei[1].name === 'B' && wptZwei[1].lat === 48, wptZwei);
const csvQ = R.zieleLesen('"Café; Bar";Lindau;"sagt ""hallo"""', 'q.csv').ziele[0];
pruef('Ziele: Trenner in Anführungszeichen', csvQ.name === 'Café; Bar' && csvQ.suche === 'Lindau' && csvQ.notiz === 'sagt "hallo"', csvQ);
const csvK = R.zieleLesen('name,lat,lon\nZugspitze,47.42,10.98', 'k.csv').ziele;
pruef('Ziele: Komma-CSV mit Kopfzeile', csvK.length === 1 && csvK[0].name === 'Zugspitze' && csvK[0].lat === 47.42, csvK);
pruef('Ziele: Zeile in Anführungszeichen ohne Trenner', R.zieleLesen('"Lindau, Bodensee"', 't.txt').ziele[0].name === 'Lindau, Bodensee');
const csvOffen = R.zieleLesen('"Café;Lindau;Notiz', 'o.csv').ziele[0];
pruef('Ziele: offenes Anführungszeichen behält die Spalten', csvOffen.suche === 'Lindau' && csvOffen.notiz === 'Notiz', csvOffen);
pruef('Ziele: Komma ohne Kopfzeile bleibt Suchbegriff', R.zieleLesen('Lindau, Bodensee', 't.txt').ziele[0].suche === 'Lindau, Bodensee');
pruef('Öffnung: Zusatzregel „, We off“ schließt', oj('Mo-Fr 10:00-18:00, We off', '2026-11-04T12:00').zustand === 'zu', oj('Mo-Fr 10:00-18:00, We off', '2026-11-04T12:00'));
pruef('Öffnung: Zusatzregel ergänzt weiter Zeiten', oj('Mo 10:00-12:00, Mo 14:00-16:00', '2026-11-02T15:00').zustand === 'offen');

// Öffnungszeiten: Formen aus den Kartenpaketen (Saison, offenes Ende, Monate mit Doppelpunkt, Tage mit Datum)
// offenes Ende und Tage ohne Uhrzeit sind „vage“: die App behauptet keine Uhrzeit, die nicht eingetragen ist
pruef('Öffnung: offenes Ende', oj('Mo-Su 11:30+', '2026-11-04T12:00').zustand === 'vage' && oj('Mo-Su 11:30+', '2026-11-04T12:00').text === 'geöffnet ab 11:30, Ende offen' &&
  oj('Mo-Su 11:30+', '2026-11-04T10:00').text === 'geschlossen, öffnet um 11:30');
pruef('Öffnung: Saison ohne Uhrzeit', oj('Jun-Aug', '2026-07-08T12:00').zustand === 'vage' && oj('Jun-Aug', '2026-11-04T12:00').text === 'geschlossen, außerhalb der Saison');
// Fälle aus der Prüfung vom 03.11.
const obP = (oh, t, min) => R.oeffnungBesuch(oh, new Date(t), min);
pruef('Besuch: „Su 10:00+“ spät abends nicht sicher offen', obP('Su 10:00+', '2026-11-08T23:00', 60).zustand === 'vage', obP('Su 10:00+', '2026-11-08T23:00', 60));
pruef('Besuch: „07:00-12:00+“ nach 12 nicht sicher zu', obP('Mo-Fr 07:00-12:00+', '2026-11-04T12:30', 30).zustand === 'vage' &&
  obP('Mo-Fr 07:00-12:00+', '2026-11-04T10:00', 60).text === 'bei Ankunft geöffnet, mindestens bis 12:00', obP('Mo-Fr 07:00-12:00+', '2026-11-04T12:30', 30));
pruef('Besuch: offenes Ende einer Regel gilt nicht für die anderen', obP('Mo-Fr 10:00-24:00; Su 12:00+', '2026-11-04T23:00', 120).zustand === 'knapp', obP('Mo-Fr 10:00-24:00; Su 12:00+', '2026-11-04T23:00', 120));
pruef('Besuch: Tag ohne Uhrzeit überdeckt nicht die bekannten Zeiten', obP('Mo-Fr 10:00-18:00; Sa', '2026-11-04T12:00', 480).zustand === 'knapp' &&
  oj('Mo-Fr 10:00-18:00; Sa', '2026-11-04T08:00').text === 'geschlossen, öffnet um 10:00', oj('Mo-Fr 10:00-18:00; Sa', '2026-11-04T08:00'));
pruef('Besuch: „Tu-Su“ ohne Uhrzeit ist vage, kein „öffnet um 00:00“', obP('Tu-Su', '2026-11-04T23:30', 30).zustand === 'vage' && obP('Tu-Su', '2026-11-02T23:45', 30).zustand === 'zu');
pruef('Besuch: Schließtage sind keine Saison', obP('Mo-Su 10:00-18:00; Dec 24-Dec 31 off', '2026-12-23T19:00', 30).text === 'bei Ankunft geschlossen, an dem Tag nicht mehr', obP('Mo-Su 10:00-18:00; Dec 24-Dec 31 off', '2026-12-23T19:00', 30));
pruef('Besuch: „bis“ mit Tag über Mitternacht', obP('Mo-Fr 00:00-24:00', '2026-11-04T12:00', 60).text === 'bei Ankunft geöffnet, bis Sa 00:00', obP('Mo-Fr 00:00-24:00', '2026-11-04T12:00', 60));
pruef('Öffnung: Monate mit Doppelpunkt', oj('Apr-Oct: Mo-Su 10:00-16:00; Nov-Mar: Mo-Su 11:00-15:00', '2026-11-04T12:00').text === 'geöffnet bis 15:00' &&
  oj('Apr-Oct: Mo-Su 10:00-16:00; Nov-Mar: Mo-Su 11:00-15:00', '2026-07-08T12:00').text === 'geöffnet bis 16:00');
pruef('Öffnung: Zeitraum mit Tagen', oj('May 09-Oct 18 Tu-Su 10:00-22:00', '2026-05-12T12:00').zustand === 'offen' && oj('May 09-Oct 18 Tu-Su 10:00-22:00', '2026-05-08T12:00').zustand === 'zu' &&
  oj('May 09-Oct 18 Tu-Su 10:00-22:00', '2026-05-11T12:00').zustand === 'zu');
pruef('Öffnung: Zeitraum über den Jahreswechsel', oj('Dec 20-Jan 10 10:00-16:00', '2027-01-05T12:00').zustand === 'offen' && oj('Dec 20-Jan 10 10:00-16:00', '2027-02-05T12:00').zustand === 'zu');
// Besuch: Ankunft und Aufenthalt gegen die Öffnungszeiten
const ob = (oh, t, min) => R.oeffnungBesuch(oh, new Date(t), min);
pruef('Besuch: offen', ob('Mo-Fr 10:00-18:00', '2026-11-04T14:00', 60).zustand === 'offen' && ob('Mo-Fr 10:00-18:00', '2026-11-04T14:00', 60).text === 'bei Ankunft geöffnet, bis 18:00');
pruef('Besuch: schließt während des Besuchs', ob('Mo-Fr 10:00-18:00', '2026-11-04T17:30', 60).zustand === 'knapp', ob('Mo-Fr 10:00-18:00', '2026-11-04T17:30', 60));
pruef('Besuch: öffnet kurz nach der Ankunft', ob('Mo-Fr 10:00-18:00', '2026-11-04T09:45', 30).text === 'öffnet erst um 10:00');
pruef('Besuch: geschlossen, öffnet später', ob('Mo-Fr 10:00-12:00,14:00-18:00', '2026-11-04T12:30', 30).text === 'bei Ankunft geschlossen, öffnet 14:00');
pruef('Besuch: Ruhetag', ob('Tu-Su 10:00-17:00', '2026-11-02T12:00', 30).text === 'bei Ankunft geschlossen, an dem Tag nicht mehr');
pruef('Besuch: außerhalb der Saison', ob('May-Oct 10:00-17:00', '2026-11-04T12:00', 30).text === 'bei Ankunft geschlossen (außerhalb der Saison)', ob('May-Oct 10:00-17:00', '2026-11-04T12:00', 30));
pruef('Besuch: durchgehend und bis Mitternacht', ob('Mo-Su 00:00-24:00', '2026-11-04T10:00', 60).text === 'durchgehend geöffnet' &&
  ob('Mo-Su 18:00-24:00', '2026-11-04T20:00', 60).text === 'bei Ankunft geöffnet, bis 24:00', ob('Mo-Su 18:00-24:00', '2026-11-04T20:00', 60));
// Führung: Text am Stopp
const langerText = Array.from({ length: 60 }, (_, i) => 'Satz Nummer ' + i + ' über die Burg.').join(' ');
const ft = R.fuehrungText('Alte Burg', langerText);
pruef('Führung: Name zuerst, gekürzt am Satzende', ft.startsWith('Alte Burg erreicht. Satz Nummer 0') && ft.length <= 1200 + 20 && ft.endsWith('.'), ft.length);
pruef('Führung: kurzer Text bleibt ganz', R.fuehrungText('Kirche', 'Eine  Kirche.\n') === 'Kirche erreicht. Eine Kirche.');
pruef('Besuch: unbekannt', ob('nach Vereinbarung', '2026-11-04T12:00', 30).zustand === 'unbekannt');

// Gipfelbuch
const gbSpur = [{ lat: 47.6, lon: 11.3 }, { lat: 47.601, lon: 11.3 }, { lat: 47.6015, lon: 11.3005 }]; R.laengen(gbSpur);
const gbEl = [{ type: 'node', id: 1, lat: 47.6012, lon: 11.3002, tags: { natural: 'peak', name: 'Testgipfel', ele: '1650,5' } },
  { type: 'node', id: 2, lat: 47.61, lon: 11.3, tags: { natural: 'peak', name: 'Weit weg' } },
  { type: 'node', id: 3, lat: 47.601, lon: 11.3, tags: { natural: 'peak' } }, { type: 'node', id: 4, lat: 47.601, lon: 11.3, tags: { tourism: 'viewpoint', name: 'Aussicht' } }];
const gbG = R.gipfelErreicht(gbSpur, gbEl);
pruef('Gipfelbuch: nur benannte Gipfel nahe der Spur', gbG.length === 1 && gbG[0].id === 'n1' && gbG[0].ele === 1651, gbG);
const gbBuch = { gipfel: {} };
const gbN1 = R.gipfelbuchDazu(gbBuch, gbG, { datum: '2026-07-01T10:00:00Z', tour: 't1', name: 'Runde' });
const gbN2 = R.gipfelbuchDazu(gbBuch, gbG, { datum: '2026-07-01T10:00:00Z', tour: 't1', name: 'Runde' });
const gbN3 = R.gipfelbuchDazu(gbBuch, gbG, { datum: '2026-06-01T10:00:00Z', tour: 't0', name: 'Früher' });
pruef('Gipfelbuch: neu, derselbe Besuch nicht doppelt, Besuche nach Datum', gbN1.length === 1 && !gbN2.length && !gbN3.length &&
  gbBuch.gipfel.n1.besuche.length === 2 && gbBuch.gipfel.n1.besuche[0].tour === 't0', gbBuch);
const gbL = R.gipfelbuchListe(R.gipfelbuchPruefen(JSON.parse(JSON.stringify(gbBuch))));
pruef('Gipfelbuch: Liste und Kennzahlen', gbL.anzahl === 1 && gbL.besuche === 2 && gbL.hoechster.name === 'Testgipfel' && gbL.liste[0].zuletzt === '2026-07-01T10:00:00Z', gbL);
pruef('Gipfelbuch: Sicherung geprüft', Object.keys(R.gipfelbuchPruefen({ gipfel: { 'x"]': { name: 'a', lat: 1, lon: 1 }, n5: { name: 'B', lat: 47, lon: 11, besuche: [{ datum: 'kaputt' }, { datum: '2026-01-01' }] } } }).gipfel).join() === 'n5' &&
  R.gipfelbuchPruefen({ gipfel: { n5: { name: 'B', lat: 47, lon: 11, besuche: [{ datum: 'kaputt' }, { datum: '2026-01-01' }] } } }).gipfel.n5.besuche.length === 1 && Object.keys(R.gipfelbuchPruefen(null).gipfel).length === 0);
pruef('Gipfelbuch: Abfrage nur benannte Gipfel', R.gipfelAbfrage(gbSpur).includes('node["natural"="peak"]["name"](around:' + R.GIPFEL_RADIUS + ','));
// Hin und zurück über einen Grat: der Gipfel am Umkehrpunkt liegt zwischen den ausgedünnten Punkten der Abfrage
{
  const hin = []; for (let i = 0; i <= 60; i++) hin.push({ lat: 47.5 + i * 0.0003, lon: 11.3 });
  const spur = hin.concat(hin.slice(0, -1).reverse().map(p => ({ lat: p.lat, lon: p.lon + 0.0002 }))); R.laengen(spur);
  const gipfel = { lat: hin[60].lat + 0.0002, lon: 11.3001 };   // gut 20 m hinter dem Umkehrpunkt
  const ll = /around:(\d+),([\d.,-]+)\)/.exec(R.gipfelAbfrage(spur));
  const zahlen = ll[2].split(',').map(Number), abfrage = [];
  for (let i = 0; i < zahlen.length; i += 2) abfrage.push({ lat: zahlen[i], lon: zahlen[i + 1] });
  const naechster = Math.min(...abfrage.map(p => R.abstand(p, gipfel)));
  pruef('Gipfelbuch: Gipfel am Umkehrpunkt liegt im Radius der Abfrage', naechster <= +ll[1], [naechster, +ll[1]]);
}
pruef('Gipfelbuch: Gipfel ohne gültigen Besuch fällt weg, way mit eigener Kennung',
  !R.gipfelbuchPruefen({ gipfel: { n7: { name: 'Leer', lat: 47, lon: 11, besuche: [] } } }).gipfel.n7 &&
  R.gipfelErreicht(gbSpur, [{ type: 'way', id: 9, center: { lat: 47.6012, lon: 11.3002 }, tags: { natural: 'peak', name: 'Fläche' } }])[0].id === 'w9');
pruef('Gipfelbuch: Besuche ohne Tour nach dem Tag unterschieden', R.gipfelBesuchGleich({ tour: '', datum: '2026-01-01' }, { tour: '', datum: '2026-01-02' }) === false &&
  R.gipfelBesuchGleich({ tour: 't1', datum: 'a' }, { tour: 't1', datum: 'b' }) === true);

// Mehrtagestour: Etappen an den Übernachtungen
const etPts = []; for (let i = 0; i <= 30; i++) etPts.push({ lat: 47 + i * 0.001, lon: 11, ele: i <= 10 ? 500 + i * 50 : i <= 20 ? 1000 - (i - 10) * 30 : 700 + (i - 20) * 20 });
R.laengen(etPts);
const etSe = [etPts[10].d, etPts[20].d, etPts[30].d];
const et = R.etappen(etPts, etSe, [{}, { name: 'Hütte', nacht: true }, { name: 'Alm' }, {}], 1, 'fuss');
pruef('Etappen: an der Übernachtung geteilt', et.length === 2 && et[0].bis === 1 && et[1].von === 1 && et[1].bis === 3, et);
pruef('Etappen: Höhenmeter und höchster Punkt je Tag', et[0].auf === 500 && et[0].ab === 0 && et[0].hoch === 1000 && et[1].auf === 200 && et[1].ab === 300 && et[1].hoch === 1000, et.map(s => [s.auf, s.ab, s.hoch]));
pruef('Etappen: Strecke und Gehzeit wie zwei einzelne Touren', Math.abs(et[0].meter + et[1].meter - etPts[30].d) < 1 &&
  Math.abs(et[0].zeit - R.zeitFuer('fuss', et[0].meter, 500, 0, 1)) < 1e-9, et.map(s => s.zeit));
pruef('Etappen: ohne Übernachtung keine, Ziel und Start zählen nicht', R.etappen(etPts, etSe, [{ nacht: true }, {}, {}, { nacht: true }], 1, 'fuss') === null);
// Zeit ab der Übernachtung für sich gerechnet (die Formel ist nicht additiv): steiler Tag 1, flacher Tag 2
{
  const p = []; for (let i = 0; i <= 30; i++) p.push({ lat: 47 + i * 0.0003, lon: 11, ele: 500 + i * 33.3 });
  for (let i = 1; i <= 120; i++) p.push({ lat: 47 + 30 * 0.0003 + i * 0.001, lon: 11, ele: 1500 });
  R.laengen(p);
  const se = [p[30].d, p[150].d], st = R.etappen(p, se, [{}, { name: 'Hütte', nacht: true }, {}], 1, 'fuss');
  const zw = R.zeitZwischen(p, st[1].vonD, se[1], 1, 'fuss'), diff = R.zeitBis(p, se[1], 1, 'fuss') - R.zeitBis(p, se[0], 1, 'fuss');
  pruef('Etappen: Zeit des zweiten Tages für sich, nicht als Differenz', Math.abs(zw - st[1].zeit) < 1e-9 && Math.abs(diff - st[1].zeit) > 0.5, [zw, st[1].zeit, diff]);
}
// Lücke genau an der Etappengrenze: der Punkt hinter dem Sprung gehört zum nächsten Tag
{
  const p = [{ lat: 47, lon: 11, ele: 500 }, { lat: 47.01, lon: 11, ele: 900 }, { lat: 47.5, lon: 11.5, ele: 2000, luecke: true }, { lat: 47.51, lon: 11.5, ele: 2100 }];
  R.laengen(p);
  const st = R.etappen(p, [p[1].d, p[3].d], [{}, { nacht: true }, {}], 1, 'fuss');
  pruef('Etappen: Punkt hinter der Lücke an der Grenze gehört zu Tag 2', st[0].hoch === 900 && st[0].ziel.lat === 47.01 && st[1].auf === 100, st.map(s => [s.hoch, s.auf, s.ziel && s.ziel.lat]));
}
const etTour = R.sicherungLesen(JSON.stringify({ app: 'gipfel-und-gasse', version: 1, touren: [{ id: 't1', name: 'x', datum: '2026-07-10T08:00:00Z', spur: [[47, 11], [47.1, 11], [47.2, 11]], art: 'plan',
  wps: [[47, 11], [47.1, 11, 'Hütte', 0, 0, 1], [47.2, 11]], stuecke: [{ n: 2, q: 'linie', a: [] }, { n: 2, q: 'linie', a: [] }], kurz: { laenge: 1, auf: 0, ab: 0, zeit: 1 } }] }))[0];
pruef('Etappen: Tour aus der Sicherung behält die Übernachtung', etTour && JSON.stringify(etTour.wps[1]) === JSON.stringify([47.1, 11, 'Hütte', 0, 0, 1]), etTour && etTour.wps);

// Wetter für die Tour
const twUrl = R.tourWetterUrl([{ lat: 47.6, lon: 11.3, ele: 800 }, { lat: 47.61, lon: 11.31, ele: 1700.4 }]);
pruef('Tourwetter: eine Anfrage für alle Punkte, mit Höhe', twUrl.includes('latitude=47.6000,47.6100') && twUrl.includes('elevation=800,1700') && twUrl.includes('timeformat=unixtime'), twUrl);
pruef('Tourwetter: ohne Höhe eines Punkts nur dort die Geländehöhe', R.tourWetterUrl([{ lat: 47, lon: 11, ele: null }, { lat: 47, lon: 11, ele: 500 }]).includes('elevation=nan,500'));
pruef('Tourwetter: vergangene Zeit eigens benannt', R.tourWetterText(null, true).text === 'liegt in der Vergangenheit' && R.tourWetterText(null, false).text.includes('16 Tage'));
const twOrt = { hourly: { time: [1000, 4600, 8200], temperature_2m: [5, -1, 3], precipitation_probability: [10, 60, 0], weather_code: [2, 95, 0], wind_speed_10m: [10, 20, 5], wind_gusts_10m: [20, 65, 10] } };
const twW = R.wetterStunde(twOrt, 5000 * 1000);
pruef('Tourwetter: Stunde der Ankunft', twW && twW.temp === -1 && twW.code === 95, twW);
pruef('Tourwetter: außerhalb der Vorhersage', R.wetterStunde(twOrt, 500 * 1000) === null && R.wetterStunde(twOrt, 20000 * 1000) === null);
const twT = R.tourWetterText(twW);
pruef('Tourwetter: Text und Warnungen', twT.text.includes('-1 °C') && twT.text.includes('Böen 65') && twT.warn.join() === 'Gewitter,Sturmböen,Frost', twT);

// Quelle und Alter der Öffnungszeiten (Abgleich 03.11.)
const qi = R.stoppInfo({ opening_hours: 'Mo 10:00-12:00', check_date: '2021-06-04', website: 'https://x.example', 'addr:street': 'Hauptstr.', 'addr:housenumber': '1', 'addr:postcode': '83671', 'addr:city': 'Benediktbeuern' });
pruef('Quelle: Prüfdatum, Webseite und Adresse kommen mit', qi.ohd === '2021-06-04' && qi.web === 'https://x.example' && qi.adr === 'Hauptstr. 1, 83671 Benediktbeuern', qi);
pruef('Quelle: unsichere Werte fallen weg', JSON.stringify(R.infoPruefen({ oh: 'Mo off', ohd: 'gestern', web: 'javascript:alert(1)', adr: 5, x: 1 })) === '{"oh":"Mo off"}');
pruef('Quelle: Stand und „alt“ ab zwei Jahren', R.ohStand('2021-06-04', new Date('2026-11-03')).text === 'Stand 06/2021' && R.ohStand('2021-06', new Date('2026-11-03')).alt &&
  !R.ohStand('2025-06-01', new Date('2026-11-03')).alt && R.ohStand('', new Date()) === null);
pruef('Quelle: Google mit Adresse, sonst Name an der Stelle', R.googleOrtLink('Hütte', 'Weg 1, 83671 Ort', 47, 11).endsWith(encodeURIComponent('Hütte, Weg 1, 83671 Ort')) &&
  R.googleOrtLink('Hütte', '', 47.123456, 11.5).startsWith('https://www.google.com/maps/search/H%C3%BCtte/@47.12346,11.50000,17z'));

pruef('Quelle: erstes gültiges Datum, nur das Jahr mit Warnung, Monat 13 ungültig',
  R.ohDatum({ 'check_date:opening_hours': '2023', check_date: '2024-05-01' }) === '2023' && R.ohDatum({ 'check_date:opening_hours': 'bald', check_date: '2024-05-01' }) === '2024-05-01' &&
  R.ohStand('2019', new Date('2026-11-03')).text === 'Stand 2019' && R.ohStand('2019', new Date('2026-11-03')).alt && R.ohStand('2023-13-01', new Date()) === null);
pruef('Quelle: Webseite ohne Schema und zweite gültige', R.stoppInfo({ website: 'www.museum.de' }).web === 'https://www.museum.de' &&
  R.stoppInfo({ website: 'museum', 'contact:website': 'https://kontakt.example' }).web === 'https://kontakt.example');

// Familie: Spielplatz oder Einkehr zwischen 30 und 70 % der Länge, höchstens 250 m neben der Route
{
  const o = (kat, d, abw) => ({ kat, d, abw, name: kat });
  const da = R.familieHalbzeit([o('spiel', 2900, 20), o('huette', 4000, 100), o('spiel', 500, 10), o('huette', 3000, 400), o('wasser', 3000, 5), o('spiel', null, 0)], 6000);
  pruef('Familie: nur Spielplatz und Einkehr auf halber Strecke, nah an der Route', da.length === 2 && da[0].d === 2900 && da[1].d === 4000, da);
  pruef('Familie: Grenzen 5/8/12 km', R.FAMILIE['5-200'].meter === 5000 && R.FAMILIE['8-400'].hm === 400 && R.FAMILIE['12-700'].meter === 12000);
}

// Rundgang nach Zeit: 1 km Luftlinie hin und zurück (2 km × 1,3 = 2,6 km bei 4 km/h = 39 min) plus 20 min Besichtigung
{
  const start = { lat: 47.75, lon: 11.37 }, ort = { lat: 47.75 + 1000 / 111195, lon: 11.37, min: 20 };
  pruef('Rundgang: Minuten aus Weg und Besichtigung', nahe(R.rundgangMinuten(start, [ort]), 59, 1), R.rundgangMinuten(start, [ort]));
}

// Parkplätze: nur Kategorie „parken“, nach Abstand, Beschreibung mit Gebühr, Plätzen und Art
{
  const p = { lat: 47.75, lon: 11.37 };
  const pl = R.parkplaetze([{ kat: 'parken', lat: 47.754, lon: 11.37, name: 'A', tags: { fee: 'no', capacity: '40', hiking: 'yes' } },
    { kat: 'wc', lat: 47.7501, lon: 11.37, tags: {} }, { kat: 'parken', lat: 47.751, lon: 11.37, name: 'B', tags: { fee: 'yes', parking: 'underground' } }], p);
  pruef('Parkplätze: sortiert, ohne andere Orte', pl.length === 2 && pl[0].name === 'B' && pl[1].name === 'A', pl.map(x => x.name));
  pruef('Parkplätze: Beschreibung', R.parkText(pl[0]) === '110 m vom Start · gebührenpflichtig · Tiefgarage' && R.parkText(pl[1]) === '440 m vom Start · kostenlos · 40 Plätze · Wanderparkplatz',
    [R.parkText(pl[0]), R.parkText(pl[1])]);
}

// GPX: Art, Herkunft, Symbole der Wegpunkte, Dauer (Datei im Stil von komoot, Autor-Link mit eigenem <type>)
{
  const x = '<?xml version="1.0"?><gpx version="1.1" creator="https://www.beispiel-touren.de" xmlns="http://www.topografix.com/GPX/1/1">' +
    '<metadata><name>Probe &amp; Gipfel</name><author><link href="https://www.beispiel-touren.de"><text>x</text><type>text/html</type></link></author></metadata>' +
    '<wpt lat="47.60" lon="11.30"><name>Probehütte</name><sym>Fishing Hot Spot Facility</sym></wpt>' +
    '<wpt lat="47.61" lon="11.31"><name>Probegipfel</name><sym>Summit</sym></wpt>' +
    '<wpt lat="47.62" lon="11.32"><name>Blick von der Probe-Alm</name><sym>Flag, Blue</sym></wpt>' +
    '<trk><name>Probe &amp; Gipfel</name><type>hike</type><trkseg>' +
    '<trkpt lat="47.60" lon="11.30"><ele>800</ele><time>2019-08-27T07:00:00Z</time></trkpt>' +
    '<trkpt lat="47.61" lon="11.31"><ele>1200</ele><time>2019-08-27T09:30:00Z</time></trkpt></trkseg></trk></gpx>';
  const g = R.gpxLesen(x);
  pruef('GPX: Art aus trk (nicht vom Autor-Link), Herkunft als Host', g.typ === 'hike' && g.quelle === 'beispiel-touren.de' && g.name === 'Probe & Gipfel', [g.typ, g.quelle, g.name]);
  pruef('GPX: Symbole der Wegpunkte', g.wpt.map(w => R.gpxPunktArt(w.sym, w.name)).join() === 'einkehr,gipfel,punkt', g.wpt.map(w => R.gpxPunktArt(w.sym, w.name)));
  pruef('GPX: Dauer laut Zeitstempeln', nahe(R.gpxDauer(g.pts), 2.5, 1e-9) && R.gpxDauer([{ t: 5 }, { t: 1 }]) === null && R.gpxDauer([{}, {}]) === null, R.gpxDauer(g.pts));
  pruef('GPX: Art → Profil', R.gpxProfil('hike') === 'wandern' && R.gpxProfil('running') === 'laufen' && R.gpxProfil('cycling') === 'rad' && R.gpxProfil('mtb') === 'rad' && R.gpxProfil('9') === null && R.gpxProfil(null) === null);
  pruef('GPX: Herkunft ohne Adresse', R.gpxQuelle('Garmin Connect') === 'Garmin Connect' && R.gpxQuelle('') === null);
  // Sicherung: Wegpunkte, Herkunft und Dauer kommen mit, Unsinn nicht
  const tour = { id: 'tx', name: 'P', datum: '2026-11-04T10:00:00Z', spur: [[47.6, 11.3, 800], [47.61, 11.31, 900]], kurz: { laenge: 1, auf: 1, ab: 0, zeit: 1 }, art: 'spur',
    punkte: [[47.6, 11.3, 'Hütte', 'einkehr'], [99, 11, 'kaputt', 'gipfel'], [47.61, 11.31, 'X', 'quatsch']], quelle: 'beispiel-touren.de', dateiDauer: 2.5 };
  const zur = R.sicherungLesen(JSON.stringify({ app: 'gipfel-und-gasse', touren: [tour] }))[0];
  pruef('Sicherung: Wegpunkte, Herkunft, Dauer der Datei', zur.punkte.length === 2 && zur.punkte[1][3] === 'punkt' && zur.quelle === 'beispiel-touren.de' && zur.dateiDauer === 2.5, zur);
}

// Wanderwege: Liste aus Relationen (ohne Namen raus, Fernwege zuletzt), Verlauf aus Wegstücken (umgedreht, Lücke)
{
  const mitte = { lat: 47.6, lon: 11.3 };
  const json = { elements: [
    { type: 'relation', id: 1, center: { lat: 47.62, lon: 11.3 }, tags: { route: 'hiking', name: 'Fernweg', network: 'nwn' } },
    { type: 'relation', id: 2, center: { lat: 47.61, lon: 11.3 }, tags: { route: 'hiking', name: 'Gratweg', network: 'lwn', distance: '6,1', roundtrip: 'yes', ref: '12' } },
    { type: 'relation', id: 3, center: { lat: 47.6, lon: 11.3 }, tags: { route: 'hiking' } },
    { type: 'relation', id: 4, center: { lat: 47.605, lon: 11.3 }, tags: { route: 'foot', ref: '7' } },
    { type: 'node', id: 5, lat: 47.6, lon: 11.3, tags: { name: 'kein Weg' } }] };
  const w = R.wegeLesen(json, mitte);
  pruef('Wanderwege: Namen, Nummer als Ersatz, Fernweg zuletzt', w.map(x => x.name).join('|') === 'Weg 7|Gratweg|Fernweg', w.map(x => x.name));
  pruef('Wanderwege: Beschreibung', R.wegText(w[1]) === '6,1 km · Rundweg · örtlich · Nr. 12 · 1,1 km entfernt', R.wegText(w[1]));
  const g = (a, b) => ({ lat: a, lon: b });
  const rel = { elements: [{ type: 'relation', id: 9, members: [
    { type: 'way', role: '', geometry: [g(47.600, 11.300), g(47.601, 11.300)] },
    { type: 'way', role: '', geometry: [g(47.602, 11.300), g(47.601, 11.300)] },
    { type: 'way', role: 'alternative', geometry: [g(47.7, 11.3), g(47.71, 11.3)] },
    { type: 'way', role: '', geometry: [g(47.610, 11.300), g(47.611, 11.300)] }] }] };
  const v = R.wegVerlauf(rel);
  pruef('Wanderwege: Stücke verbunden, zweites umgedreht, Alternative weg, Lücke markiert',
    v.length === 5 && v[1].lat === 47.601 && v[2].lat === 47.602 && !v[2].luecke && v[3].luecke === true && v[4].lat === 47.611, v);
  pruef('Wanderwege: ohne Relation kein Verlauf', R.wegVerlauf({ elements: [] }).length === 0);
}

pruef('Wanderwege: Abfrage über die Wege im Umkreis (schnell), ohne Mittelpunkt', /way\["highway"\]\(around:5000,47\.60000,11\.30000\);rel\(bw\)\["route"~"\^\(hiking\|foot\)\$"\];out tags 80;/.test(R.wegeAbfrage(47.6, 11.3, 5000)), R.wegeAbfrage(47.6, 11.3, 5000));

// Dienstfehler, Web-Mercator-Rechteck, Antwort von Waymarked Trails
pruef('Dienstfehler: Überlast kurz', R.dienstFehler(502, '# 502 Gateway Timeout ... at capacity') === 'Dienst gerade überlastet (alle Server belegt), bitte in ein paar Minuten noch einmal' &&
  R.dienstFehler(429, '') === 'zu viele Anfragen, bitte kurz warten' && R.dienstFehler(404, '<html>x</html>') === 'Fehler 404' && R.dienstFehler(400, 'position not mapped') === 'position not mapped');
{
  const b = R.bbox3857(0, 0, 1000);
  pruef('Web-Mercator: 1 km um 0/0', Math.abs(b[0] + 1000) < 2 && Math.abs(b[2] - 1000) < 2 && Math.abs(b[1] + 1000) < 2, b);
  const bb = R.bbox3857(47.6, 11.3, 5000);
  pruef('Web-Mercator: Walchensee in Metern', bb[0] > 1250000 && bb[0] < 1260000 && bb[1] > 6030000 && bb[3] < 6050000, bb);
  const w = R.wegeAusWmt({ results: [{ type: 'relation', id: 1, name: 'Fern', group: 'NAT' }, { type: 'relation', id: 2, ref: '7', group: 'LOC' }, { type: 'way', id: 3, name: 'x' }, { id: 'kaputt', name: 'y' }] });
  pruef('Waymarked Trails: Relationen, Nummer als Name, Fernweg zuletzt', w.map(x => x.name + '/' + x.netz).join() === 'Weg 7/örtlich,Fern/Fernwanderweg', w);
  const m = R.wegeAusWmt({ results: [{ type: 'relation', id: 4, name: 'Bike-Transalp', group: 'NAT' }, { type: 'relation', id: 5, name: 'MTB-Runde 3', group: 'LOC' }] }, null, 'mtb');
  pruef('Waymarked Trails MTB: „national“ statt Fernwanderweg, zuletzt', m.map(x => x.name + '/' + x.netz).join() === 'MTB-Runde 3/örtlich,Bike-Transalp/national', m);
  pruef('MTB-Routen: Overpass fragt route=mtb', /rel\(bw\)\["route"~"\^mtb\$"\];out tags 80;$/.test(R.wegeAbfrage(47.6, 11.3, 5000, 'mtb')), R.wegeAbfrage(47.6, 11.3, 5000, 'mtb'));
  const mo = R.wegeLesen({ elements: [{ type: 'relation', id: 6, tags: { name: 'Isartrail', route: 'mtb', network: 'lcn' } }] });
  pruef('MTB-Routen: Netz der Radrouten gelesen', mo.length === 1 && mo[0].netz === 'örtlich', mo);
}

// Routen aus dem Kartenpaket (Tourvorschläge ohne Netz)
{
  const r = R.routenEntpacken([[700, 'w', 'Proberunde', 'P1', 'lwn', true, [[4760000, 1130000, 1000, 0], [4762000, 1130000, 1000, 0]]], [701, 'm', 'MTB', '', '', false, [[4760000, 1130000, 0, 1000]]], ['kaputt']]);
  pruef('Paket-Routen: entpackt mit Art, Netz, Länge aus den Teilen', r.length === 2 && r[0].art === 'wandern' && r[0].netz === 'örtlich' && r[0].teile.length === 2 &&
    Math.abs(r[0].km - 2.2) < 0.05 && r[1].art === 'mtb', r.map(x => [x.name, x.km, x.netz]));
  const w = R.wegeAusPaket(r, { lat: 47.6, lon: 11.3 }, 2000, 'wandern');
  pruef('Paket-Routen: im Umkreis, Verlauf mit Lücke zwischen den Teilen', w.length === 1 && w[0].km === r[0].km && w[0].abstand < 1 && w[0].pts.length === 4 && w[0].pts[2].luecke === true && !w[0].pts[1].luecke, w);
  pruef('Paket-Routen: andere Art und zu weit weg nicht dabei', R.wegeAusPaket(r, { lat: 47.6, lon: 11.3 }, 2000, 'mtb').length === 1 && R.wegeAusPaket(r, { lat: 47.7, lon: 11.3 }, 2000, 'wandern').length === 0);
}

// Ordner der Touren
{
  pruef('Ordner: Name gekürzt, Steuerzeichen weg, kein Text → leer', R.ordnerName('  Karwendel\n  Nord ') === 'Karwendel Nord' && R.ordnerName('x'.repeat(80)).length === 60 && R.ordnerName(5) === '');
  const ol = R.ordnerListe([{ ordner: 'Mit Kind' }, { ordner: 'Karwendel' }, { ordner: 'Karwendel' }, {}], ['Leer', 'Karwendel']);
  pruef('Ordner: aus Touren und leeren Ordnern, nach Name, mit Zahl', ol.map(o => o.name + ':' + o.zahl).join() === 'Karwendel:2,Leer:0,Mit Kind:1', ol);
  const tp = R.sicherungLesen({ app: 'gipfel-und-gasse', touren: [{ id: 't1', name: 'A', spur: [[47.6, 11.3, 600]], kurz: { laenge: 1 }, ordner: ' Karwendel ' }, { id: 't2', name: 'B', spur: [[47.6, 11.3, 600]], kurz: { laenge: 1 }, ordner: 7 }] });
  pruef('Ordner-Farbe: gespeicherte aus der Liste, sonst fest aus dem Namen, freie zuerst', R.ordnerFarbe('A', { A: '#c62828' }) === '#c62828' && R.ordnerFarbe('A', { A: 'rot' }) === R.ordnerFarbe('A', {}) &&
    R.ORDNER_FARBEN.includes(R.ordnerFarbe('Karwendel')) && R.ordnerFarbeFrei(['A'], { A: R.ORDNER_FARBEN[0] }) === R.ORDNER_FARBEN[1]);
  pruef('Ordner: Sicherung behält ihn, ungültiger fällt weg', tp[0].ordner === 'Karwendel' && !('ordner' in tp[1]), tp);
}

// MTB-Trails nach Schwierigkeit (mtb:scale): Overpass und Format von karten/orte.py
{
  pruef('MTB-Skala: erste Ziffer, sonst nichts', [R.mtbSkala('2+'), R.mtbSkala('1-'), R.mtbSkala('3;4'), R.mtbSkala('0'), R.mtbSkala('x'), R.mtbSkala(null), R.mtbSkala('7')].join() === '2,1,3,0,,,', [R.mtbSkala('2+'), R.mtbSkala('x')]);
  pruef('MTB-Trails: Abfrage nur Wege mit mtb:scale im Ausschnitt', R.trailsAbfrage([47.5, 11.2, 47.6, 11.4]) === '[out:json][timeout:25];way["mtb:scale"]["highway"](47.5000,11.2000,47.6000,11.4000);out geom 4000;', R.trailsAbfrage([47.5, 11.2, 47.6, 11.4]));
  const o = R.trailsAusOverpass({ elements: [
    { type: 'way', id: 1, tags: { highway: 'path', 'mtb:scale': '2+', name: 'Jochberg-Trail' }, geometry: [{ lat: 47.6, lon: 11.3 }, { lat: 47.61, lon: 11.31 }] },
    { type: 'way', id: 2, tags: { highway: 'path', 'mtb:scale': 'unbekannt' }, geometry: [{ lat: 47.6, lon: 11.3 }, { lat: 47.61, lon: 11.31 }] },
    { type: 'way', id: 3, tags: { highway: 'path', 'mtb:scale': '1' }, geometry: [{ lat: 47.6, lon: 11.3 }] }] });
  pruef('MTB-Trails aus Overpass: Stufe, Name, Verlauf, Rahmen; ohne Stufe oder Verlauf weg', o.length === 1 && o[0].s === 2 && o[0].name === 'Jochberg-Trail' && o[0].pts.length === 2 && o[0].b.join() === '47.6,11.3,47.61,11.31', o);
  const p = R.trailsEntpacken([[1, 'A', [4760000, 1130000, 0, 100, 100, 100]], [4, '', [4800000, 1200000, 10, 10]], [2, 'kaputt', [1]]]);
  pruef('MTB-Trails aus dem Paket: Differenzen in 1e-5 Grad entpackt', p.length === 2 && p[0].pts.map(q => q.join('/')).join() === '47.6/11.3,47.6/11.301,47.601/11.302' && p[1].s === 4, p);
  const im = R.trailsImAusschnitt(p, [47.59, 11.29, 47.605, 11.31]);
  pruef('MTB-Trails: nur die im Ausschnitt', im.length === 1 && im[0].name === 'A', im);
  const [mx, my] = R.mercatorPixel(0, 0, 0), [kx, ky] = R.mercatorPixel(47.6, 11.3, 14);
  pruef('Web-Mercator in Pixeln: 0/0 in der Mitte, Kochel wie die übliche Kachelformel (z14)', mx === 128 && Math.abs(my - 128) < 1e-9 && Math.abs(kx / 256 - (11.3 + 180) / 360 * 16384) < 1e-6 && Math.abs(ky / 256 - (1 - Math.asinh(Math.tan(47.6 * Math.PI / 180)) / Math.PI) / 2 * 16384) < 1e-6, [mx, my, kx / 256, ky / 256]);
  const nah = R.naechsterTrail(p, { lat: 47.6001, lon: 11.3005 }, 30), weit = R.naechsterTrail(p, { lat: 47.61, lon: 11.3005 }, 30);
  pruef('MTB-Trails: Antippen findet den Trail bis zum Abstand, weiter weg keinen', nah && nah.name === 'A' && weit === null, [nah, weit]);
  pruef('MTB-Trails: Text mit Stufe und Erklärung', R.trailText(p[1]) === 'Weg ohne Namen · S4: steil, sehr enge Kehren' && R.TRAIL_FARBE[2] === '#e0301e', R.trailText(p[1]));
}

// Fotos: neueste zuerst, mit Reise und der zeitlich nächsten gegangenen Tour desselben Tages
{
  const t0 = Date.parse('2026-08-01T10:00:00Z');
  const tb = { reisen: [{ id: 'r1', name: 'Sommer' }], eintraege: [
    { id: 'e1', reise: 'r1', zeit: t0, fotos: ['f1', 'f2'] }, { id: 'e2', reise: 'r1', zeit: t0 + 864e5, fotos: ['f3'] }, { id: 'e3', reise: 'r1', zeit: t0, fotos: [] }] };
  const touren = [{ id: 'ta', art: 'aufzeichnung', datum: '2026-08-01T07:00:00Z', spur: [[47, 11, 0, t0 - 3 * 3.6e6]] },
    { id: 'tb', art: 'aufzeichnung', datum: '2026-08-01T07:00:00Z', spur: [[47, 11, 0, t0 + 0.5 * 3.6e6]] }, { id: 'tp', art: 'plan', datum: '2026-08-01T09:00:00Z', spur: [[47, 11, 0]] }];
  const l = R.fotoListe(tb, touren);
  pruef('Fotos: Liste neueste zuerst, mit Reise und Tour des Tages', l.map(x => x.foto).join() === 'f3,f1,f2' && l[0].tour === null && l[1].tour.id === 'tb' && l[1].reise.name === 'Sommer', l.map(x => [x.foto, x.tour && x.tour.id]));
}

// ZIP: Prüfsumme, Schreiben und Lesen, kaputte Dateien
{
  const enc = new TextEncoder();
  pruef('ZIP: CRC-32 wie üblich', R.crc32(enc.encode('123456789')) === 0xcbf43926);
  const bild = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5]);
  const teile = R.zipTeile([{ name: 'sicherung.json', daten: enc.encode('{"a":"ä"}') }, { name: 'fotos/f1.jpg', daten: bild }], Date.UTC(2026, 10, 4, 12));
  const zip = new Uint8Array(Buffer.concat(teile.map(t => Buffer.from(t))));
  const l = R.zipLesen(zip);
  pruef('ZIP: zwei Dateien hin und zurück', l.length === 2 && l[0].name === 'sicherung.json' && new TextDecoder().decode(l[0].daten) === '{"a":"ä"}' &&
    l[1].name === 'fotos/f1.jpg' && l[1].daten.length === 9 && R.bildArt(l[1].daten) === 'image/jpeg', l.map(x => [x.name, x.fehler]));
  const kaputt = zip.slice(); kaputt[30 + 'sicherung.json'.length] ^= 1;
  pruef('ZIP: falsche Prüfsumme erkannt', R.zipLesen(kaputt)[0].fehler === 'Prüfsumme falsch' && R.zipLesen(kaputt)[1].daten !== null);
  let w = ''; try { R.zipLesen(enc.encode('kein zip')); } catch (e) { w = e.message; }
  pruef('ZIP: keine ZIP-Datei', w === 'keine ZIP-Datei');
  pruef('Bildart an den ersten Bytes', R.bildArt(bild) === 'image/jpeg' && R.bildArt(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0])) === 'image/png' && R.bildArt(enc.encode('<svg>…</svg>')) === null);
  // mit Python zipfile (gespeichert) gebaut: liest sich ebenso
  const py = Buffer.from('UEsDBBQAAAAAAAAAIUisKpPYAgAAAAIAAAAFAAAAYS50eHRoaVBLAQIUAxQAAAAAAAAAIUisKpPYAgAAAAIAAAAFAAAAAAAAAAAAAACAAQAAAABhLnR4dFBLBQYAAAAAAQABADMAAAAlAAAAAAA=', 'base64');
  const lp = R.zipLesen(new Uint8Array(py));
  pruef('ZIP: Datei aus Python zipfile', lp.length === 1 && lp[0].name === 'a.txt' && new TextDecoder().decode(lp[0].daten) === 'hi', lp);
}

// EXIF: Ort und Aufnahmezeit aus einem JPEG (kleines Muster, Big-Endian wie viele Kameras)
{
  const tiff = [];
  const u16 = n => tiff.push(n >> 8 & 255, n & 255), u32 = n => tiff.push(n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255);
  const eintrag = (tag, typ, n, wert) => { u16(tag); u16(typ); u32(n); u32(wert); };
  // Kopf (8), IFD0 bei 8 mit 2 Einträgen (2+24+4=30) → Exif-IFD bei 38 (1 Eintrag: 18) → GPS-IFD bei 56 (4 Einträge: 54)
  // → Daten bei 110: Datum (20), Breite (24), Länge (24)
  tiff.push(0x4d, 0x4d); u16(42); u32(8);
  u16(2); eintrag(0x8769, 4, 1, 38); eintrag(0x8825, 4, 1, 56); u32(0);
  u16(1); eintrag(0x9003, 2, 20, 110); u32(0);
  u16(4); eintrag(1, 2, 2, 0x4e000000); eintrag(2, 5, 3, 130); eintrag(3, 2, 2, 0x45000000); eintrag(4, 5, 3, 154); u32(0);
  for (const c of '2026:08:01 10:30:00') tiff.push(c.charCodeAt(0)); tiff.push(0);
  const rat = (z, n) => { u32(z); u32(n); };
  rat(47, 1); rat(36, 1); rat(1800, 100);   // 47° 36' 18" = 47,605
  rat(11, 1); rat(20, 1); rat(0, 1);        // 11° 20' = 11,3333
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0].concat(tiff);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, (app1.length + 2) >> 8, (app1.length + 2) & 255].concat(app1, [0xff, 0xd9]));
  const x = R.exifLesen(jpg);
  pruef('EXIF: Ort und Aufnahmezeit', x && Math.abs(x.lat - 47.605) < 1e-6 && Math.abs(x.lon - 11.33333) < 1e-4 && x.zeit === new Date(2026, 7, 1, 10, 30).getTime(), x);
  pruef('EXIF: ohne EXIF nichts', R.exifLesen(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xd9])) === null && R.exifLesen(new Uint8Array([1, 2, 3])) === null);
}

// Stelle eines Fotos an der Tour: Ort aus dem Foto, sonst Zeitpunkt auf der Spur, sonst Ort des Eintrags
{
  const t0 = Date.parse('2026-08-01T08:00:00Z');
  const spur = [[47.60, 11.30, 800, t0], [47.61, 11.30, 900, t0 + 3.6e6], [47.62, 11.30, 1000, t0 + 7.2e6]];
  const nah = R.fotoOrt({ lat: 47.605, lon: 11.301 }, null, spur);
  pruef('Fotoort: Ort aus dem Foto', nah && nah.wie === 'gps' && nah.lat === 47.605);
  const zeit = R.fotoOrt({ lat: 48.2, lon: 11.6, zeit: t0 + 1.8e6 }, null, spur);
  pruef('Fotoort: Ort weit weg, dann Zeitpunkt auf der Spur', zeit && zeit.wie === 'zeit' && Math.abs(zeit.lat - 47.605) < 1e-9, zeit);
  const ein = R.fotoOrt(null, { zeit: t0 + 5 * 3.6e6, ort: { lat: 47.6201, lon: 11.3003 } }, spur);
  pruef('Fotoort: nach der Tour, Ort des Eintrags an der Spur', ein && ein.wie === 'eintrag');
  pruef('Fotoort: Eintrag abends im Hotel: keine Stelle', R.fotoOrt(null, { zeit: t0 + 10 * 3.6e6, ort: { lat: 47.70, lon: 11.30 } }, spur) === null);
  pruef('Fotoort: Zeit des Eintrags in der Tour', (R.fotoOrt(null, { zeit: t0 + 3.6e6 }, spur) || {}).lat === 47.61);
}
// Sicherung: Fotos aus der ZIP (Bytes) und Ort/Zeit je Foto bleiben, Fremdes fällt weg
{
  const bild = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
  const tb = R.tagebuchPruefen({ reisen: [{ id: 'r1', name: 'R', von: '2026-08-01', bis: '2026-08-02' }],
    eintraege: [{ id: 'e1', reise: 'r1', zeit: 1, fotos: ['f1', 'f2'], fotoInfo: { f1: { lat: 47, lon: 11, zeit: 5, boese: 1 }, f2: { lat: 'x' }, f9: { zeit: 1 } } }] },
    { f1: bild, f2: new Uint8Array([60, 115, 118, 103]) });
  const e = tb.eintraege[0];
  pruef('Sicherung: Foto als Bytes, Fremdes (kein Bild) fällt weg', e.fotos.join() === 'f1' && tb.fotos.f1 === bild);
  pruef('Sicherung: Ort und Zeit je Foto geprüft', JSON.stringify(e.fotoInfo) === '{"f1":{"lat":47,"lon":11,"zeit":5}}', e.fotoInfo);
}

// Packliste: je Tourart, Länge, Höhe, Tage und Wetter
{
  const ids = l => l.gruppen.flatMap(g => g.dinge.map(x => x.id));
  const was = (l, id) => (l.gruppen.flatMap(g => g.dinge).find(x => x.id === id) || {}).was;
  const kurz = R.packliste({ profil: 'wandern', stunden: 2, auf: 200, ab: 200, hoch: 800, tage: 1, wetter: null });
  pruef('Packliste: kurze Wanderung ohne Wetter', ids(kurz).includes('regenjacke') && !ids(kurz).includes('lampe') && !ids(kurz).includes('schlafsack') && was(kurz, 'wasser') === 'Wasser: 1 l' && kurz.hinweise.length === 1, ids(kurz));
  const alpin = R.packliste({ profil: 'wandern', stunden: 8, auf: 1400, ab: 1400, hoch: 2600, tage: 3, kind: false, dunkel: false,
    wetter: { min: -2, max: 27, regen: 60, wind: 50, gewitter: true, sonne: true } });
  const a = ids(alpin);
  pruef('Packliste: lange Hochtour mit Hütten, Kälte, Regen, Sonne, Gewitter',
    ['lampe', 'stoecke', 'shirt', 'rettung', 'groedel', 'muetze', 'creme', 'hose', 'wind', 'schlafsack', 'bar', 'powerbank'].every(x => a.includes(x)) &&
    was(alpin, 'wasser') === 'Wasser: 6 l' && was(alpin, 'waesche') === 'Wechselwäsche für 2 Nächte' && /Gewitter/.test(alpin.hinweise.join()), [a, alpin.hinweise]);
  const stadt = R.packliste({ profil: 'stadt', stunden: 3, hoch: 520, wetter: { min: 12, max: 18, regen: 70, wind: 10, gewitter: false, sonne: false } });
  pruef('Packliste: Stadt mit Regen: Schirm statt Regenhose, Fahrkarte', ids(stadt).includes('schirm') && !ids(stadt).includes('hose') && ids(stadt).includes('ticket') && !ids(stadt).includes('regenjacke'), ids(stadt));
  const kind = R.packliste({ profil: 'wandern', stunden: 3, hoch: 1600, kind: true });
  pruef('Packliste: mit Kind und in der Höhe Sonnenhut fürs Kind', ids(kind).includes('snacks') && ids(kind).includes('hut') && ids(kind).includes('creme'));
  const rad = R.packliste({ profil: 'rad', stunden: 2 });
  pruef('Packliste: Rad mit Helm und Flickzeug, ohne Wanderschuhe', ids(rad).includes('helm') && ids(rad).includes('flick') && !ids(rad).includes('schuhe'));
  const w = R.packWetter([{ temp: 5, regen: 10, code: 1, wind: 20, boe: 45 }, null, { temp: 12, regen: 55, code: 95, wind: 10, boe: null }]);
  pruef('Packliste: Wetter der Tour zusammengefasst', w.min === 5 && w.max === 12 && w.regen === 55 && w.wind === 45 && w.gewitter && w.sonne && R.packWetter([null]) === null, w);
}

// Mehrtagestour: Ausschnitt einer Etappe als eigene Route, Startzeit je Tag in der gespeicherten Tour
{
  const pts = [0, 1000, 2000, 3000, 4000].map((d, i) => ({ lat: 47 + i * 0.009, lon: 11, ele: 500 + i * 100, d }));
  const e = { pts, stueckEnde: [2000, 4000], hinweise: [{ d: 500, cmd: 'TL' }, { d: 2500, cmd: 'TR' }] };
  const a = R.etappeAusschnitt(e, { von: 1, bis: 2, vonD: 2000, bisD: 4000, zeit: 1, auf: 200, ab: 0, hoch: 900 });
  pruef('Etappe: Ausschnitt ab Meter 0 mit eigenen Hinweisen und Stopps', a.pts.length === 3 && a.pts[0].d === 0 && a.pts[2].d === 2000 && a.laenge === 2000 &&
    a.stueckEnde.join() === '2000' && a.hinweise.length === 1 && a.hinweise[0].d === 500 && a.hinweise[0].cmd === 'TR' && pts[2].d === 2000, a);
  const t = R.sicherungLesen(JSON.stringify({ app: 'gipfel-und-gasse', touren: [{ id: 't1', name: 'H', spur: [[47, 11, 0], [47.01, 11, 0]], kurz: { laenge: 1 }, zeit: { tag: '2026-07-10', start: '09:00', pause: 0, tage: ['', '07:30', 'x'] } }] }))[0];
  pruef('Etappe: Startzeit je Tag bleibt, Unsinn fällt weg', t && JSON.stringify(t.zeit.tage) === '["","07:30",""]', t && t.zeit);
}

// Mehrtagestour: Tour nach Gehzeit in gleich lange Tage teilen
{
  // 12 km flach, 13 Punkte je 1 km; Wegpunkte Start, ein Stopp bei 5 km, Ziel
  const pts = []; for (let i = 0; i <= 24; i++) pts.push({ lat: 47 + i * 0.0045, lon: 11, ele: 600, d: i * 500 });
  const wps = [{ lat: 47, lon: 11 }, { lat: 47.045, lon: 11 }, { lat: 47.108, lon: 11 }];
  const a2 = R.tagesAufteilung(pts, [5500, 12000], wps, 2, 1, 'fuss');
  pruef('Tage teilen: 2 Tage nutzen den Stopp bei 5,5 km (nah an der Hälfte)', a2.nacht.join() === '1' && a2.neu.length === 0, a2);
  const a3 = R.tagesAufteilung(pts, [5500, 12000], wps, 3, 1, 'fuss');
  pruef('Tage teilen: 3 Tage brauchen neue Punkte bei etwa 4 und 8 km', a3.nacht.length + a3.neu.length === 2 &&
    a3.neu.every(p => p.vor >= 1 && p.vor <= 2) && a3.neu.some(p => Math.abs(p.d - 8000) < 300), a3);
  const a1 = R.tagesAufteilung(pts, [5500, 12000], wps, 1, 1, 'fuss');
  pruef('Tage teilen: 1 Tag teilt nichts', a1.nacht.length === 0 && a1.neu.length === 0);
  const zwei = R.tagesAufteilung(pts, [12000], [wps[0], wps[2]], 2, 1, 'fuss');
  pruef('Tage teilen: ohne Zwischenpunkt ein neuer in der Mitte', zwei.neu.length === 1 && zwei.neu[0].vor === 1 && Math.abs(zwei.neu[0].d - 6000) < 300, zwei);
}

// Mehrtagestour: Zahl der Tage nach Gehzeit, Unterkunft an der Übernachtung
pruef('Tage: Vorschlag höchstens 6,5 h am Tag', R.tageVorschlag(3) === 2 && R.tageVorschlag(13) === 2 && R.tageVorschlag(13.1) === 3 && R.tageVorschlag(130) === 20 && R.tageVorschlag(999) === 30);
pruef('Tage: Auswahl um den Vorschlag', R.tageWahl(3).join() === '2,3,4,5' && R.tageWahl(20).join() === '18,19,20,21,22' && R.tageWahl(6).join() === '4,5,6,7,8', [R.tageWahl(3), R.tageWahl(20)]);
{
  const p = { lat: 47.6, lon: 11.3 };
  const json = { elements: [
    { type: 'node', id: 1, lat: 47.6018, lon: 11.3, tags: { tourism: 'hotel', name: 'Hotel Nah' } },          // 200 m + 500
    { type: 'way', id: 2, center: { lat: 47.6054, lon: 11.3 }, tags: { tourism: 'alpine_hut', name: 'Testhütte' } },   // 600 m + 0
    { type: 'node', id: 3, lat: 47.63, lon: 11.3, tags: { tourism: 'alpine_hut', name: 'Weit weg' } },        // 3,3 km
    { type: 'node', id: 4, lat: 47.6001, lon: 11.3, tags: { tourism: 'guest_house' } } ] };                   // ohne Namen
  const u = R.unterkunftWahl(json, p, 2000, new Set());
  pruef('Unterkunft: Berghütte vor dem näheren Hotel, ohne Namen und zu weit fällt weg', u && u.name === 'Testhütte' && u.art === 'Berghütte' && Math.abs(u.weg - 600) < 15, u);
  const u2 = R.unterkunftWahl(json, p, 2000, new Set(['way/2']));
  pruef('Unterkunft: schon vergebene Hütte nicht doppelt', u2 && u2.name === 'Hotel Nah');
  const q = R.unterkunftAbfrage([p, { lat: 47.7, lon: 11.4 }], 2000);
  pruef('Unterkunft: Abfrage je Übernachtung im Umkreis, nur mit Namen', (q.match(/around:2000,/g) || []).length === 2 && q.includes('alpine_hut') && q.includes('["name"]'), q);
}

// Bescheid geben, Passt die Tour zu mir, Telefon der Hütte
{
  const an = new Date(2026, 6, 10, 16, 30);
  const t = R.bescheidText({ name: 'Herzogstand', meter: 12300, stunden: 5.25, auf: 820, tage: 1, ankunft: an, start: { lat: 47.6, lon: 11.3 }, link: 'https://x.example/#tour' });
  pruef('Bescheid: Tour, Start, Rückkehr mit Notruf-Hinweis, Link', t.startsWith('Ich bin unterwegs: Herzogstand (12 km, ↑ 820 m, etwa 5:15 h).') && t.includes('query=47.60000,11.30000') &&
    t.includes('Zurück geplant gegen 16:30 Uhr') && t.includes('bis 18:30 Uhr nicht') && t.includes('Notruf 112') && t.endsWith('Route: https://x.example/#tour'), t);
  pruef('Bescheid: Ankunft', R.ankunftText('Herzogstand', an) === 'Bin gut angekommen (Herzogstand), 16:30 Uhr.');
  const leicht = R.tourCheck({ sac: { stufe: 1, meter: 5000 }, auf: 300, ab: 300, stunden: 3, hoch: 900, tempo: 1, tage: 1, art: 'fuss' });
  pruef('Tour-Check: leichte Wanderung', leicht.length === 2 && leicht.every(x => x.art === 'ok'), leicht);
  const schwer = R.tourCheck({ sac: { stufe: 3, meter: 1200 }, auf: 1400, ab: 1400, stunden: 8.5, hoch: 2600, tempo: 0.7, tage: 1, art: 'fuss' });
  pruef('Tour-Check: T3, viel Aufstieg, langer Tag, Höhe, mit Kind', schwer.filter(x => x.art === 'warn').length === 3 && schwer.some(x => x.text.includes('Knie')) && schwer.some(x => x.text.includes('2500 m')) &&
    schwer.some(x => /sehr langer Tag/.test(x.text)), schwer);
  pruef('Tour-Check: Mehrtagestour je Tag gerechnet', /↑ 600 m am Tag/.test(R.tourCheck({ sac: null, auf: 1800, ab: 1800, stunden: 6, tage: 3, art: 'fuss' })[1].text));
  pruef('Tour-Check: Rad und Laufen ohne Bergregeln', R.tourCheck({ sac: { stufe: 3, meter: 1 }, auf: 2000, art: 'rad' }).length === 0);
  pruef('Telefon: erste Nummer, Unsinn fällt weg', R.telAdresse('+49 8857 1234; +49 171 000000') === '+49 8857 1234' && R.telAdresse('ruf an') === null && R.telAdresse('123') === null);
  const u = R.unterkunftWahl({ elements: [{ type: 'node', id: 1, lat: 47.6, lon: 11.3, tags: { tourism: 'alpine_hut', name: 'H', phone: '+43 512 123456', website: 'huette.example', opening_hours: 'Jun-Sep' } }] }, { lat: 47.6, lon: 11.3 }, 2000, new Set());
  pruef('Unterkunft: Telefon, Webseite und Öffnung mitgenommen', u.info && u.info.tel === '+43 512 123456' && /^https:\/\/huette\.example/.test(u.info.web) && u.info.oh === 'Jun-Sep', u.info);
}

// alpines Notsignal: 6 Zeichen je Minute, dann eine Minute Pause
{
  let zeichen = 0, warAn = false;
  for (let t = 0; t < 120000; t += 100) { const an = R.notsignalAn(t); if (an && !warAn) zeichen++; warAn = an; }
  pruef('Notsignal: 6 Zeichen in der ersten Minute, keins in der Pause, dann wieder', zeichen === 6 && R.notsignalAn(0) && !R.notsignalAn(2000) && R.notsignalAn(10500) &&
    !R.notsignalAn(65000) && R.notsignalAn(120000), zeichen);
}

// Hangneigung: schiefe Ebene mit 1 m je Meter ⇒ 45°, flach ⇒ 0°; Farbstufen ab 30°
{
  const w = 8, eb = new Float32Array(w * w);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) eb[y * w + x] = x * 10;
  const g = R.hangneigung(eb, w, w, 10), flach = R.hangneigung(new Float32Array(w * w), w, w, 10);
  pruef('Hangneigung: 45° auf der Ebene, 0° im Flachen', Math.abs(g[3 * w + 3] - 45) < 1e-4 && flach[3 * w + 3] === 0, g[3 * w + 3]);
  pruef('Hangneigung: Farbstufen 30/35/40/45°, darunter keine', R.hangFarbe(29.9) === null && R.hangFarbe(30)[0] === 235 && R.hangFarbe(37)[1] === 140 &&
    R.hangFarbe(42)[0] === 225 && R.hangFarbe(50)[2] === 170);
}

// Gipfelbuch: Fotos vom Gipfel (Ort aus dem Foto oder Zeitpunkt auf der Spur, bis 150 m), nur von Touren mit Besuch
{
  const g = { lat: 47.5, lon: 11.0, besuche: [{ datum: '2026-07-01', tour: 't1', name: 'Tour' }] };
  const spur = [[47.49, 11.0, 900, 1000], [47.5, 11.0, 1800, 5000], [47.49, 11.0, 900, 9000]];
  const t1 = { id: 't1', spur }, t2 = { id: 't2', spur };
  const eintraege = new Map([['e1', { id: 'e1', zeit: 5000, fotoInfo: { a: { lat: 47.5005, lon: 11.0 } } }], ['e2', { id: 'e2', zeit: 1000 }], ['e3', { id: 'e3', zeit: 5100 }]]);
  const liste = [{ foto: 'a', eintrag: 'e1', tour: t1 }, { foto: 'b', eintrag: 'e2', tour: t1 }, { foto: 'c', eintrag: 'e3', tour: t1 }, { foto: 'd', eintrag: 'e3', tour: t2 }, { foto: 'e', eintrag: 'e3', tour: null }];
  const f = R.gipfelFotos(g, liste, eintraege, 150).map(x => x.foto);
  pruef('Gipfelbuch-Fotos: GPS am Gipfel und Zeitpunkt oben, nicht im Tal und nicht von anderen Touren', JSON.stringify(f) === '["a","c"]', f);
}

// Tagebuch: Etappen einer Reise bleiben in der Sicherung, nur bekannte Felder und Zahlen
{
  const tb = R.tagebuchPruefen({ reisen: [{ id: 'r1', name: 'Hütten', von: '2026-07-10', bis: '2026-07-11', etappen: [{ ziel: 'Hütte', meter: 12000, auf: 900, ab: 200, zeit: 5.5, boese: '<x>' }, null, { ziel: 7, meter: 'x' }] }], eintraege: [] }, {});
  const et = tb.reisen[0].etappen;
  pruef('Tagebuch: Etappen geprüft übernommen', et.length === 2 && et[0].ziel === 'Hütte' && et[0].zeit === 5.5 && !('boese' in et[0]) && et[1].ziel === '' && et[1].meter === 0, et);
}

// Warteschlange (BRouter, höchstens drei): wird ein Platz frei und kommt sofort eine neue Anfrage, darf sie sich nicht
// vor die wartende drängen; es laufen nie mehr als drei
async function warteschlangePruefen() {
  const q = R.warteschlange(3), laeuft = new Set();
  let max = 0;
  const auf = n => q.platz().then(() => { laeuft.add(n); max = Math.max(max, laeuft.size); });
  const fertig = n => { laeuft.delete(n); q.frei(); };
  auf(1); auf(2); auf(3); auf(4);
  await null; await null;
  fertig(1); auf(5);          // frei, und gleich danach eine neue Anfrage
  for (let i = 0; i < 5; i++) await null;
  const nachEinem = [...laeuft].sort().join(',');
  fertig(2); fertig(3); fertig(4);
  for (let i = 0; i < 5; i++) await null;
  pruef('Warteschlange: nie mehr als drei, die wartende kommt vor der neuen dran', max === 3 && nachEinem === '2,3,4' && laeuft.has(5) && q.aktiv === 1, [max, nachEinem, [...laeuft], q.aktiv]);
}
warteschlangePruefen().then(() => {
console.log('Einheitstests: ' + ok + ' bestanden, ' + fehler + ' fehlgeschlagen');
process.exit(fehler ? 1 : 0);
});
