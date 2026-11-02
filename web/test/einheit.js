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
pruef('Sicherung ohne Tagebuch: leer', R.sicherungTagebuch('{"app":"gipfel-und-gasse","touren":[]}').reisen.length === 0);

console.log('Einheitstests: ' + ok + ' bestanden, ' + fehler + ' fehlgeschlagen');
process.exit(fehler ? 1 : 0);
