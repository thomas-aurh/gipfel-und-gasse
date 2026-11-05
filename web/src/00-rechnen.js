// Reine Rechnungen: ohne DOM und ohne Netz. test/einheit.js lädt diese Datei allein in Node und prüft sie.
// Punkte sind Objekte {lat, lon, ele, d}: ele in Metern oder null, d = Meter ab Start.
var R = (function () {
  'use strict';
  const RAD = Math.PI / 180;

  // Entfernung zweier Punkte in Metern (Haversine, Erdradius 6371 km)
  function abstand(a, b) {
    const dLat = (b.lat - a.lat) * RAD, dLon = (b.lon - a.lon) * RAD;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  // setzt d (Meter ab Start) an jedem Punkt, gibt die Gesamtlänge zurück.
  // Ein Punkt mit luecke = true beginnt einen neuen Abschnitt (z. B. zweite Aufnahme in einer GPX-Datei):
  // der Sprung dorthin zählt nicht als Weg.
  function laengen(pts, start) {
    let d = start || 0;
    for (let i = 0; i < pts.length; i++) {
      if (i > 0 && !pts[i].luecke) d += abstand(pts[i - 1], pts[i]);
      pts[i].d = d;
    }
    return d - (start || 0);
  }

  // Auf- und Abstieg mit Schwelle: kleine Wackler des Höhenmodells zählen nicht mit.
  function hoehenmeter(eles, schwelle) {
    if (schwelle == null) schwelle = 5;
    let auf = 0, ab = 0, ref = null;
    for (const e of eles) {
      if (e == null || isNaN(e)) continue;
      if (ref == null) { ref = e; continue; }
      const diff = e - ref;
      if (diff >= schwelle) { auf += diff; ref = e; }
      else if (diff <= -schwelle) { ab -= diff; ref = e; }
    }
    return { auf: Math.round(auf), ab: Math.round(ab) };
  }

  // Höhenmeter einer Strecke mit Abschnitten (GPX-trkseg): der Sprung über eine Lücke (Seilbahn, Pause ohne
  // Aufzeichnung) zählt nicht, jeder Abschnitt wird für sich gerechnet
  function hoehenmeterSpur(pts, schwelle) {
    let auf = 0, ab = 0, teil = [];
    const fertig = () => { const h = hoehenmeter(teil, schwelle); auf += h.auf; ab += h.ab; teil = []; };
    for (const p of pts) { if (p.luecke) fertig(); teil.push(p.ele); }
    fertig();
    return { auf, ab };
  }

  // Gehzeit in Stunden nach DIN 33466 (wie die Wegweiser der Alpenvereine):
  // 4 km/h in der Ebene, 300 Hm/h bergauf, 500 Hm/h bergab; die größere Zeit plus die Hälfte der kleineren.
  // tempo: 1 = normal, 0.7 = mit Kind, 1.2 = zügig
  function gehzeit(meter, auf, ab, tempo) {
    const h = meter / 1000 / 4, v = auf / 300 + ab / 500;
    return (Math.max(h, v) + Math.min(h, v) / 2) / (tempo || 1);
  }

  // Schätzungen auf 5 Minuten gerundet, gemessene Dauer (genau = true) minutengenau
  function zeitText(stunden, genau) {
    if (!isFinite(stunden)) return '–';
    let min = genau ? Math.floor(stunden * 60) : Math.round(stunden * 60 / 5) * 5;
    if (!genau && stunden > 0 && min === 0) min = 5;
    const h = Math.floor(min / 60), m = min % 60;
    return h ? h + ':' + String(m).padStart(2, '0') + ' h' : m + ' min';
  }

  function kmText(meter) {
    if (meter < 1000) return Math.round(meter) + ' m';
    return (meter / 1000).toFixed(meter < 10000 ? 1 : 0).replace('.', ',') + ' km';
  }

  // "highway=path surface=ground sac_scale=hiking" → {highway:'path', …}
  function tagsLesen(text) {
    const o = {};
    if (!text) return o;
    for (const teil of String(text).split(/\s+/)) {
      const i = teil.indexOf('=');
      if (i > 0) o[teil.slice(0, i)] = teil.slice(i + 1);
    }
    return o;
  }

  // Schwierigkeit nach der SAC-Wanderskala (OSM-Merkmal sac_scale)
  const SAC = {
    hiking: { stufe: 1, text: 'T1 Wandern' },
    mountain_hiking: { stufe: 2, text: 'T2 Bergwandern' },
    demanding_mountain_hiking: { stufe: 3, text: 'T3 anspruchsvolles Bergwandern' },
    alpine_hiking: { stufe: 4, text: 'T4 Alpinwandern' },
    demanding_alpine_hiking: { stufe: 5, text: 'T5 anspruchsvolles Alpinwandern' },
    difficult_alpine_hiking: { stufe: 6, text: 'T6 schwieriges Alpinwandern' }
  };

  const STRASSE = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|road)(_link)?$/;
  const FEST = /^(asphalt|paved|concrete(:.*)?|paving_stones|sett|cobblestone|metal|wood|unhewn_cobblestone|chipseal)$/;
  const SCHOTTER = /^(gravel|fine_gravel|compacted|pebblestone|grass_paver)$/;
  const NATUR = /^(ground|dirt|earth|grass|mud|sand|unpaved|woodchips|soil)$/;

  function wegtyp(t) {
    const h = t.highway || '';
    if (h === 'steps') return 'Treppe';
    if (h === 'path' || h === 'bridleway') return 'Pfad';
    if (h === 'track') return 'Forst- und Feldweg';
    if (h === 'footway' || h === 'pedestrian') return 'Fußweg';
    if (h === 'cycleway') return 'Radweg';
    if (STRASSE.test(h)) return (h === 'residential' || h === 'living_street' || h === 'service' || h === 'unclassified') ? 'Nebenstraße' : 'Straße';
    if (t.route === 'ferry') return 'Fähre';
    return h ? 'Sonstiges' : 'Unbekannt';
  }

  function untergrund(t) {
    const s = t.surface || '';
    if (s) {
      if (FEST.test(s)) return 'Befestigt';
      if (SCHOTTER.test(s)) return 'Schotter';
      if (s === 'rock' || s === 'stone') return 'Fels';
      if (NATUR.test(s)) return 'Naturboden';
      return 'Unbekannt';
    }
    // ohne surface nur dort schließen, wo es fast immer stimmt
    if (STRASSE.test(t.highway || '')) return 'Befestigt';
    const g = t.tracktype;
    if (g === 'grade1') return 'Befestigt';
    if (g === 'grade2' || g === 'grade3') return 'Schotter';
    if (g === 'grade4' || g === 'grade5') return 'Naturboden';
    return 'Unbekannt';
  }

  // Abschnitte [{m, tags}] zu Anteilen {Name: Meter}, absteigend sortiert
  function anteile(abschnitte, fn) {
    const o = {};
    for (const a of abschnitte) { const k = fn(a.tags); o[k] = (o[k] || 0) + a.m; }
    return Object.entries(o).sort((x, y) => y[1] - x[1]);
  }

  // größte Steigung in Prozent, gemittelt über mindestens `fenster` Meter
  function maxSteigung(pts, fenster) {
    fenster = fenster || 100;
    // letzte Lücke bis Punkt k: ein Fenster über eine Lücke hinweg wäre ein Sprung, keine Steigung
    const lueckeBis = [];
    for (let k = 0, g = -1; k < pts.length; k++) { if (pts[k].luecke) g = k; lueckeBis.push(g); }
    let best = 0, j = 0;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].ele == null) continue;
      while (j < pts.length && (pts[j].d - pts[i].d < fenster || pts[j].ele == null)) j++;
      if (j >= pts.length) break;
      if (lueckeBis[j] > i) continue;
      const g = Math.abs(pts[j].ele - pts[i].ele) / (pts[j].d - pts[i].d) * 100;
      if (g > best) best = g;
    }
    return Math.round(best);
  }

  // Einschätzung für Kinderwagen und Buggy, mit Gründen
  function kinderwagen(abschnitte, steigung) {
    const ges = abschnitte.reduce((s, a) => s + a.m, 0) || 1;
    let treppe = 0, pfad = 0, rau = 0, unbekannt = 0, sac = 0;
    for (const a of abschnitte) {
      const t = a.tags, u = untergrund(t), w = wegtyp(t);
      if (w === 'Treppe') treppe += a.m;
      if (w === 'Pfad') pfad += a.m;
      if (u === 'Naturboden' || u === 'Fels') rau += a.m;
      if (u === 'Unbekannt') unbekannt += a.m;
      if (SAC[t.sac_scale] && SAC[t.sac_scale].stufe >= 2) sac += a.m;
    }
    const gruende = [];
    if (treppe > 0) gruende.push('Treppen auf ' + kmText(treppe));
    if (sac > 0) gruende.push('Bergwege ab T2 auf ' + kmText(sac));
    if (pfad / ges > 0.1) gruende.push(Math.round(pfad / ges * 100) + ' % schmale Pfade');
    if (rau / ges > 0.15) gruende.push(Math.round(rau / ges * 100) + ' % Naturboden oder Fels');
    if (steigung > 12) gruende.push('Steigung bis ' + steigung + ' %');
    let urteil;
    if (treppe > 0 || sac > 0 || pfad / ges > 0.25) urteil = 'nein';
    else if (gruende.length) urteil = 'mit Mühe';
    else if (unbekannt / ges > 0.3) { urteil = 'unklar'; gruende.push('Untergrund auf ' + Math.round(unbekannt / ges * 100) + ' % nicht erfasst'); }
    else urteil = 'ja';
    return { urteil, gruende };
  }

  // Schwierigste Stelle nach SAC
  function schwierigkeit(abschnitte) {
    let best = null, meter = 0;
    for (const a of abschnitte) {
      const s = SAC[a.tags.sac_scale];
      if (!s) continue;
      if (!best || s.stufe > best.stufe) { best = s; meter = a.m; }
      else if (s.stufe === best.stufe) meter += a.m;
    }
    return best ? { stufe: best.stufe, text: best.text, meter } : null;
  }

  // Antwort von BRouter (format=geojson) in Punkte und Abschnitte zerlegen
  function brouterLesen(gj) {
    const f = gj && gj.features && gj.features[0];
    if (!f || !f.geometry || !f.geometry.coordinates) throw new Error('BRouter: keine Route in der Antwort');
    const pts = f.geometry.coordinates.map(c => ({ lat: c[1], lon: c[0], ele: c.length > 2 && c[2] != null ? +c[2] : null }));
    const msgs = (f.properties && f.properties.messages) || [];
    const abschnitte = [];
    if (msgs.length > 1) {
      const k = msgs[0], iD = k.indexOf('Distance'), iT = k.indexOf('WayTags');
      for (let i = 1; i < msgs.length; i++) {
        const m = +msgs[i][iD] || 0;
        if (m > 0) abschnitte.push({ m, tags: tagsLesen(msgs[i][iT]) });
      }
    }
    // Abbiegehinweise (BRouter „voicehints“, Modus 2): [Punktindex, Befehl, Ausfahrt, Meter bis zum nächsten, Winkel]
    const hinweise = ((f.properties && f.properties.voicehints) || [])
      .filter(v => Array.isArray(v) && v.length >= 2)
      .map(v => ({ i: +v[0], cmd: +v[1], exit: Math.abs(+v[2] || 0) }));   // Kreisverkehr links (14): Ausfahrt negativ
    return { pts, abschnitte, hinweise };
  }

  // Abbiegehinweis als kurzer deutscher Text (Befehlscodes von BRouter)
  function hinweisText(cmd, exit) {
    const t = {
      2: 'links abbiegen', 3: 'leicht links', 4: 'scharf links', 5: 'rechts abbiegen', 6: 'leicht rechts', 7: 'scharf rechts',
      8: 'links halten', 9: 'rechts halten', 10: 'wenden', 11: 'wenden', 15: 'wenden', 17: 'links ausfahren', 18: 'rechts ausfahren'
    }[cmd];
    if (t) return t;
    if (cmd === 13 || cmd === 14) return exit ? 'im Kreisverkehr die ' + exit + '. Ausfahrt' : 'in den Kreisverkehr';
    return null;   // geradeaus, Luftlinie, Ende: keine Ansage
  }

  // Richtung von a nach b in Grad (0 = Nord, 90 = Ost)
  function richtung(a, b) {
    const y = Math.sin((b.lon - a.lon) * RAD) * Math.cos(b.lat * RAD);
    const x = Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lon - a.lon) * RAD);
    return (Math.atan2(y, x) / RAD + 360) % 360;
  }

  // Abbiegen aus Ankunfts- und Weiterrichtung (Grad): BRouter-Befehlscode oder null (unter 30° = geradeaus)
  function abbiegeBefehl(rein, raus) {
    const w = ((raus - rein + 540) % 360) - 180;   // −180 … 180, negativ = links
    const a = Math.abs(w);
    if (a < 30) return null;
    if (a < 60) return w < 0 ? 3 : 6;
    if (a < 135) return w < 0 ? 2 : 5;
    return w < 0 ? 4 : 7;
  }

  // BRouter-Kachel (5°-Raster) eines Punkts, z. B. „E10_N45“
  function routenKachel(lon, lat) {
    const x = Math.floor(lon / 5) * 5, y = Math.floor(lat / 5) * 5;
    return (x < 0 ? 'W' + (-x) : 'E' + x) + '_' + (y < 0 ? 'S' + (-y) : 'N' + y);
  }

  // gerade Linie, alle ~50 m ein Punkt (für Höhenwerte und das Profil)
  function linie(a, b) {
    const m = abstand(a, b), n = Math.max(1, Math.ceil(m / 50)), pts = [];
    for (let i = 0; i <= n; i++) pts.push({ lat: a.lat + (b.lat - a.lat) * i / n, lon: a.lon + (b.lon - a.lon) * i / n, ele: null });
    return { pts, abschnitte: [{ m, tags: {} }] };
  }

  // Fahrzeit Rad grob: 16 km/h plus 600 Höhenmeter je Stunde bergauf
  function fahrzeit(meter, auf, tempo) {
    return (meter / 1000 / 16 + auf / 600) / (tempo || 1);
  }

  // Laufen: Tempo in Minuten je km; 100 m bergauf zählen wie 1 km in der Ebene (Leistungs-Kilometer wie bei ITRA)
  function laufzeit(meter, auf, pace) {
    return (meter / 1000 + auf / 100) * (pace || 6) / 60;
  }
  // Zeit je Art: tempo ist bei „lauf“ das Lauftempo (min/km), sonst ein Faktor (1 = normal)
  function zeitFuer(art, meter, auf, ab, tempo) {
    return art === 'rad' ? fahrzeit(meter, auf, tempo) : art === 'lauf' ? laufzeit(meter, auf, tempo) : gehzeit(meter, auf, ab, tempo);
  }
  // Tempo als „5:42 min/km“
  function paceText(minProKm) {
    if (!isFinite(minProKm) || minProKm <= 0) return '–';
    let s = Math.round(minProKm * 60);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + ' min/km';
  }
  // Auto-Pause (wie AutoPause.java): länger als still ms ohne Weg = Pause ab der letzten Bewegung
  function autoPause(start, pauseMs, still) {
    const p = { start, pauseMs: pauseMs || 0, letzte: start, pausiert: false, still: still || 10000 };
    p.bewegt = t => { const weiter = p.pausiert; if (p.pausiert || t - p.letzte > p.still) { p.pauseMs += Math.max(0, t - p.letzte); p.pausiert = false; } p.letzte = t; return weiter; };
    p.takt = t => { if (p.pausiert || t - p.letzte <= p.still) return false; p.pausiert = true; return true; };
    p.bewegungMs = t => Math.max(0, t - p.start - p.pauseMs - (p.pausiert ? Math.max(0, t - p.letzte) : 0));
    return p;
  }

  // Rundkurs mit Wunschlänge: Dreieck Start–P1–P2–Start. Ein gleichseitiges Dreieck mit Umkreisradius r ist 3·√3·r lang;
  // Wege sind länger als die Luftlinie (Faktor umweg, anfangs 1,3), daraus r. richtung: Grad ab Nord zur Mitte des Kreises.
  function rundkursPunkte(start, meter, richtung, umweg) {
    const r = meter / ((umweg || 1.3) * 3 * Math.sqrt(3));
    const mitte = versatz(start, r, richtung);
    // Start liegt auf dem Kreis gegenüber der Richtung; die anderen Ecken 120° weiter
    const winkel = (richtung + 180) % 360;
    return [versatz(mitte, r, winkel + 120), versatz(mitte, r, winkel + 240)];
  }
  // Punkt d Meter in Richtung grad (0 = Nord) von p
  function versatz(p, d, grad) {
    const b = grad * RAD, dLat = d * Math.cos(b) / 111320, dLon = d * Math.sin(b) / (111320 * Math.cos(p.lat * RAD));
    return { lat: p.lat + dLat, lon: p.lon + dLon };
  }

  // Ansage nach jedem Kilometer: Gesamtzeit und Tempo des letzten Kilometers (Millisekunden)
  function kmAnsage(km, gesamtMs, kmMs) {
    const dauer = ms => { const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sek = s % 60;
      return (h ? h + (h === 1 ? ' Stunde ' : ' Stunden ') : '') + m + (m === 1 ? ' Minute' : ' Minuten') + (h ? '' : ' ' + sek + (sek === 1 ? ' Sekunde' : ' Sekunden')); };
    const s = Math.round(kmMs / 1000);
    return km + (km === 1 ? ' Kilometer' : ' Kilometer') + '. Zeit ' + dauer(gesamtMs) + '. Letzter Kilometer ' +
      Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '.';
  }

  // Teilstücke (je Wegpunkt-Paar) zu einer Strecke zusammensetzen und auswerten.
  // Jeder Abschnitt bekommt von/bis (Meter ab Start); BRouter zählt Längen etwas anders als die Geometrie,
  // darum wird je Teilstück auf dessen Länge gestreckt.
  function auswerten(stuecke, tempo, art) {
    const pts = [], grenzen = [];
    for (const s of stuecke) {
      const start = pts.length ? 1 : 0;   // gemeinsamen Punkt nicht doppelt
      const von = Math.max(0, pts.length - 1);
      for (let i = start; i < s.pts.length; i++) {
        const q = s.pts[i], p = { lat: q.lat, lon: q.lon, ele: q.ele };
        if (q.t) p.t = q.t;            // Zeitstempel von Aufzeichnungen bleiben erhalten
        if (q.luecke) p.luecke = true;
        pts.push(p);
      }
      grenzen.push([von, pts.length - 1]);
    }
    const laenge = laengen(pts);
    const abschnitte = [], stueckEnde = [], hinweise = [];
    stuecke.forEach((s, k) => {
      // Abbiegehinweise: Punktindex im Teilstück → Meter ab Start der ganzen Strecke
      for (const h of s.hinweise || []) {
        const p = pts[grenzen[k][0] + h.i];
        if (p && h.i > 0 && hinweisText(h.cmd, h.exit)) hinweise.push({ d: p.d, cmd: h.cmd, exit: h.exit });
      }
      const a = pts[grenzen[k][0]] ? pts[grenzen[k][0]].d : 0, b = pts[grenzen[k][1]] ? pts[grenzen[k][1]].d : a;
      stueckEnde.push(b);
      const summe = s.abschnitte.reduce((x, y) => x + y.m, 0) || 1, f = (b - a) / summe;
      let d = a;
      for (const ab of s.abschnitte) { abschnitte.push({ m: ab.m, tags: ab.tags, von: d, bis: d + ab.m * f }); d += ab.m * f; }
    });
    // Übergänge an Zwischenzielen: jedes Teilstück kennt nur seine eigenen Abzweigungen. Biegt die Route genau am
    // Zwischenziel ab, fehlt der Hinweis; hier aus der Richtung 25 m davor und 25 m danach ermitteln.
    for (let k = 0; k < stuecke.length - 1; k++) {
      const via = grenzen[k][1], dv = pts[via] && pts[via].d;
      if (dv == null || hinweise.some(h => Math.abs(h.d - dv) < 25)) continue;
      let i0 = via, i1 = via;
      while (i0 > 0 && dv - pts[i0].d < 25) i0--;
      while (i1 < pts.length - 1 && pts[i1].d - dv < 25) i1++;
      if (i0 === via || i1 === via || pts[via + 1] && pts[via + 1].luecke) continue;
      const cmd = abbiegeBefehl(richtung(pts[i0], pts[via]), richtung(pts[via], pts[i1]));
      if (cmd) hinweise.push({ d: dv, cmd, exit: 0, uebergang: true });
    }
    hinweise.sort((a, b) => a.d - b.d);
    const hm = hoehenmeterSpur(pts);
    // Schleife statt Math.max(...): große Aufzeichnungen sprengen sonst den Aufrufstapel
    let hoch = null, tief = null;
    for (const p of pts) if (p.ele != null && !isNaN(p.ele)) { if (hoch == null || p.ele > hoch) hoch = p.ele; if (tief == null || p.ele < tief) tief = p.ele; }
    const steigung = maxSteigung(pts);
    return {
      pts, abschnitte, laenge, stueckEnde, hinweise,
      auf: hm.auf, ab: hm.ab,
      hoch: hoch == null ? null : Math.round(hoch),
      tief: tief == null ? null : Math.round(tief),
      zeit: zeitFuer(art, laenge, hm.auf, hm.ab, tempo),
      steigung,
      sac: schwierigkeit(abschnitte),
      wege: anteile(abschnitte, wegtyp),
      boden: anteile(abschnitte, untergrund),
      kinderwagen: kinderwagen(abschnitte, steigung)
    };
  }

  // nächster Punkt der Strecke zu einer Position: {i, d (Meter ab Start), abw (Meter neben der Strecke)}.
  // vorher: bisheriger Fortschritt in Metern. Dann zählt zuerst nur das Stück kurz davor bis 2 km danach,
  // damit bei Rundtouren und Wegen, die zweimal begangen werden, nicht ans Ende gesprungen wird.
  function aufStrecke(pts, pos, vorher) {
    const kx = Math.cos(pos.lat * RAD) * 111320, ky = 110540;
    const suche = (von, bis) => {
      let best = null;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1];
        if (b.luecke || b.d < von || a.d > bis) continue;   // über eine Lücke führt kein Weg
        const ax = (a.lon - pos.lon) * kx, ay = (a.lat - pos.lat) * ky;
        const bx = (b.lon - pos.lon) * kx, by = (b.lat - pos.lat) * ky;
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        let t = l2 ? -(ax * dx + ay * dy) / l2 : 0;
        t = Math.max(0, Math.min(1, t));
        const px = ax + t * dx, py = ay + t * dy, abw = Math.sqrt(px * px + py * py);
        if (!best || abw < best.abw - 0.01) best = { i, abw, d: a.d + t * (b.d - a.d) };
      }
      return best;
    };
    let best = null;
    if (vorher != null) best = suche(vorher - 300, vorher + 2000);
    if (!best || best.abw > 150) {
      const alle = suche(-Infinity, Infinity);
      if (alle && (!best || alle.abw < best.abw)) best = alle;
    }
    if (!best && pts.length) best = { i: 0, abw: abstand(pts[0], pos), d: 0 };
    return best;
  }

  // was ab Meter d noch kommt
  function rest(pts, d, tempo, art) {
    const vor = [];
    let i = 0;
    while (i < pts.length && pts[i].d < d) i++;
    // Höhe genau an der aktuellen Stelle, zwischen den Nachbarpunkten eingerechnet
    if (i > 0 && i < pts.length && pts[i - 1].ele != null && pts[i].ele != null && pts[i].d > pts[i - 1].d) {
      const t = (d - pts[i - 1].d) / (pts[i].d - pts[i - 1].d);
      vor.push({ ele: pts[i - 1].ele + (pts[i].ele - pts[i - 1].ele) * t });
    }
    const ges = pts.length ? pts[pts.length - 1].d : 0;
    const hm = hoehenmeterSpur(vor.concat(pts.slice(i)));
    const m = Math.max(0, ges - d);
    return { meter: m, auf: hm.auf, ab: hm.ab, zeit: zeitFuer(art, m, hm.auf, hm.ab, tempo) };
  }

  // Zeit (Stunden) vom Start bis Meter d: dieselbe Formel wie die ganze Strecke, auf das Stück davor angewandt
  function zeitBis(pts, d, tempo, art) { return zeitZwischen(pts, 0, d, tempo, art); }
  // Zeit (Stunden) für das Stück von Meter a bis b, für sich gerechnet (Etappe, Weg bis zum Stopp ab der Übernachtung):
  // die Gehzeitformel ist nicht additiv, die Differenz zweier Gesamtzeiten wäre falsch
  function zeitZwischen(pts, a, b, tempo, art) {
    const teil = etappenStueck(pts, a, b);
    if (teil.length < 2) return 0;
    const hm = hoehenmeterSpur(teil);
    return zeitFuer(art, Math.max(0, Math.min(b, teil[teil.length - 1].d) - Math.max(a, teil[0].d)), hm.auf, hm.ab, tempo);
  }
  // Punkte von Meter a bis b; der erste Punkt beginnt nie mit einem Sprung, und ein Punkt hinter einer Lücke genau an der
  // Grenze (gleiches d) gehört schon zum nächsten Stück
  function etappenStueck(pts, a, b) {
    const teil = pts.filter(p => p.d >= a - 0.01 && p.d <= b + 0.01);
    while (teil.length > 1 && teil[teil.length - 1].luecke) teil.pop();
    if (teil.length && teil[0].luecke) teil[0] = Object.assign({}, teil[0], { luecke: false });
    return teil;
  }

  // was ein Stopp aus OSM mitnimmt: Öffnungszeiten (Zeitplan-Prüfung) und Wikipedia (Vorlesen unterwegs)
  // dazu (Abgleich 03.11., docs/oeffnungszeiten-abgleich.md): Prüfdatum der Zeiten, Webseite und Adresse, damit man die
  // Angabe vor dem Besuch nachsehen kann
  function stoppInfo(tags) {
    if (!tags) return null;
    const adr = [[tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' '), [tags['addr:postcode'], tags['addr:city'] || tags['addr:place']].filter(Boolean).join(' ')]
      .filter(Boolean).join(', ');
    return infoPruefen({ oh: tags.opening_hours, wp: tags.wikipedia, wd: tags.wikidata, ohd: ohDatum(tags),
      web: [tags.website, tags['contact:website']].map(webAdresse).find(Boolean), adr });
  }
  // erstes gültiges Prüfdatum (eigenes für die Öffnungszeiten vor dem allgemeinen); auch nur das Jahr
  const OH_DATUM = /^\d{4}(-(0[1-9]|1[0-2])(-\d{2})?)?$/;
  function ohDatum(tags) { return [tags['check_date:opening_hours'], tags.check_date].find(d => typeof d === 'string' && OH_DATUM.test(d)); }
  // Webseite nur als http(s); „www.museum.de“ ohne Schema bekommt https://
  function webAdresse(w) {
    if (typeof w !== 'string') return null;
    w = w.trim();
    if (/^www\.\S+$/i.test(w)) w = 'https://' + w;
    return /^https?:\/\/\S+$/i.test(w) ? w : null;
  }
  // gespeicherte Info eines Stopps (Tour, Sicherung): nur bekannte Felder, geprüft
  function infoPruefen(i) {
    if (!i || typeof i !== 'object') return null;
    const o = {}, s = (v, n) => typeof v === 'string' && v.length && v.length <= n;
    if (s(i.oh, 300)) o.oh = i.oh;
    if (s(i.wp, 200)) o.wp = i.wp;
    if (typeof i.wd === 'string' && /^Q\d{1,12}$/.test(i.wd)) o.wd = i.wd;
    if (typeof i.ohd === 'string' && OH_DATUM.test(i.ohd)) o.ohd = i.ohd;
    if (s(i.web, 300) && webAdresse(i.web)) o.web = webAdresse(i.web);
    if (s(i.adr, 200)) o.adr = i.adr;
    if (s(i.tel, 40) && telAdresse(i.tel)) o.tel = telAdresse(i.tel);
    return Object.keys(o).length ? o : null;
  }
  // Telefonnummer aus OSM (phone, contact:phone): die erste von mehreren, nur erlaubte Zeichen, mindestens 6 Ziffern
  function telAdresse(t) {
    const n = String(t || '').split(/[;,]/)[0].trim();
    return /^\+?[\d ()\/-]{6,30}$/.test(n) && (n.match(/\d/g) || []).length >= 6 ? n : null;
  }
  // „Stand 05/2023“ aus dem Prüfdatum in OSM; alt = älter als zwei Jahre (dann eher veraltet, vgl. Abgleich)
  function ohStand(ohd, jetzt) {
    if (typeof ohd !== 'string' || !OH_DATUM.test(ohd)) return null;
    const jahr = +ohd.slice(0, 4), monat = ohd.length >= 7 ? +ohd.slice(5, 7) : null;
    // nur das Jahr: zur Sicherheit vom Jahresanfang an gerechnet (ein altes Jahr soll die Warnung bekommen)
    const monate = (jetzt.getFullYear() - jahr) * 12 + (jetzt.getMonth() + 1 - (monat || 1));
    return { text: 'Stand ' + (monat ? String(monat).padStart(2, '0') + '/' : '') + jahr, alt: monate > 24 };
  }
  // Google Maps zu einem Ort: mit Adresse die Suche nach Name und Adresse, sonst nach dem Namen an dieser Stelle
  // (so findet Google den Ort, eine reine Koordinate zeigte nur einen Punkt)
  function googleOrtLink(name, adr, lat, lon) {
    if (name && adr) return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name + ', ' + adr);
    if (name) return 'https://www.google.com/maps/search/' + encodeURIComponent(name) + '/@' + lat.toFixed(5) + ',' + lon.toFixed(5) + ',17z';
    return 'https://www.google.com/maps/search/?api=1&query=' + lat.toFixed(6) + ',' + lon.toFixed(6);
  }

  // Mehrtagestour: an Wegpunkten mit Übernachtung (w.nacht, nicht Start und Ziel) in Etappen teilen. Je Etappe Strecke,
  // Höhenmeter, Gehzeit (dieselbe Formel wie die ganze Tour, auf das Stück angewandt) und höchster Punkt; null ohne Übernachtung.
  // stueckEnde[i-1] = Meter ab Start, an dem Wegpunkt i liegt
  function etappen(pts, stueckEnde, wps, tempo, art) {
    const n = wps.length;
    if (!stueckEnde || stueckEnde.length !== n - 1) return null;
    const grenzen = [];
    for (let i = 1; i < n - 1; i++) if (wps[i].nacht) grenzen.push(i);
    if (!grenzen.length) return null;
    const aus = [];
    let vonI = 0, vonD = 0;
    for (const bisI of grenzen.concat([n - 1])) {
      const bisD = stueckEnde[bisI - 1];
      const teil = etappenStueck(pts, vonD, bisD);
      const hm = hoehenmeterSpur(teil);
      let hoch = null;
      for (const p of teil) if (p.ele != null && (hoch == null || p.ele > hoch)) hoch = p.ele;
      const meter = Math.max(0, bisD - vonD);
      aus.push({ von: vonI, bis: bisI, vonD, bisD, meter, auf: hm.auf, ab: hm.ab, hoch: hoch == null ? null : Math.round(hoch),
        zeit: zeitFuer(art, meter, hm.auf, hm.ab, tempo), ziel: teil.length ? teil[teil.length - 1] : null });
      vonI = bisI; vonD = bisD;
    }
    return aus;
  }

  // Tour in „tage“ etwa gleich lange Tage teilen (nach Gehzeit, nicht nach Strecke): je Grenze ein vorhandener
  // Zwischenpunkt, wenn er höchstens 15 % eines Tages daneben liegt, sonst ein neuer Punkt auf der Route.
  // → { nacht: [Index vorhandener Punkte], neu: [{ lat, lon, vor }] } (vor = Index, vor dem der neue Punkt steht)
  function tagesAufteilung(pts, stueckEnde, wps, tage, tempo, art) {
    const n = wps.length, laenge = pts.length ? pts[pts.length - 1].d : 0;
    const aus = { nacht: [], neu: [] };
    if (tage < 2 || n < 2 || !stueckEnde || stueckEnde.length !== n - 1 || laenge <= 0) return aus;
    const zeit = d => zeitZwischen(pts, 0, d, tempo, art);
    const ganz = zeit(laenge), tag = ganz / tage;
    const belegt = new Set();
    for (let k = 1; k < tage; k++) {
      const ziel = tag * k;
      // Meter, an dem die Gehzeit das Ziel erreicht (Gehzeit wächst mit der Strecke)
      let lo = 0, hi = laenge;
      for (let s = 0; s < 40; s++) { const m = (lo + hi) / 2; if (zeit(m) < ziel) lo = m; else hi = m; }
      const d = (lo + hi) / 2;
      let best = -1, bestAbw = Infinity;
      for (let i = 1; i < n - 1; i++) {
        if (belegt.has(i)) continue;
        const abw = Math.abs(zeit(stueckEnde[i - 1]) - ziel);
        if (abw < bestAbw) { bestAbw = abw; best = i; }
      }
      if (best > 0 && bestAbw <= 0.15 * tag) { belegt.add(best); aus.nacht.push(best); continue; }
      let p = pts[0];
      for (const q of pts) if (Math.abs(q.d - d) < Math.abs(p.d - d)) p = q;
      let vor = 1;
      while (vor < n - 1 && stueckEnde[vor - 1] <= d) vor++;
      aus.neu.push({ lat: p.lat, lon: p.lon, vor, d });
    }
    return aus;
  }

  // Vorschlag für die Zahl der Tage: höchstens etwa 6,5 h Gehzeit am Tag (mindestens 2, höchstens 30)
  const TAG_STUNDEN = 6.5;
  function tageVorschlag(stunden) { return Math.max(2, Math.min(30, Math.ceil((+stunden || 0) / TAG_STUNDEN - 1e-9))); }
  // Zahlen für die Auswahl: bis 5 Tage 2 bis 5, sonst der Vorschlag mit zwei Tagen darunter und darüber
  function tageWahl(vorschlag) {
    const v = Math.max(2, vorschlag | 0), von = v <= 5 ? 2 : v - 2;
    const out = []; for (let z = von; z <= Math.max(5, v + 2) && out.length < 5; z++) out.push(z);
    return out;
  }
  // Unterkünfte im Umkreis der Übernachtungen: Hütten, Gasthöfe, Pensionen, Jugendherbergen, Hotels, Zeltplätze
  const UNTERKUNFT = { alpine_hut: ['Berghütte', 0], guest_house: ['Gasthof/Pension', 300], hostel: ['Herberge', 300], chalet: ['Ferienhütte', 600],
    hotel: ['Hotel', 500], wilderness_hut: ['Selbstversorgerhütte', 800], camp_site: ['Zeltplatz', 1500] };
  function unterkunftAbfrage(punkte, radius) {
    const teile = punkte.map(p => 'nwr["tourism"~"^(' + Object.keys(UNTERKUNFT).join('|') + ')$"]["name"](around:' + Math.round(radius) + ',' + p.lat.toFixed(5) + ',' + p.lon.toFixed(5) + ');');
    return '[out:json][timeout:25];(' + teile.join('') + ');out center tags 200;';
  }
  // beste Unterkunft für einen Punkt: Abstand plus Zuschlag je Art (eine Berghütte vor einem Hotel); belegt: schon vergeben
  function unterkunftWahl(json, p, radius, belegt) {
    let best = null;
    for (const el of (json && json.elements) || []) {
      const t = el.tags || {}, art = UNTERKUNFT[t.tourism];
      const lat = el.lat != null ? el.lat : el.center && el.center.lat, lon = el.lon != null ? el.lon : el.center && el.center.lon;
      if (!art || !t.name || lat == null || lon == null) continue;
      const id = el.type + '/' + el.id;
      if (belegt && belegt.has(id)) continue;
      const weg = abstand(p, { lat, lon });
      if (weg > radius) continue;
      const wert = weg + art[1];
      if (!best || wert < best.wert) {
        const web = t.website || t['contact:website'];
        const info = infoPruefen({ oh: t.opening_hours, web: web && !/^https?:\/\//i.test(web) ? 'https://' + web : web, tel: t.phone || t['contact:phone'] });
        best = { id, lat, lon, name: String(t.name).slice(0, 120), art: art[0], weg, wert, info };
      }
    }
    return best;
  }

  // ---------- Bescheid geben (DAV: Ziel, Route und Rückkehrzeit einer vertrauten Person sagen) ----------
  // o: { name, meter, stunden, auf, tage, ankunft (Date), start: {lat, lon}, link }
  function bescheidText(o) {
    const z = ['Ich bin unterwegs: ' + (o.name || 'Tour') + ' (' + kmText(o.meter) + (o.auf ? ', ↑ ' + Math.round(o.auf) + ' m' : '') +
      ', etwa ' + zeitText(o.stunden) + (o.tage > 1 ? ', ' + o.tage + ' Tage' : '') + ').'];
    if (o.start) z.push('Start: https://www.google.com/maps/search/?api=1&query=' + o.start.lat.toFixed(5) + ',' + o.start.lon.toFixed(5));
    if (o.ankunft) {
      const tag = o.ankunft.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
      z.push('Zurück geplant gegen ' + uhr(o.ankunft) + ' Uhr (' + tag + '). Melde ich mich bis ' + uhr(new Date(o.ankunft.getTime() + 2 * 3600e3)) +
        ' Uhr nicht und bin nicht erreichbar: Notruf 112 und diese Nachricht durchgeben.');
    }
    if (o.link) z.push('Route: ' + o.link);
    return z.join('\n');
  }
  function ankunftText(name, zeit) { return 'Bin gut angekommen' + (name ? ' (' + name + ')' : '') + ', ' + uhr(zeit) + ' Uhr.'; }

  // ---------- Alpines Notsignal: 6 Zeichen in einer Minute (alle 10 s), dann 1 Minute Pause, wiederholen ----------
  // Antwort der Rettung: 3 Zeichen in einer Minute. → ist bei t ms seit Beginn gerade ein Zeichen an (1,5 s lang)?
  function notsignalAn(t) {
    const im = ((t % 120000) + 120000) % 120000;
    if (im >= 60000) return false;
    return im % 10000 < 1500;
  }

  // ---------- Passt die Tour zu mir? Faustregeln zu Trittsicherheit, Kondition und Höhe ----------
  // o: { sac: {stufe, text, meter} | null, auf, ab, stunden (längster Tag), meter, hoch, tempo, tage, art }
  // → [{ art: 'ok' | 'hinweis' | 'warn', text }] (warn: bewusst prüfen, ob es passt)
  function tourCheck(o) {
    const out = [], h = +o.stunden || 0, tage = Math.max(1, o.tage || 1), auf = (+o.auf || 0) / tage, ab = (+o.ab || 0) / tage;
    if (o.art === 'rad' || o.art === 'lauf') return out;
    const s = o.sac;
    if (!s) out.push({ art: 'hinweis', text: 'Schwierigkeit der Wege in OpenStreetMap nicht erfasst: Wege vorab ansehen.' });
    else if (s.stufe <= 1) out.push({ art: 'ok', text: 'Wanderweg (T1): keine besonderen Anforderungen an die Trittsicherheit.' });
    else if (s.stufe === 2) out.push({ art: 'hinweis', text: 'Bergweg (T2) auf ' + kmText(s.meter) + ': Trittsicherheit nötig, feste Schuhe.' });
    else if (s.stufe === 3) out.push({ art: 'warn', text: 'Anspruchsvoller Bergweg (T3) auf ' + kmText(s.meter) + ': trittsicher und schwindelfrei, ausgesetzte Stellen möglich.' });
    else out.push({ art: 'warn', text: 'Alpin (T' + s.stufe + ') auf ' + kmText(s.meter) + ': Hände nötig, Erfahrung im weglosen Gelände; nicht für Einsteiger.' });
    const k = auf < 500 ? ['ok', 'leicht'] : auf < 1000 ? ['hinweis', 'mittel'] : auf < 1500 ? ['warn', 'anstrengend'] : ['warn', 'sehr anstrengend'];
    out.push({ art: k[0], text: 'Kondition ' + k[1] + ': ↑ ' + Math.round(auf) + ' m' + (tage > 1 ? ' am Tag' : '') + ', ' + zeitText(h) + ' Gehzeit' + (tage > 1 ? ' am längsten Tag' : '') +
      (h > 8 ? ': sehr langer Tag, früh starten.' : h > 6 ? ': langer Tag.' : '.') });
    if (ab >= 1000) out.push({ art: 'hinweis', text: 'Langer Abstieg (↓ ' + Math.round(ab) + ' m' + (tage > 1 ? ' am Tag' : '') + '): belastet die Knie, Stöcke helfen.' });
    if (o.hoch != null && o.hoch >= 2500) out.push({ art: 'hinweis', text: 'Über 2500 m (' + o.hoch + ' m): Schnee bis in den Sommer möglich, Wetter schlägt schneller um.' });
    if (o.tempo != null && o.tempo <= 0.7 && ((s && s.stufe >= 3) || auf >= 800 || h > 5)) out.push({ art: 'warn', text: 'Mit Kind: ' + (s && s.stufe >= 3 ? 'T3-Wege' : auf >= 800 ? 'viel Aufstieg' : 'langer Tag') + ' – lieber eine kürzere oder leichtere Tour.' });
    return out;
  }

  // Ausschnitt einer Etappe aus der Auswertung der ganzen Tour, als eigene Route ab Meter 0 (zum Folgen eines Tages):
  // Punkte, Teilstück-Enden der Wegpunkte von s.von bis s.bis und Abbiegehinweise dieses Stücks
  function etappeAusschnitt(e, s) {
    const a = s.vonD, b = s.bisD;
    const pts = e.pts.filter(p => p.d >= a - 0.01 && p.d <= b + 0.01).map((p, i) => {
      const q = Object.assign({}, p, { d: Math.max(0, p.d - a) });
      if (i === 0) delete q.luecke;
      return q;
    });
    return { pts, laenge: Math.max(0, b - a), zeit: s.zeit, auf: s.auf, ab: s.ab, hoch: s.hoch,
      stueckEnde: (e.stueckEnde || []).slice(s.von, s.bis).map(d => d - a),
      hinweise: (e.hinweise || []).filter(h => h.d >= a && h.d <= b).map(h => Object.assign({}, h, { d: h.d - a })) };
  }

  // Text der Führung am Stopp: Name, dann die Kurzinfo, höchstens etwa 1200 Zeichen und am Satzende gekürzt
  // (eine Minute Vorlesen; die Sprachausgabe von Android nimmt ohnehin nur rund 4000 Zeichen auf einmal)
  function fuehrungText(name, text) {
    let t = String(text || '').replace(/\s+/g, ' ').trim();
    if (t.length > 1200) {
      const schnitt = t.slice(0, 1200), ende = Math.max(schnitt.lastIndexOf('. '), schnitt.lastIndexOf('! '), schnitt.lastIndexOf('? '));
      t = ende > 200 ? schnitt.slice(0, ende + 1) : schnitt.replace(/\s+\S*$/, '') + ' …';
    }
    return (name ? name + ' erreicht. ' : '') + t;
  }

  // jeden Punkt etwa alle `m` Meter behalten (für Abfragen mit vielen Koordinaten)
  function ausduennen(pts, m) {
    if (!pts.length) return [];
    const out = [pts[0]];
    let last = pts[0];
    for (const p of pts) if (abstand(last, p) >= m) { out.push(p); last = p; }
    if (out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1]);
    return out;
  }

  // ---------- GPX ----------
  function esc(s) { return String(s).replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c])); }

  function gpxSchreiben(name, pts, wegpunkte) {
    const z = [];
    z.push('<?xml version="1.0" encoding="UTF-8"?>');
    z.push('<gpx version="1.1" creator="Gipfel und Gasse" xmlns="http://www.topografix.com/GPX/1/1">');
    z.push('<metadata><name>' + esc(name) + '</name><copyright author="OpenStreetMap-Mitwirkende"><license>https://opendatacommons.org/licenses/odbl/</license></copyright></metadata>');
    (wegpunkte || []).forEach((w, i) => z.push('<wpt lat="' + w.lat.toFixed(6) + '" lon="' + w.lon.toFixed(6) + '"><name>' + esc(w.name || ('Punkt ' + (i + 1))) + '</name></wpt>'));
    z.push('<trk><name>' + esc(name) + '</name><trkseg>');
    for (const p of pts) {
      if (p.luecke) z.push('</trkseg><trkseg>');
      let s = '<trkpt lat="' + p.lat.toFixed(6) + '" lon="' + p.lon.toFixed(6) + '">';
      if (p.ele != null) s += '<ele>' + p.ele.toFixed(1) + '</ele>';
      if (p.t) s += '<time>' + new Date(p.t).toISOString() + '</time>';
      z.push(s + '</trkpt>');
    }
    z.push('</trkseg></trk>', '</gpx>');
    return z.join('\n');
  }

  function unesc(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }
  function attr(a, n) { const m = new RegExp('\\b' + n + '\\s*=\\s*["\']([^"\']*)["\']').exec(a); return m ? m[1] : null; }

  // liest Spur (trkpt), sonst Route (rtept); Wegpunkte (wpt) getrennt
  function gpxLesen(text) {
    const lese = (tag, quelle) => {
      const text_ = quelle || text;
      const out = [], re = new RegExp('<' + tag + '\\b([^>]*?)(?:/>|>([\\s\\S]*?)</' + tag + '>)', 'g');
      let m;
      while ((m = re.exec(text_))) {
        const lat = parseFloat(attr(m[1], 'lat')), lon = parseFloat(attr(m[1], 'lon'));
        if (isNaN(lat) || isNaN(lon)) continue;
        const inner = m[2] || '';
        const e = /<ele>\s*([-\d.]+)\s*<\/ele>/.exec(inner), n = /<name>([\s\S]*?)<\/name>/.exec(inner), t = /<time>([^<]+)<\/time>/.exec(inner);
        const sym = /<sym>([\s\S]*?)<\/sym>/.exec(inner);
        const p = { lat, lon, ele: e ? parseFloat(e[1]) : null, name: n ? unesc(n[1].trim()) : null, t: t ? Date.parse(t[1]) : null };
        if (sym) p.sym = unesc(sym[1].trim());
        out.push(p);
      }
      return out;
    };
    // Abschnitte (trkseg) bleiben getrennt: der erste Punkt jedes weiteren Abschnitts trägt luecke = true
    let pts = [];
    const segs = /<trkseg\b/.test(text) ? text.split(/<trkseg\b/).slice(1) : [text];
    for (const seg of segs) {
      const p = lese.call(null, 'trkpt', seg);
      if (pts.length && p.length) p[0].luecke = true;
      pts = pts.concat(p);
    }
    if (!pts.length) pts = lese('rtept');
    const wpt = lese('wpt');
    // Name der Tour: nur der eigene <name> von metadata/trk/rte, nicht der des Autors (Garmin) oder eines Punkts
    const ohnePunkte = text.replace(/<author\b[\s\S]*?<\/author>|<(wpt|trkpt|rtept)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/g, '');
    const kopf = /<(?:metadata|trk|rte)\b[^>]*>[\s\S]*?<name>([\s\S]*?)<\/name>/.exec(ohnePunkte);
    if (!pts.length && !wpt.length) throw new Error('In der Datei steht keine Spur und keine Route.');
    // Art der Tour (<type> in trk oder rte, nicht der des Autor-Links) und Herkunft (creator, bei Adressen nur der Host)
    const typ = /<(?:trk|rte)\b[^>]*>(?:(?!<\/(?:trk|rte)>)[\s\S])*?<type>([\s\S]*?)<\/type>/.exec(ohnePunkte);
    const creator = attr((/<gpx\b([^>]*)>/.exec(text) || [])[1] || '', 'creator');
    return { name: kopf ? unesc(kopf[1].trim()) : null, pts, wpt, typ: typ ? unesc(typ[1].trim()).toLowerCase() : null, quelle: gpxQuelle(creator) };
  }
  // Herkunft der Datei: „https://www.komoot.de“ → „komoot.de“, sonst der Name des Programms (gekürzt)
  function gpxQuelle(creator) {
    if (!creator) return null;
    const c = unesc(creator).trim();
    const m = /^https?:\/\/(?:www\.)?([^\/\s]+)/i.exec(c);
    return (m ? m[1] : c).slice(0, 60) || null;
  }
  // Art der Tour aus <type>: Wandern, Laufen oder Rad (Strava, komoot, Garmin schreiben englische Wörter oder Zahlen)
  function gpxProfil(typ) {
    if (!typ) return null;
    if (/run|jog|lauf/.test(typ)) return 'laufen';
    if (/bik|cycl|ride|rad|mtb|gravel/.test(typ)) return 'rad';
    if (/hik|walk|trek|wander|mountain|berg|alpin/.test(typ)) return 'wandern';
    return null;
  }
  // Wegpunkt einer Datei: Gipfel, Einkehr (Hütte, Gasthaus, Alm) oder sonstiger Punkt; aus Symbol und Name
  function gpxPunktArt(sym, name) {
    // das Symbol zählt zuerst; der Name nur, wenn er keinen Ausblick beschreibt („Blick … von der Heimgarten-Alm“)
    const sy = sym || '', n = /blick|aussicht|panorama/i.test(name || '') ? '' : (name || '');
    if (/summit|peak/i.test(sy) || /gipfel/i.test(name || '')) return 'gipfel';
    if (/restaurant|facility|lodging|bar\b/i.test(sy) || /h[üu]tte|gasthaus|gasthof|\balm\b|wirtschaft|caf[eé]|biergarten/i.test(n)) return 'einkehr';
    if (/parking/i.test(sy) || /parkplatz/i.test(n)) return 'parken';
    return 'punkt';
  }
  // Dauer laut Zeitstempeln der Spur in Stunden; nur, wenn die Zeit vorwärts läuft und plausibel ist (unter 14 Tagen)
  function gpxDauer(pts) {
    const t = pts.filter(p => p.t).map(p => p.t);
    if (t.length < 2) return null;
    const h = (t[t.length - 1] - t[0]) / 3.6e6;
    return h > 0 && h < 336 ? h : null;
  }

  // ---------- Teilen-Link ----------
  // #tour-<profil>-<lat_lon>_<lat_lon>… (nur Buchstaben, Ziffern, Bindestrich, Punkt, Unterstrich)
  function linkSchreiben(profil, wps) {
    return 'tour-' + profil + '-' + wps.map(w => w.lat.toFixed(5) + '_' + w.lon.toFixed(5)).join('~');
  }
  function linkLesen(hash) {
    const m = /^#?tour-([a-z-]+?)-(-?[\d.]+_-?[\d.]+(?:~-?[\d.]+_-?[\d.]+)*)$/.exec(hash || '');
    if (!m) return null;
    const wps = m[2].split('~').map(s => { const [a, b] = s.split('_'); return { lat: +a, lon: +b }; });
    if (wps.some(w => isNaN(w.lat) || isNaN(w.lon) || Math.abs(w.lat) > 90 || Math.abs(w.lon) > 180)) return null;
    return { profil: m[1], wps };
  }

  // ---------- Familie: Grenzen für Länge und Aufstieg (Tourliste und Familien-Check) ----------
  const FAMILIE = {
    '5-200': { meter: 5000, hm: 200, text: 'bis 5 km und 200 Hm' },
    '8-400': { meter: 8000, hm: 400, text: 'bis 8 km und 400 Hm' },
    '12-700': { meter: 12000, hm: 700, text: 'bis 12 km und 700 Hm' }
  };
  // Spielplatz oder Einkehr auf halber Strecke: zwischen 30 und 70 % der Länge, höchstens 250 m neben der Route
  function familieHalbzeit(orte, laenge) {
    return orte.filter(o => (o.kat === 'spiel' || o.kat === 'huette') && o.d != null && o.d >= laenge * 0.3 && o.d <= laenge * 0.7 && o.abw <= 250);
  }

  // ---------- Orte entlang der Strecke (Overpass) ----------
  const ORTE = [
    { k: 'huette', name: 'Hütten und Einkehr', zeichen: '🏠', test: t => /^(alpine_hut|wilderness_hut)$/.test(t.tourism) || /^(restaurant|cafe|biergarten)$/.test(t.amenity) },
    { k: 'gipfel', name: 'Gipfel und Aussicht', zeichen: '⛰️', test: t => t.natural === 'peak' || t.tourism === 'viewpoint' },
    { k: 'wasser', name: 'Trinkwasser', zeichen: '🚰', test: t => t.amenity === 'drinking_water' || (t.amenity === 'fountain' && t.drinking_water === 'yes') },
    { k: 'spiel', name: 'Spielplätze', zeichen: '🛝', test: t => t.leisure === 'playground' },
    { k: 'baden', name: 'Baden', zeichen: '🏊', test: t => t.leisure === 'bathing_place' || (t.leisure === 'swimming_area') },
    { k: 'rast', name: 'Rastplätze und Unterstände', zeichen: '🪑', test: t => t.tourism === 'picnic_site' || t.amenity === 'shelter' || t.leisure === 'picnic_table' },
    { k: 'natur', name: 'Wasserfälle und Höhlen', zeichen: '💧', test: t => t.natural === 'waterfall' || t.waterway === 'waterfall' || t.natural === 'cave_entrance' },
    { k: 'oepnv', name: 'Bus und Bahn', zeichen: '🚌', test: t => t.highway === 'bus_stop' || /^(station|halt)$/.test(t.railway) || t.aerialway === 'station' },
    { k: 'wc', name: 'Toiletten', zeichen: '🚻', test: t => t.amenity === 'toilets' },
    { k: 'parken', name: 'Parkplätze', zeichen: '🅿️', test: t => t.amenity === 'parking' && t.access !== 'private' }
  ];

  // Bezeichnung für Orte ohne Namen
  function ortArt(t) {
    const a = { alpine_hut: 'Berghütte', wilderness_hut: 'Selbstversorgerhütte', viewpoint: 'Aussichtspunkt', picnic_site: 'Rastplatz' }[t.tourism] ||
      { restaurant: 'Gasthaus', cafe: 'Café', biergarten: 'Biergarten', drinking_water: 'Trinkwasser', fountain: 'Trinkbrunnen', shelter: 'Unterstand', toilets: 'Toilette', parking: 'Parkplatz' }[t.amenity] ||
      { playground: 'Spielplatz', bathing_place: 'Badestelle', swimming_area: 'Badestelle', picnic_table: 'Picknicktisch' }[t.leisure] ||
      { peak: 'Gipfel', waterfall: 'Wasserfall', cave_entrance: 'Höhle' }[t.natural] ||
      (t.waterway === 'waterfall' ? 'Wasserfall' : '') || (t.highway === 'bus_stop' ? 'Bushaltestelle' : '') ||
      (t.railway ? 'Bahnhof' : '') || (t.aerialway ? 'Bergbahn' : '');
    return a || 'Ort';
  }

  function overpassAbfrage(pts, radius) {
    const ll = ausduennen(pts, 250).map(p => p.lat.toFixed(5) + ',' + p.lon.toFixed(5)).join(',');
    const a = '(around:' + radius + ',' + ll + ')';
    const teile = [
      'nwr["tourism"~"^(alpine_hut|wilderness_hut|viewpoint|picnic_site)$"]',
      'nwr["amenity"~"^(restaurant|cafe|biergarten|drinking_water|toilets|shelter|parking)$"]',
      'node["amenity"="fountain"]["drinking_water"="yes"]',
      'node["natural"~"^(peak|waterfall|cave_entrance)$"]',
      'nwr["leisure"~"^(playground|bathing_place|swimming_area|picnic_table)$"]',
      'node["waterway"="waterfall"]',
      'node["highway"="bus_stop"]',
      'node["railway"~"^(station|halt)$"]',
      'node["aerialway"="station"]'
    ];
    // Obergrenze großzügig: in Orten füllen Haltestellen und Parkplätze sonst die Liste, bevor Hütten drankommen
    return '[out:json][timeout:25];(' + teile.map(t => t + a + ';').join('') + ');out center tags 1500;';
  }

  function orteLesen(json, pts) {
    const out = [];
    for (const el of (json && json.elements) || []) {
      const lat = el.lat != null ? el.lat : el.center && el.center.lat, lon = el.lon != null ? el.lon : el.center && el.center.lon;
      if (lat == null) continue;
      const t = el.tags || {};
      const kat = ORTE.find(o => o.test(t));
      if (!kat) continue;
      const lage = pts && pts.length > 1 ? aufStrecke(pts, { lat, lon }) : null;
      let name = t.name || t['name:de'] || '';
      if (t.natural === 'peak' && t.ele) name = (name || 'Gipfel') + ' (' + Math.round(parseFloat(t.ele)) + ' m)';
      out.push({ id: el.type + '/' + el.id, lat, lon, kat: kat.k, name: name || ortArt(t), tags: t, d: lage ? lage.d : null, abw: lage ? lage.abw : null });
    }
    out.sort((a, b) => (a.d || 0) - (b.d || 0));
    return out;
  }

  // ---------- Sonne und Zeitplan ----------
  // Sonnenuntergang (Oberkante am Horizont, mit Lichtbrechung) für den Tag von `tag` an einem Ort; gerechnet wie die
  // gängigen Sonnenformeln (Abweichung wenige Minuten), damit es auch ohne Netz geht. null bei Polartag/-nacht.
  function sonnenuntergang(tag, lat, lon) {
    const T = 86400000, J1970 = 2440588, J2000 = 2451545, e = RAD * 23.4397;
    const mittag = new Date(tag.getFullYear(), tag.getMonth(), tag.getDate(), 12);
    const d = mittag.valueOf() / T - 0.5 + J1970 - J2000;
    const lw = RAD * -lon, phi = RAD * lat;
    const n = Math.round(d - 0.0009 - lw / (2 * Math.PI));
    const ds = 0.0009 + lw / (2 * Math.PI) + n;
    const M = RAD * (357.5291 + 0.98560028 * ds);
    const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    const L = M + C + RAD * 102.9372 + Math.PI;
    const dek = Math.asin(Math.sin(e) * Math.sin(L));
    const cosw = (Math.sin(-0.833 * RAD) - Math.sin(phi) * Math.sin(dek)) / (Math.cos(phi) * Math.cos(dek));
    if (Math.abs(cosw) > 1) return null;
    const a = 0.0009 + (Math.acos(cosw) + lw) / (2 * Math.PI) + n;
    const jset = J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    return new Date((jset + 0.5 - J1970) * T);
  }

  function uhr(d) { return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }

  // Zeitplan: Start (Date oder null), Dauer in Stunden (Gehzeit plus Besichtigung), Pausen in Minuten, Sonnenuntergang.
  // Mit Start: Ankunft und ob es vor dem Dunkelwerden reicht (30 min Reserve). Ohne Start: spätester Start.
  function zeitplan(start, stunden, pauseMin, untergang, reserveMin) {
    const reserve = (reserveMin == null ? 30 : reserveMin) * 60000, dauer = stunden * 3600000 + (pauseMin || 0) * 60000;
    const out = { spaetestens: untergang ? new Date(untergang - reserve - dauer) : null };
    if (start) {
      out.ankunft = new Date(start.valueOf() + dauer);
      if (untergang) { out.puffer = (untergang - out.ankunft) / 60000; out.knapp = out.puffer < (reserveMin == null ? 30 : reserveMin); }
    }
    return out;
  }

  // ---------- Notfall ----------
  function gradMinSek(x, pos, neg) {
    // erst auf Zehntelsekunden runden, dann zerlegen: sonst entsteht „59′ 60,0″“ statt des Übertrags
    const z = Math.round(Math.abs(x) * 36000), g = Math.floor(z / 36000), m = Math.floor((z % 36000) / 600), s = (z % 600) / 10;
    return g + '° ' + m + '′ ' + s.toFixed(1).replace('.', ',') + '″ ' + (x >= 0 ? pos : neg);
  }
  // Text zum Vorlesen und Senden: Dezimalgrad (für Leitstellen und Karten-Apps), Grad/Minuten/Sekunden, Höhe, Genauigkeit
  // alt = true: kein aktueller Standort, nur der letzte bekannte (wird so benannt)
  function notfallText(p, alt) {
    const dez = p.lat.toFixed(5) + ', ' + p.lon.toFixed(5);
    return (alt ? 'Mein letzter bekannter Standort (nicht aktuell): ' : 'Mein Standort: ') + dez + ' (' + gradMinSek(p.lat, 'N', 'S') + ', ' + gradMinSek(p.lon, 'O', 'W') + ')' +
      (p.ele != null && isFinite(p.ele) ? ', Höhe etwa ' + Math.round(p.ele) + ' m' : '') +
      (p.gen != null ? ', Genauigkeit ± ' + Math.round(p.gen) + ' m' : '') +
      (p.t ? ', Stand ' + uhr(new Date(p.t)) + ' Uhr' : '') +
      '. Karte: https://www.openstreetmap.org/?mlat=' + p.lat.toFixed(5) + '&mlon=' + p.lon.toFixed(5) + '#map=16/' + p.lat.toFixed(5) + '/' + p.lon.toFixed(5);
  }

  // Text für „abseits der Route“: weit weg (z. B. noch nicht am Start) mit km und Weg zum Start
  function abseitsText(abw, zumStart) {
    if (abw < 1000) return 'Du bist ' + Math.round(abw) + ' m neben der Route';
    return 'Du bist ' + kmText(abw) + ' von der Route entfernt' + (zumStart != null ? ' · zum Start ' + kmText(zumStart) : '');
  }

  // Gewitter in den nächsten Stunden (stündliche Vorhersage, Zeiten in Unix-Sekunden): erste Stunde mit WMO-Code ≥ 95
  // zwischen einer Stunde vorher und fenster ms danach, sonst null (wie NaviRechnen.gewitterAb)
  function gewitterAb(zeiten, codes, jetzt, fenster) {
    for (let i = 0; i < (zeiten || []).length; i++) {
      const t = zeiten[i] * 1000;
      if (t >= jetzt - 3600e3 && t <= jetzt + fenster && +codes[i] >= 95) return t;
    }
    return null;
  }

  // Statistik der gegangenen Touren: diese und letzte Woche (ab Montag), dieser und letzter Monat, die letzten 12 Monate
  function statistik(touren, jetzt) {
    const leer = () => ({ km: 0, touren: 0, auf: 0 });
    const tag0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const heute = tag0(new Date(jetzt));
    const woche = new Date(heute); woche.setDate(heute.getDate() - (heute.getDay() + 6) % 7);
    const vorwoche = new Date(woche); vorwoche.setDate(woche.getDate() - 7);
    const monat = new Date(heute.getFullYear(), heute.getMonth(), 1), vormonat = new Date(heute.getFullYear(), heute.getMonth() - 1, 1);
    const out = { woche: leer(), vorwoche: leer(), monat: leer(), vormonat: leer(), monate: [] };
    for (let i = 11; i >= 0; i--) {
      const m = new Date(heute.getFullYear(), heute.getMonth() - i, 1);
      out.monate.push({ jahr: m.getFullYear(), monat: m.getMonth(), name: m.toLocaleDateString('de-DE', { month: 'short' }).replace('.', ''), km: 0, touren: 0 });
    }
    const dazu = (z, t) => { z.km += (+t.kurz.laenge || 0) / 1000; z.touren++; z.auf += +t.kurz.auf || 0; };
    for (const t of touren) {
      if (t.art !== 'aufzeichnung') continue;
      const d = new Date(tourZeit(t));
      if (d >= woche) dazu(out.woche, t); else if (d >= vorwoche) dazu(out.vorwoche, t);
      if (d >= monat) dazu(out.monat, t); else if (d >= vormonat) dazu(out.vormonat, t);
      const m = out.monate.find(x => x.jahr === d.getFullYear() && x.monat === d.getMonth());
      if (m) { m.km += (+t.kurz.laenge || 0) / 1000; m.touren++; }
    }
    return out;
  }

  // Tage mit Gewitter (WMO 95–99) als kurze Namen: „heute“, „morgen“, sonst Wochentag
  function gewitterTage(codes, tage) {
    const kurz = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const out = [];
    (codes || []).forEach((c, i) => { if (+c >= 95) out.push(i === 0 ? 'heute' : i === 1 ? 'morgen' : 'am ' + kurz[new Date(tage[i] + 'T12:00').getDay()]); });
    return out;
  }

  // Sicherung aller Touren: {app, version, touren}. Eine Sicherung kann von irgendwoher kommen: jede Tour wird
  // Feld für Feld neu aufgebaut (nur endliche Zahlen, Texte mit Längengrenze, bekannte Werte); was nicht passt,
  // fällt weg. Liefert die gültigen Touren oder wirft mit Grund.
  function sicherungLesen(text) {
    let d = text;
    if (typeof text === 'string') { try { d = JSON.parse(text); } catch (e) { throw new Error('keine Sicherung von Gipfel & Gasse (kein JSON)'); } }
    if (!d || d.app !== 'gipfel-und-gasse' || !Array.isArray(d.touren)) throw new Error('keine Sicherung von Gipfel & Gasse');
    return d.touren.map(tourPruefen).filter(Boolean);
  }

  // Tagebuch derselben Sicherung (fehlt es, ist es leer)
  function sicherungTagebuch(text) {
    const d = typeof text === 'string' ? JSON.parse(text) : text;
    return tagebuchPruefen(d && d.tagebuch, d && d.fotos);
  }

  function tourPruefen(t) {
    const zahl = x => (typeof x === 'number' && isFinite(x) ? x : null);
    const text = (x, n) => (typeof x === 'string' ? x.slice(0, n) : null);
    const ort = (lat, lon) => zahl(lat) != null && zahl(lon) != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    if (!t || typeof t !== 'object') return null;
    const id = text(t.id, 64), name = text(t.name, 200);
    if (!id || !name || !Array.isArray(t.spur) || !t.spur.length || !t.kurz || typeof t.kurz !== 'object') return null;
    const spur = [];
    for (const p of t.spur) {
      if (!Array.isArray(p) || !ort(p[0], p[1])) return null;
      const x = [p[0], p[1], zahl(p[2])];
      if (zahl(p[3]) != null || p[4] === 1) x.push(zahl(p[3]) || 0);
      if (p[4] === 1) x.push(1);
      spur.push(x);
    }
    let wps = null;
    if (Array.isArray(t.wps)) {
      wps = [];
      for (const w of t.wps) {
        if (!Array.isArray(w) || !ort(w[0], w[1])) return null;
        if (w.length <= 2) { wps.push([w[0], w[1]]); continue; }
        const p = [w[0], w[1], text(w[2], 120) || '', Math.max(0, zahl(w[3]) || 0)];
        // fünfter Wert: Öffnungszeiten und Wikipedia des Stopps aus OSM (nur bekannte Felder, geprüft)
        const info = w[4] && typeof w[4] === 'object' && !Array.isArray(w[4]) ? infoPruefen(w[4]) : null;
        if (info || w[5] === 1) p.push(info || 0);
        if (w[5] === 1) p.push(1);   // sechster Wert: Übernachtung (Mehrtagestour)
        wps.push(p);
      }
    }
    // Teilstücke nur, wenn sie zu Wegpunkten und Spur passen; sonst öffnet die Tour als Spur
    let stuecke = null;
    if (wps && Array.isArray(t.stuecke) && t.stuecke.length === wps.length - 1) {
      let summe = 0;
      const ok = t.stuecke.every(s => s && Number.isInteger(s.n) && s.n >= 1 && (s.q === 'brouter' || s.q === 'linie') && Array.isArray(s.a) &&
        s.a.every(a => Array.isArray(a) && zahl(a[0]) != null && typeof a[1] === 'string') &&
        (s.h == null || (Array.isArray(s.h) && s.h.every(h => Array.isArray(h) && Number.isInteger(h[0]) && Number.isInteger(h[1]) && (h[2] == null || zahl(h[2]) != null)))) &&
        (summe += s.n) > 0);
      if (ok && summe - (t.stuecke.length - 1) === spur.length) {
        stuecke = t.stuecke.map(s => {
          const o = { n: s.n, q: s.q, a: s.a.map(a => [a[0], a[1].slice(0, 500)]) };
          if (s.h) o.h = s.h.map(h => [h[0], h[1], h[2] == null ? null : h[2]]);
          return o;
        });
      }
    }
    const k = t.kurz;
    const out = {
      id, name, datum: typeof t.datum === 'string' && !isNaN(Date.parse(t.datum)) ? t.datum.slice(0, 40) : zahl(t.datum) || new Date().toISOString(), spur, wps: stuecke ? wps : null, stuecke,
      art: ['plan', 'spur', 'aufzeichnung'].includes(t.art) ? t.art : 'spur',
      kurz: { laenge: zahl(k.laenge) || 0, auf: Math.round(zahl(k.auf) || 0), ab: Math.round(zahl(k.ab) || 0), zeit: zahl(k.zeit) || 0 }
    };
    if (out.art === 'plan' && !stuecke) out.art = 'spur';
    if (['wandern', 'mehrtag', 'stadt', 'laufen', 'rad', 'kurz', 'linie'].includes(t.profil)) out.profil = t.profil;
    if (t.modus === 'berg' || t.modus === 'stadt') out.modus = t.modus;
    if (zahl(t.tempo) != null && t.tempo > 0 && t.tempo < 3) out.tempo = t.tempo;
    if (zahl(t.pace) != null && t.pace >= 2 && t.pace <= 20) out.pace = t.pace;
    // aus einer GPX-Datei: Wegpunkte [lat, lon, Name, Art], Herkunft, Dauer laut Zeitstempeln
    if (Array.isArray(t.punkte)) {
      const pk = t.punkte.filter(p => Array.isArray(p) && ort(p[0], p[1])).slice(0, 200)
        .map(p => [p[0], p[1], text(p[2], 120) || '', ['gipfel', 'einkehr', 'parken', 'punkt'].includes(p[3]) ? p[3] : 'punkt']);
      if (pk.length) out.punkte = pk;
    }
    if (text(t.quelle, 60)) out.quelle = text(t.quelle, 60);
    if (zahl(t.dateiDauer) != null && t.dateiDauer > 0 && t.dateiDauer < 336) out.dateiDauer = t.dateiDauer;
    if (t.zeit && typeof t.zeit === 'object') {
      const z = { tag: /^\d{4}-\d{2}-\d{2}$/.test(t.zeit.tag) ? t.zeit.tag : '', start: /^\d{2}:\d{2}$/.test(t.zeit.start) ? t.zeit.start : '',
        pause: Number.isInteger(t.zeit.pause) && t.zeit.pause >= 0 && t.zeit.pause <= 600 ? t.zeit.pause : 0 };
      // Startzeit je Tag einer Mehrtagestour (Index = Tag − 1; leer: wie Tag 1)
      if (Array.isArray(t.zeit.tage) && t.zeit.tage.length <= 60) {
        const tage = t.zeit.tage.map(x => (typeof x === 'string' && /^\d{2}:\d{2}$/.test(x) ? x : ''));
        if (tage.some(Boolean)) z.tage = tage;
      }
      if (z.tag || z.start || z.pause || z.tage) out.zeit = z;
    }
    return out;
  }

  // ---------- Reisetagebuch ----------
  // Datum als JJJJ-MM-TT in Ortszeit (nicht UTC: ein Eintrag um 0:30 gehört zum neuen Tag)
  function tagIso(d) {
    d = new Date(d);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  // Einträge nach Tagen, neuester Tag zuerst, innerhalb des Tages der Reihe nach
  function tagebuchTage(eintraege) {
    const tage = {};
    for (const e of eintraege) (tage[tagIso(e.zeit)] = tage[tagIso(e.zeit)] || []).push(e);
    return Object.keys(tage).sort().reverse().map(tag => ({ tag, eintraege: tage[tag].sort((a, b) => a.zeit - b.zeit) }));
  }
  // Aufnahmezeit einer Tour: erster Zeitstempel der Spur, ohne Zeitstempel das Speicherdatum (wie in der Statistik)
  function tourZeit(t) { return t.spur && t.spur[0] && t.spur[0][3] ? +t.spur[0][3] : new Date(t.datum).getTime(); }
  // gegangene Touren (Aufzeichnungen), die in den Zeitraum der Reise fallen
  function reiseTouren(touren, reise) {
    return touren.filter(t => t.art === 'aufzeichnung' && tagIso(tourZeit(t)) >= reise.von && tagIso(tourZeit(t)) <= reise.bis)
      .sort((a, b) => tourZeit(a) - tourZeit(b));
  }
  // alle Fotos des Tagebuchs, neueste zuerst: je Foto Eintrag, Reise und die gegangene Tour desselben Tages (die zeitlich
  // nächste, wenn es mehrere gibt); touren aus tourenLesen
  function fotoListe(tagebuch, touren) {
    const reisen = new Map(((tagebuch && tagebuch.reisen) || []).map(r => [r.id, r]));
    const gegangen = (touren || []).filter(t => t.art === 'aufzeichnung');
    const out = [];
    const eintraege = ((tagebuch && tagebuch.eintraege) || []).filter(e => Array.isArray(e.fotos) && e.fotos.length).slice().sort((a, b) => b.zeit - a.zeit);
    for (const e of eintraege) {
      const tag = tagIso(e.zeit);
      const amTag = gegangen.filter(t => tagIso(tourZeit(t)) === tag).sort((a, b) => Math.abs(tourZeit(a) - e.zeit) - Math.abs(tourZeit(b) - e.zeit));
      for (const f of e.fotos) out.push({ foto: f, eintrag: e.id, zeit: e.zeit, reise: reisen.get(e.reise) || null, tour: amTag[0] || null });
    }
    return out;
  }
  // ---------- Packliste je Tourart, Länge, Höhe, Tage und Wetter ----------
  // o: { profil (wandern, stadt, laufen, rad, …), stunden (längster Tag, mit Pausen), auf, ab, hoch (m), tage, kind,
  // dunkel (Ankunft knapp vor Sonnenuntergang), wetter: { min, max (°C), regen (% höchstens), wind, gewitter } oder null }
  // → { gruppen: [{ name, dinge: [{ id, was, warum }] }], hinweise: [Text] }. Die ids bleiben gleich (Abhaken merkt sich).
  function packliste(o) {
    const g = new Map(), hinweise = [];
    const dazu = (gruppe, id, was, warum) => { if (!g.has(gruppe)) g.set(gruppe, []); if (!g.get(gruppe).some(x => x.id === id)) g.get(gruppe).push({ id, was, warum: warum || '' }); };
    const h = Math.max(0, +o.stunden || 0), w = o.wetter || null, tage = Math.max(1, +o.tage || 1);
    const hoch = o.hoch == null ? 0 : +o.hoch, auf = +o.auf || 0, ab = +o.ab || 0;
    const art = o.profil === 'stadt' ? 'stadt' : o.profil === 'laufen' ? 'lauf' : o.profil === 'rad' ? 'rad' : 'berg';
    const berg = art === 'berg', heiss = w && w.max != null && w.max >= 25, kalt = (w && w.min != null && w.min <= 5) || (berg && hoch >= 2000);
    // Wasser: etwa ½ l je Stunde, bei Hitze mehr; gerundet auf ½ l
    const liter = Math.max(art === 'stadt' ? 0.5 : 1, Math.round(h * (heiss ? 0.75 : 0.5) * 2) / 2);
    const lit = String(liter).replace('.', ',') + ' l';
    if (art === 'berg') {
      dazu('Grundausstattung', 'rucksack', 'Rucksack');
      dazu('Grundausstattung', 'schuhe', 'Wanderschuhe mit Profil', auf >= 300 || hoch >= 1000 ? 'Bergweg' : '');
      dazu('Grundausstattung', 'wasser', 'Wasser: ' + lit, heiss ? 'warm, mehr trinken' : 'etwa ½ l je Stunde');
      dazu('Grundausstattung', 'brotzeit', h >= 4 ? 'Brotzeit und Riegel' : 'Snack', '');
      dazu('Grundausstattung', 'regenjacke', 'Regenjacke', 'am Berg immer');
      dazu('Grundausstattung', 'erstehilfe', 'Erste-Hilfe-Set mit Pflaster und Blasenpflaster');
      dazu('Grundausstattung', 'handy', 'Handy geladen, Offline-Karte geladen');
      dazu('Grundausstattung', 'geld', 'Geld, Ausweis, Krankenkassenkarte');
      if (hoch >= 1500 || h >= 5) dazu('Grundausstattung', 'rettung', 'Rettungsdecke', 'alpin oder lang');
      if (auf >= 600 || h >= 5) dazu('Kleidung', 'shirt', 'Wechselshirt', 'Aufstieg ' + Math.round(auf) + ' m');
      if (ab >= 700) dazu('Grundausstattung', 'stoecke', 'Wanderstöcke', 'Abstieg ' + Math.round(ab) + ' m');
      if (hoch >= 1500 && w && w.min != null && w.min <= 0) dazu('Grundausstattung', 'groedel', 'Grödel', 'Frost, Schnee oder Eis möglich');
    } else if (art === 'stadt') {
      dazu('Grundausstattung', 'schuhe', 'Bequeme Schuhe');
      dazu('Grundausstattung', 'wasser', 'Trinkflasche: ' + lit);
      dazu('Grundausstattung', 'geld', 'Geld, Karte, Ausweis');
      dazu('Grundausstattung', 'ticket', 'Fahrkarte für Bus und Bahn');
      dazu('Grundausstattung', 'handy', 'Handy geladen');
      dazu('Grundausstattung', 'tasche', 'Kleine Tasche oder Rucksack');
    } else if (art === 'lauf') {
      dazu('Grundausstattung', 'schuhe', 'Laufschuhe');
      dazu('Grundausstattung', 'handy', 'Handy (Notruf, Aufzeichnung)');
      if (h >= 1) dazu('Grundausstattung', 'wasser', 'Getränk: ' + String(Math.max(0.5, Math.round(h * 0.5 * 2) / 2)).replace('.', ',') + ' l', 'über eine Stunde');
      if (h >= 1.5) dazu('Grundausstattung', 'gel', 'Gel oder Riegel', 'lange Runde');
      dazu('Grundausstattung', 'reflektor', 'Reflektoren', 'gesehen werden');
    } else {
      dazu('Grundausstattung', 'helm', 'Helm');
      dazu('Grundausstattung', 'wasser', 'Trinkflasche: ' + lit);
      dazu('Grundausstattung', 'flick', 'Flickzeug, Ersatzschlauch, Pumpe');
      dazu('Grundausstattung', 'schloss', 'Schloss');
      dazu('Grundausstattung', 'licht', 'Licht vorn und hinten');
      dazu('Grundausstattung', 'regenjacke', 'Regenjacke');
      dazu('Grundausstattung', 'handy', 'Handy geladen');
    }
    if (h >= 4 && art !== 'lauf') dazu('Grundausstattung', 'powerbank', 'Powerbank und Kabel', 'lange Tour');
    if (o.dunkel || h >= 7) dazu('Grundausstattung', 'lampe', 'Stirnlampe', o.dunkel ? 'Ankunft knapp vor Sonnenuntergang' : 'langer Tag');
    // Sonne: angesagt (oder ohne Vorhersage in der Höhe), Hitze
    const sonne = w ? (w.sonne || heiss) : (berg && hoch >= 1500);
    if (sonne || hoch >= 1500) {
      dazu('Sonne', 'creme', 'Sonnencreme', hoch >= 1500 ? 'in der Höhe stärker' : 'Sonne angesagt');
      dazu('Sonne', 'brille', 'Sonnenbrille');
      dazu('Sonne', 'kappe', 'Kappe oder Sonnenhut');
    }
    if (kalt) {
      dazu('Kleidung', 'muetze', 'Mütze und Handschuhe', w && w.min != null && w.min <= 5 ? 'bis ' + Math.round(w.min) + ' °C' : 'über 2000 m');
      dazu('Kleidung', 'warm', 'Warme Jacke (Fleece oder Daune)');
    }
    if (w && w.regen != null && w.regen >= 40) {
      if (art === 'stadt') dazu('Regen', 'schirm', 'Regenschirm', 'Regen ' + Math.round(w.regen) + ' %');
      else dazu('Regen', 'hose', 'Regenhose', 'Regen ' + Math.round(w.regen) + ' %');
      if (art !== 'lauf') dazu('Regen', 'huelle', 'Regenhülle für den Rucksack');
      dazu('Regen', 'tuete', 'Plastiktüte fürs Handy und trockene Socken');
    }
    if (w && w.wind != null && w.wind >= 40) dazu('Kleidung', 'wind', 'Windjacke', 'Böen bis ' + Math.round(w.wind) + ' km/h');
    if (w && w.gewitter) hinweise.push('Gewitter angesagt: früh starten, Grate und Gipfel am Nachmittag meiden, Umkehrzeit festlegen.');
    if (!w) hinweise.push('„🌦 Wetter für die Tour“ laden ergänzt Regen, Kälte und Sonne.');
    if (tage > 1) {
      dazu('Übernachtung', 'schlafsack', 'Hüttenschlafsack', 'auf Hütten Pflicht');
      dazu('Übernachtung', 'wasch', 'Zahnbürste, Zahnpasta, kleines Handtuch');
      dazu('Übernachtung', 'waesche', 'Wechselwäsche für ' + (tage - 1) + (tage === 2 ? ' Nacht' : ' Nächte'));
      dazu('Übernachtung', 'ohren', 'Ohrstöpsel');
      dazu('Übernachtung', 'lader', 'Ladegerät');
      dazu('Übernachtung', 'bar', 'Bargeld für die Hütte', 'oft keine Kartenzahlung');
      dazu('Übernachtung', 'reservierung', 'Reservierung und Mitgliedsausweis (Alpenverein)');
    }
    if (o.kind) {
      dazu('Mit Kind', 'snacks', 'Extra Brotzeit und etwas Süßes', 'Motivation');
      dazu('Mit Kind', 'wechsel', 'Wechselkleidung');
      dazu('Mit Kind', 'tuecher', 'Feuchttücher');
      if (sonne || hoch >= 1500) dazu('Mit Kind', 'hut', 'Sonnenhut fürs Kind');
    }
    const reihe = ['Grundausstattung', 'Kleidung', 'Sonne', 'Regen', 'Übernachtung', 'Mit Kind'];
    return { gruppen: reihe.filter(n => g.has(n)).map(n => ({ name: n, dinge: g.get(n) })), hinweise };
  }
  // Vorhersage für die Tour (Antworten von Open-Meteo je Punkt und Stunde) für die Packliste zusammenfassen
  function packWetter(stunden) {
    const l = (stunden || []).filter(Boolean);
    if (!l.length) return null;
    const zahlen = k => l.map(x => x[k]).filter(v => v != null && isFinite(v));
    const t = zahlen('temp'), r = zahlen('regen'), b = zahlen('boe').concat(zahlen('wind')), c = zahlen('code');
    return { min: t.length ? Math.min(...t) : null, max: t.length ? Math.max(...t) : null, regen: r.length ? Math.max(...r) : null,
      wind: b.length ? Math.max(...b) : null, gewitter: c.some(x => x >= 95), sonne: c.some(x => x <= 2) };
  }

  // ---------- ZIP (Sicherung mit Fotos als eigene Dateien) ----------
  // Nur „gespeichert“ (Methode 0): JPEGs werden durch Packen nicht kleiner, und so braucht es keine Bibliothek.
  let CRC_TAB = null;
  function crc32(b) {
    if (!CRC_TAB) {
      CRC_TAB = new Uint32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC_TAB[n] = c >>> 0; }
    }
    let c = 0xffffffff;
    for (let i = 0; i < b.length; i++) c = CRC_TAB[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  // dateien: [{ name, daten: Uint8Array }] → Teile (Uint8Array) zum Zusammensetzen, z. B. new Blob(teile)
  function zipTeile(dateien, zeit) {
    const z = new Date(zeit || Date.now());
    const dosZeit = (z.getHours() << 11) | (z.getMinutes() << 5) | (z.getSeconds() >> 1);
    const dosTag = ((Math.max(1980, z.getFullYear()) - 1980) << 9) | ((z.getMonth() + 1) << 5) | z.getDate();
    const enc = new TextEncoder();
    const teile = [], zentral = [];
    let pos = 0;
    for (const d of dateien) {
      const name = enc.encode(d.name), crc = crc32(d.daten), n = d.daten.length;
      if (n >= 0xffffffff || pos >= 0xffffffff) throw new Error('Sicherung zu groß für ZIP (über 4 GB)');
      const kopf = new Uint8Array(30 + name.length), v = new DataView(kopf.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, 0, true);
      v.setUint16(10, dosZeit, true); v.setUint16(12, dosTag, true); v.setUint32(14, crc, true); v.setUint32(18, n, true); v.setUint32(22, n, true);
      v.setUint16(26, name.length, true); v.setUint16(28, 0, true); kopf.set(name, 30);
      const zk = new Uint8Array(46 + name.length), w = new DataView(zk.buffer);
      w.setUint32(0, 0x02014b50, true); w.setUint16(4, 20, true); w.setUint16(6, 20, true); w.setUint16(8, 0x0800, true); w.setUint16(10, 0, true);
      w.setUint16(12, dosZeit, true); w.setUint16(14, dosTag, true); w.setUint32(16, crc, true); w.setUint32(20, n, true); w.setUint32(24, n, true);
      w.setUint16(28, name.length, true); w.setUint32(42, pos, true); zk.set(name, 46);
      teile.push(kopf, d.daten); zentral.push(zk);
      pos += kopf.length + n;
    }
    const zGroesse = zentral.reduce((s, x) => s + x.length, 0);
    const ende = new Uint8Array(22), e = new DataView(ende.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, dateien.length, true); e.setUint16(10, dateien.length, true);
    e.setUint32(12, zGroesse, true); e.setUint32(16, pos, true);
    return teile.concat(zentral, [ende]);
  }
  // ZIP lesen über das zentrale Verzeichnis: [{ name, daten }] (daten null, wenn gepackt oder kaputt; Grund in fehler)
  function zipLesen(b) {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let e = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error('keine ZIP-Datei');
    const anzahl = v.getUint16(e + 10, true);
    let p = v.getUint32(e + 16, true);
    const dec = new TextDecoder();
    const out = [];
    for (let k = 0; k < anzahl; k++) {
      if (p + 46 > b.length || v.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP-Verzeichnis kaputt');
      const methode = v.getUint16(p + 10, true), crc = v.getUint32(p + 16, true), groesse = v.getUint32(p + 20, true);
      const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), kl = v.getUint16(p + 32, true), lage = v.getUint32(p + 42, true);
      const name = dec.decode(b.subarray(p + 46, p + 46 + nl));
      p += 46 + nl + xl + kl;
      const x = { name, daten: null, fehler: '' };
      if (lage + 30 > b.length || v.getUint32(lage, true) !== 0x04034b50) x.fehler = 'Eintrag kaputt';
      else if (methode !== 0) x.fehler = 'gepackt (nur ungepackte ZIP-Dateien von Gipfel & Gasse)';
      else {
        const start = lage + 30 + v.getUint16(lage + 26, true) + v.getUint16(lage + 28, true);
        const d = b.subarray(start, start + groesse);
        if (d.length !== groesse || crc32(d) !== crc) x.fehler = 'Prüfsumme falsch'; else x.daten = d;
      }
      out.push(x);
    }
    return out;
  }
  // Art eines Bildes an den ersten Bytes (nicht an Name oder Angabe der Datei)
  function bildArt(b) {
    if (b && b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b && b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
    if (b && b.length > 12 && String.fromCharCode(b[0], b[1], b[2], b[3], b[8], b[9], b[10], b[11]) === 'RIFFWEBP') return 'image/webp';
    return null;
  }

  // ---------- Ort und Zeit eines Fotos (EXIF im Original der Kamera) ----------
  // { lat, lon } aus dem GPS-Teil und zeit (ms) aus DateTimeOriginal (Ortszeit des Geräts, mit Versatz, wenn angegeben)
  function exifLesen(b) {
    if (!b || b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let p = 2, t = -1;
    while (p + 4 <= b.length && b[p] === 0xff) {
      const m = b[p + 1], l = v.getUint16(p + 2);
      if (m === 0xda || m === 0xd9) break;
      if (m === 0xe1 && p + 10 < b.length && v.getUint32(p + 4) === 0x45786966) { t = p + 10; break; }
      p += 2 + l;
    }
    if (t < 0 || t + 8 > b.length) return null;
    const le = v.getUint16(t) === 0x4949;
    const u16 = o => v.getUint16(t + o, le), u32 = o => v.getUint32(t + o, le);
    const ok = o => o >= 0 && t + o + 12 <= b.length;
    const ifd = o => {
      const m = new Map();
      if (!ok(o)) return m;
      const n = u16(o);
      for (let i = 0; i < n; i++) { const e = o + 2 + i * 12; if (!ok(e)) break; m.set(u16(e), { typ: u16(e + 2), n: u32(e + 4), wert: e + 8 }); }
      return m;
    };
    const ascii = x => { if (!x || x.typ !== 2) return ''; const o = x.n > 4 ? u32(x.wert) : x.wert; let s = ''; for (let i = 0; i < x.n - 1 && t + o + i < b.length; i++) s += String.fromCharCode(b[t + o + i]); return s; };
    const grad = x => { if (!x || x.typ !== 5 || x.n !== 3) return null; const o = u32(x.wert); if (!ok(o + 12)) return null; const r = i => (u32(o + i * 8 + 4) ? u32(o + i * 8) / u32(o + i * 8 + 4) : NaN); return r(0) + r(1) / 60 + r(2) / 3600; };
    const out = {};
    const null0 = ifd(u32(4));
    const ex = null0.get(0x8769), gps = null0.get(0x8825);
    if (ex) {
      const e = ifd(u32(ex.wert));
      const s = ascii(e.get(0x9003)), vs = ascii(e.get(0x9011));
      const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(s);
      if (m && m[1] !== '0000') {
        const z = /^([+-])(\d\d):(\d\d)$/.exec(vs);
        out.zeit = z ? Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]) - (z[1] === '-' ? -1 : 1) * (z[2] * 60 + +z[3]) * 60000
          : new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
      }
    }
    if (gps) {
      const g = ifd(u32(gps.wert));
      const lat = grad(g.get(2)), lon = grad(g.get(4));
      const lr = ascii(g.get(1)), lo = ascii(g.get(3));
      if (lat != null && lon != null && isFinite(lat) && isFinite(lon) && (lat || lon) && lat <= 90 && lon <= 180) {
        out.lat = lr === 'S' ? -lat : lat; out.lon = lo === 'W' ? -lon : lon;
      }
    }
    return out.zeit != null || out.lat != null ? out : null;
  }
  // Stelle eines Fotos an einer gegangenen Tour (spur gepackt: [lat, lon, ele, t, lücke]):
  // 1. Ort aus dem Foto (EXIF), wenn höchstens 1 km neben der Spur; 2. Zeitpunkt (Foto, sonst Eintrag) auf der Spur, wenn
  // er in die Tour fällt (± 15 min); 3. Ort des Eintrags, wenn höchstens 300 m neben der Spur. Sonst null.
  function fotoOrt(info, eintrag, spur) {
    if (!Array.isArray(spur) || !spur.length) return null;
    const pts = spur.map(x => ({ lat: x[0], lon: x[1], luecke: !!x[4] }));
    if (info && info.lat != null && abstandZurLinie(pts, info.lat, info.lon) <= 1000) return { lat: info.lat, lon: info.lon, wie: 'gps' };
    const zt = spur.filter(x => x[3]);
    const zeit = info && info.zeit != null ? info.zeit : eintrag && eintrag.zeit;
    if (zt.length > 1 && zeit != null && zeit >= zt[0][3] - 9e5 && zeit <= zt[zt.length - 1][3] + 9e5) {
      let i = 0;
      while (i < zt.length - 1 && zt[i + 1][3] < zeit) i++;
      const a = zt[i], b = zt[Math.min(i + 1, zt.length - 1)];
      const f = b[3] > a[3] ? Math.max(0, Math.min(1, (zeit - a[3]) / (b[3] - a[3]))) : 0;
      return { lat: a[0] + (b[0] - a[0]) * f, lon: a[1] + (b[1] - a[1]) * f, wie: 'zeit' };
    }
    const o = eintrag && eintrag.ort;
    if (o && abstandZurLinie(pts, o.lat, o.lon) <= 300) return { lat: o.lat, lon: o.lon, wie: 'eintrag' };
    return null;
  }

  // Reise, die heute läuft (für „Eintrag schreiben“ ohne Umweg); bei mehreren die zuletzt begonnene
  function reiseHeute(reisen, heute) {
    return reisen.filter(r => r.von <= heute && r.bis >= heute).sort((a, b) => (a.von < b.von ? 1 : -1))[0] || null;
  }
  // Übersicht fürs Heft einer Reise: Wege (Touren) und nummerierte Orte (Einträge) als SVG ohne Kartenkacheln, winkeltreu
  // genug für eine Skizze (Länge mit cos(Breite) gestaucht), mit Maßstab. orte: [{lat, lon, nr}], linien: [[{lat, lon}, …]]
  // Spur an Lücken (mehrteilige Aufzeichnung oder GPX) in Abschnitte teilen, damit eine Skizze keine nicht gegangenen Wege zeigt
  function spurTeile(pts) {
    const teile = [[]];
    for (const p of pts) { if (p.luecke && teile[teile.length - 1].length) teile.push([]); teile[teile.length - 1].push(p); }
    return teile.filter(t => t.length > 1);
  }
  function heftSkizze(orte, linien, breite, hoehe) {
    const alle = orte.concat(...linien);
    if (!alle.length) return '';
    let s = Infinity, n = -Infinity, w = Infinity, o = -Infinity;
    for (const p of alle) { s = Math.min(s, p.lat); n = Math.max(n, p.lat); w = Math.min(w, p.lon); o = Math.max(o, p.lon); }
    const k = Math.cos((s + n) / 2 * RAD), rand = 24;
    const bx = Math.max((o - w) * k, 0.002), by = Math.max(n - s, 0.002);   // ein einzelner Ort: kleiner Ausschnitt drumherum
    const f = Math.min((breite - 2 * rand) / bx, (hoehe - 2 * rand) / by);
    const x0 = (breite - bx * f) / 2, y0 = (hoehe - by * f) / 2;
    const xy = p => [x0 + ((p.lon - w) * k + (bx - (o - w) * k) / 2) * f, y0 + (n - p.lat + (by - (n - s)) / 2) * f];
    const r1 = v => Math.round(v * 10) / 10;
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + breite + ' ' + hoehe + '" class="heft-skizze">' +
      '<rect width="' + breite + '" height="' + hoehe + '" fill="#f4f6f2" rx="8"/>';
    for (const l of linien) {
      if (l.length < 2) continue;
      svg += '<polyline fill="none" stroke="#e5532d" stroke-width="2.5" stroke-linejoin="round" points="' + l.map(p => xy(p).map(r1).join(',')).join(' ') + '"/>';
    }
    for (const p of orte) {
      const [x, y] = xy(p).map(r1);
      svg += '<circle cx="' + x + '" cy="' + y + '" r="9" fill="#2f6b3a" stroke="#fff" stroke-width="2"/>' +
        '<text x="' + x + '" y="' + r1(y + 3.5) + '" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">' + esc(String(p.nr)) + '</text>';
    }
    // Maßstab: runde Länge, die etwa ein Viertel der Breite füllt
    const meterJePx = 111320 / f, ziel = meterJePx * breite / 4;
    const stufe = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000].find(m => m >= ziel) || 1000000;
    const lpx = r1(stufe / meterJePx);
    svg += '<g font-size="10" fill="#1c2620"><rect x="12" y="' + (hoehe - 16) + '" width="' + lpx + '" height="4" fill="#1c2620"/>' +
      '<text x="12" y="' + (hoehe - 20) + '">' + kmText(stufe) + '</text></g></svg>';
    return svg;
  }

  // Tagebuch aus einer Sicherung: Feld für Feld neu aufgebaut wie die Touren; Fotos als JPEG-Daten-Adressen
  function tagebuchPruefen(tb, fotos) {
    const text = (x, n) => (typeof x === 'string' ? x.slice(0, n) : null);
    const zahl = x => (typeof x === 'number' && isFinite(x) ? x : null);
    const tag = x => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);
    const id = x => (typeof x === 'string' && /^[\w-]{1,64}$/.test(x) ? x : null);
    const out = { reisen: [], eintraege: [], fotos: {} };
    if (!tb || typeof tb !== 'object') return out;
    for (const r of Array.isArray(tb.reisen) ? tb.reisen : []) {
      const o = r && { id: id(r.id), name: text(r.name, 120), von: tag(r.von), bis: tag(r.bis) };
      // Etappen einer Mehrtagestour (aus Planen › „Als Reise ins Tagebuch“), fürs Heft
      if (o && Array.isArray(r.etappen)) {
        const et = r.etappen.slice(0, 30).filter(x => x && typeof x === 'object').map(x => ({ ziel: text(x.ziel, 120) || '',
          meter: Math.max(0, zahl(x.meter) || 0), auf: Math.max(0, zahl(x.auf) || 0), ab: Math.max(0, zahl(x.ab) || 0), zeit: Math.max(0, zahl(x.zeit) || 0) }));
        if (et.length) o.etappen = et;
      }
      if (o && o.id && o.name && o.von && o.bis && o.von <= o.bis) out.reisen.push(o);
    }
    const reiseIds = new Set(out.reisen.map(r => r.id));
    const fotoOk = x => (typeof x === 'string' && x.length < 8e6 && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(x)) ||
      (x instanceof Uint8Array && x.length < 6e6 && !!bildArt(x));
    for (const e of Array.isArray(tb.eintraege) ? tb.eintraege : []) {
      if (!e || !id(e.id) || !reiseIds.has(e.reise) || zahl(e.zeit) == null) continue;
      const o = { id: e.id, reise: e.reise, zeit: e.zeit, text: text(e.text, 20000) || '', fotos: [] };
      if (e.ort && zahl(e.ort.lat) != null && zahl(e.ort.lon) != null && Math.abs(e.ort.lat) <= 90 && Math.abs(e.ort.lon) <= 180) {
        o.ort = { lat: e.ort.lat, lon: e.ort.lon };
        if (text(e.ort.name, 120)) o.ort.name = text(e.ort.name, 120);
      }
      if (e.wetter && zahl(e.wetter.temp) != null && Number.isInteger(e.wetter.code)) o.wetter = { temp: e.wetter.temp, code: e.wetter.code };
      for (const f of Array.isArray(e.fotos) ? e.fotos : []) {
        if (id(f) && fotos && fotoOk(fotos[f])) { o.fotos.push(f); out.fotos[f] = fotos[f]; }
      }
      // Ort und Zeitpunkt der Aufnahme je Foto (aus dem Original), nur für Fotos des Eintrags
      if (e.fotoInfo && typeof e.fotoInfo === 'object') {
        for (const f of o.fotos) {
          const x = e.fotoInfo[f];
          if (!x || typeof x !== 'object') continue;
          const i = {};
          if (zahl(x.lat) != null && zahl(x.lon) != null && Math.abs(x.lat) <= 90 && Math.abs(x.lon) <= 180) { i.lat = x.lat; i.lon = x.lon; }
          if (zahl(x.zeit) != null) i.zeit = x.zeit;
          if (Object.keys(i).length) (o.fotoInfo = o.fotoInfo || {})[f] = i;
        }
      }
      out.eintraege.push(o);
    }
    return out;
  }

  // ---------- Wetter (Open-Meteo, WMO-Codes) ----------
  function wetterText(code) {
    const c = +code;
    if (c === 0) return ['☀️', 'sonnig'];
    if (c <= 2) return ['🌤️', 'heiter'];
    if (c === 3) return ['☁️', 'bedeckt'];
    if (c === 45 || c === 48) return ['🌫️', 'Nebel'];
    if (c >= 51 && c <= 57) return ['🌦️', 'Niesel'];
    if (c >= 61 && c <= 67) return ['🌧️', 'Regen'];
    if (c >= 71 && c <= 77) return ['🌨️', 'Schnee'];
    if (c >= 80 && c <= 82) return ['🌦️', 'Schauer'];
    if (c === 85 || c === 86) return ['🌨️', 'Schneeschauer'];
    if (c >= 95) return ['⛈️', 'Gewitter'];
    return ['❔', 'unbekannt'];
  }

  // Wetter für die Tour: eine Anfrage für mehrere Punkte (Start, höchster Punkt, Ziel je Tag), mit ihrer Höhe: Open-Meteo
  // rechnet die Vorhersage auf diese Höhe um (sonst gälte die Geländehöhe des Rasters, am Gipfel oft Hunderte Meter tiefer)
  const TOUR_WETTER = 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m';
  function tourWetterUrl(punkte) {
    const z = f => punkte.map(f).join(',');
    // ohne eigene Höhe „nan“: dann nimmt Open-Meteo für diesen Punkt die Geländehöhe, die anderen behalten ihre
    const hoehe = p => (p.ele != null && isFinite(p.ele) ? Math.round(p.ele) : 'nan');
    return 'https://api.open-meteo.com/v1/forecast?latitude=' + z(p => p.lat.toFixed(4)) + '&longitude=' + z(p => p.lon.toFixed(4)) +
      '&elevation=' + z(hoehe) + '&hourly=' + TOUR_WETTER + '&timeformat=unixtime&forecast_days=16';
  }
  // Werte der Stunde, in der man an diesem Ort ist; null außerhalb der Vorhersage
  function wetterStunde(ort, t) {
    const h = ort && ort.hourly;
    if (!h || !Array.isArray(h.time)) return null;
    const s = Math.floor(t / 1000);
    let i = -1;
    for (let k = 0; k < h.time.length; k++) if (h.time[k] <= s) i = k; else break;
    if (i < 0 || s - h.time[i] >= 3600) return null;
    const w = k => (Array.isArray(h[k]) && h[k][i] != null ? h[k][i] : null);
    return { temp: w('temperature_2m'), regen: w('precipitation_probability'), code: w('weather_code'), wind: w('wind_speed_10m'), boe: w('wind_gusts_10m') };
  }
  // „⛅ heiter, 8 °C · Regen 20 % · Wind 25 km/h, Böen 45“ und Warnungen (Gewitter, Sturmböen, Frost)
  function tourWetterText(w, vorbei) {
    if (!w) return { text: vorbei ? 'liegt in der Vergangenheit' : 'außerhalb der Vorhersage (höchstens 16 Tage)', warn: [] };
    const [zeichen, art] = wetterText(w.code), teile = [zeichen + ' ' + art];
    if (w.temp != null) teile[0] += ', ' + Math.round(w.temp) + ' °C';
    if (w.regen != null) teile.push('Regen ' + Math.round(w.regen) + ' %');
    if (w.wind != null) teile.push('Wind ' + Math.round(w.wind) + ' km/h' + (w.boe != null ? ', Böen ' + Math.round(w.boe) : ''));
    const warn = [];
    if (+w.code >= 95) warn.push('Gewitter');
    if (w.boe != null && w.boe >= 60) warn.push('Sturmböen');
    if (w.temp != null && w.temp <= 0) warn.push('Frost');
    return { text: teile.join(' · '), warn };
  }


  // ---------- Stadt: Sehenswürdigkeiten im Kartenausschnitt ----------
  // min = vorgeschlagene Besichtigungszeit in Minuten, wenn der Ort als Stopp in die Tour kommt
  const STADT = [
    { k: 'museum', name: 'Museen und Galerien', zeichen: '🖼️', min: 60, test: t => /^(museum|gallery)$/.test(t.tourism) },
    { k: 'sehens', name: 'Sehenswürdigkeiten', zeichen: '🏛️', min: 20, test: t => /^(attraction|zoo|aquarium|theme_park)$/.test(t.tourism) || !!t.historic || (t.amenity === 'place_of_worship' && !!(t.wikidata || t.wikipedia)) },
    { k: 'aussicht', name: 'Aussicht', zeichen: '🔭', min: 15, test: t => t.tourism === 'viewpoint' },
    { k: 'park', name: 'Parks und Gärten', zeichen: '🌳', min: 20, test: t => /^(park|garden)$/.test(t.leisure) },
    { k: 'kunst', name: 'Kunst und Brunnen', zeichen: '⛲', min: 5, test: t => t.tourism === 'artwork' || t.amenity === 'fountain' },
    { k: 'eis', name: 'Eis und Café', zeichen: '🍦', min: 20, test: t => t.amenity === 'ice_cream' || t.amenity === 'cafe' },
    { k: 'spiel', name: 'Spielplätze', zeichen: '🛝', min: 30, test: t => t.leisure === 'playground' },
    { k: 'info', name: 'Touristinfo', zeichen: 'ℹ️', min: 10, test: t => t.tourism === 'information' },
    { k: 'wc', name: 'Toiletten', zeichen: '🚻', min: 0, test: t => t.amenity === 'toilets' }
  ];

  // Abfrage für einen Ausschnitt [süd, west, nord, ost]
  function stadtAbfrage(bbox) {
    const b = bbox.map(x => (+x).toFixed(5)).join(',');
    const teile = [
      'nwr["tourism"~"^(attraction|museum|gallery|viewpoint|artwork|zoo|aquarium|theme_park)$"]',
      'nwr["historic"~"^(monument|memorial|castle|ruins|city_gate|archaeological_site|fort|palace|manor|church|monastery|tower|building)$"]["name"]',
      'nwr["amenity"="place_of_worship"]["wikidata"]',
      'nwr["amenity"="fountain"]["name"]',
      'nwr["amenity"="ice_cream"]',
      'nwr["amenity"="cafe"]["wikidata"]',
      'nwr["leisure"~"^(park|garden)$"]["name"]',
      'nwr["leisure"="playground"]',
      'nwr["tourism"="information"]["information"="office"]',
      'node["amenity"="toilets"]'
    ];
    return '[out:json][timeout:25][bbox:' + b + '];(' + teile.map(t => t + ';').join('') + ');out center tags 2000;';
  }

  function stadtLesen(json) {
    const out = [], gesehen = new Set();
    for (const el of (json && json.elements) || []) {
      const lat = el.lat != null ? el.lat : el.center && el.center.lat, lon = el.lon != null ? el.lon : el.center && el.center.lon;
      if (lat == null) continue;
      const t = el.tags || {};
      const kat = STADT.find(o => o.test(t));
      if (!kat) continue;
      const name = t['name:de'] || t.name || '';
      // dieselbe Sache als Punkt und als Fläche nur einmal
      const k = kat.k + '|' + name + '|' + lat.toFixed(3) + lon.toFixed(3);
      if (name && gesehen.has(k)) continue;
      gesehen.add(k);
      const bekannt = !!(t.wikipedia || t.wikidata);
      out.push({ id: el.type + '/' + el.id, lat, lon, kat: kat.k, name: name || stadtArt(t), bekannt, tags: t,
        min: kat.min + (bekannt && kat.k === 'sehens' ? 10 : 0) });
    }
    // bekannte Orte zuerst, dann mit Namen, dann der Rest
    out.sort((a, b) => (b.bekannt - a.bekannt) || ((b.tags.name ? 1 : 0) - (a.tags.name ? 1 : 0)));
    return out;
  }

  function stadtArt(t) {
    return { museum: 'Museum', gallery: 'Galerie', viewpoint: 'Aussichtspunkt', artwork: 'Kunstwerk', attraction: 'Sehenswürdigkeit', information: 'Touristinfo' }[t.tourism] ||
      { fountain: 'Brunnen', ice_cream: 'Eisdiele', cafe: 'Café', toilets: 'Toilette', place_of_worship: 'Kirche' }[t.amenity] ||
      { playground: 'Spielplatz', park: 'Park', garden: 'Garten' }[t.leisure] ||
      (t.historic ? 'Denkmal' : 'Ort');
  }

  // Link zur Wikipedia aus dem OSM-Merkmal "de:Titel"
  function wikiLink(t) {
    const w = t && t.wikipedia;
    if (!w) return null;
    const m = /^([a-z-]{2,12}):(.+)$/.exec(w);
    if (!m) return null;
    return 'https://' + m[1] + '.wikipedia.org/wiki/' + encodeURIComponent(m[2].replace(/ /g, '_'));
  }

  // Wikipedia-Artikel zu einem Ort: aus "wikipedia" (Sprache:Titel) oder nur die Wikidata-Nummer zum Nachschlagen
  function wikiQuelle(t) {
    const w = t && t.wikipedia, m = w && /^([a-z-]{2,12}):(.+)$/.exec(w);
    if (m) return { sprache: m[1], titel: m[2].replace(/ /g, '_') };
    const q = t && /^Q\d+$/.test(t.wikidata || '') ? t.wikidata : null;
    return q ? { wikidata: q } : null;
  }
  // Wikidata-Antwort (wbgetentities, sitelinks): deutscher Artikel bevorzugt, sonst englischer
  function wikiAusWikidata(json, q) {
    const s = json && json.entities && json.entities[q] && json.entities[q].sitelinks;
    if (!s) return null;
    for (const [site, sprache] of [['dewiki', 'de'], ['enwiki', 'en']]) if (s[site] && s[site].title) return { sprache, titel: s[site].title.replace(/ /g, '_') };
    return null;
  }
  // Zusammenfassung der Wikipedia (REST page/summary) als Kurzinfo; null bei Begriffsklärung oder ohne Text
  function wikiKurz(json) {
    if (!json || json.type === 'disambiguation' || !json.extract) return null;
    const bild = json.thumbnail && /^https:\/\//.test(json.thumbnail.source) ? json.thumbnail.source : null;
    const url = json.content_urls && json.content_urls.mobile && json.content_urls.mobile.page;
    return { text: String(json.extract).trim(), bild, url: /^https:\/\//.test(url || '') ? url : null };
  }

  // ---------- Öffnungszeiten (OSM opening_hours, der übliche Teil) ----------
  // Verstanden: 24/7; Wochentage (Mo-Fr, Sa,Su), Monate (Apr-Oct), Zeiten (10:00-12:00,14:00-18:00, über Mitternacht),
  // off/closed; Regeln mit ";" (spätere ersetzt den Tag) und ", " (kommt dazu). Feiertage (PH) und Schulferien (SH)
  // kennt die App nicht: solche Regeln bleiben außen vor, der Text sagt es dazu. Alles andere: null (dann Rohtext zeigen).
  const OH_TAGE = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const OH_MONATE = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const TAG_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  function ohBereich(text, namen) {
    // "Mo-Fr,Su" → Menge der Indizes; Bereiche dürfen umlaufen (Fr-Mo, Nov-Mar)
    const menge = new Set();
    for (const teil of text.split(',')) {
      const m = /^([A-Za-z]{2,3})(?:-([A-Za-z]{2,3}))?$/.exec(teil);
      if (!m) return null;
      const a = namen.indexOf(m[1]), b = m[2] ? namen.indexOf(m[2]) : a;
      if (a < 0 || b < 0) return null;
      for (let i = a; ; i = (i + 1) % namen.length) { menge.add(i); if (i === b) break; }
    }
    return menge;
  }
  function ohZeiten(text) {
    const z = [];
    for (let teil of text.split(',')) {
      // Dritter Wert jeder Zeitspanne: wie sicher sie ist. „11:30+“: ab 11:30, Ende offen ('ab', bis Mitternacht
      // eingetragen, aber nicht sicher); „12:00-22:00+“: mindestens bis 22:00, danach unklar ('mind')
      const offen = /^(\d{1,2}):(\d{2})\+$/.exec(teil);
      if (offen) {
        const a = +offen[1] * 60 + +offen[2];
        if (a >= 1440 || +offen[2] > 59) return null;
        z.push([a, 1440, 'ab']);
        continue;
      }
      const mind = /\+$/.test(teil);
      teil = teil.replace(/\+$/, '');
      const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(teil);
      if (!m) return null;
      const a = +m[1] * 60 + +m[2];
      let b = +m[3] * 60 + +m[4];
      if (a > 1440 || b > 2880 || +m[2] > 59 || +m[4] > 59) return null;
      if (b <= a) b += 1440;   // über Mitternacht
      z.push(mind ? [a, b, 'mind'] : [a, b]);
    }
    return z;
  }
  function oeffnungLesen(roh) {
    if (typeof roh !== 'string') return null;
    const s = roh.replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
    if (!s) return null;
    if (s === '24/7') return { regeln: [{ zus: false, monate: null, tage: null, zeiten: [[0, 1440]] }], feiertage: false, immer: true };
    if (/\|\||"|\[|week|easter|sunrise|sunset|dawn|dusk|\d{4}/.test(s)) return null;
    const regeln = [];
    let feiertage = false, saison = false;
    const MON = '(?:' + OH_MONATE.join('|') + ')';
    // „Apr-Oct: Mo-Su 10:00-16:00“: der Doppelpunkt nach den Monaten ist nur Gliederung
    const s2 = s.replace(new RegExp('(' + MON + '(?:\\s*\\d{1,2})?)\\s*:\\s+', 'g'), '$1 ');
    const sel = '(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|SH|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\\b';
    for (const gruppe of s2.split(';').map(x => x.trim()).filter(Boolean)) {
      // ", " vor einem Wochentag oder Monat beginnt eine Regel, die dazukommt; "Mo, We 10:00-12:00" gehört zusammen
      const stuecke = gruppe.split(new RegExp(',\\s*(?=' + sel + ')'));
      const teile = [];
      for (const st of stuecke) {
        if (teile.length && !/\d|off|closed/.test(teile[teile.length - 1])) teile[teile.length - 1] += ',' + st.trim();
        else teile.push(st.trim());
      }
      teile.forEach((teil, i) => {
        if (regeln === null) return;
        // Zeitraum mit Tagen: „May 09-Oct 18 Tu-Su 10:00-22:00“, „May 1-Sep 15“, „Dec 24 off“ (Monat × 100 + Tag)
        let datum = null;
        const dm = new RegExp('^(' + MON + ')\\s*(\\d{1,2})(?:\\s*-\\s*(' + MON + ')\\s*(\\d{1,2}))?(?:\\s+|$)').exec(teil);
        if (dm) {
          const a = (OH_MONATE.indexOf(dm[1]) + 1) * 100 + +dm[2];
          const b = dm[3] ? (OH_MONATE.indexOf(dm[3]) + 1) * 100 + +dm[4] : a;
          if (+dm[2] < 1 || +dm[2] > 31 || (dm[4] && (+dm[4] < 1 || +dm[4] > 31))) { regeln.length = 0; regeln.push(null); return; }
          datum = [a, b];
          teil = teil.slice(dm[0].length);
        }
        const m = new RegExp('^(?:((?:' + OH_MONATE.join('|') + ')[A-Za-z,-]*)(?:\\s+|$))?(?:((?:' + OH_TAGE.join('|') + '|PH|SH)[A-Za-z,-]*)\\s*)?(.*)$').exec(teil);
        let [, mon, tag, rest] = m;
        rest = rest.trim();
        let monate = null, tage = null, zeiten;
        if (mon) { monate = ohBereich(mon.replace(/\s/g, ''), OH_MONATE); if (!monate) { regeln.length = 0; regeln.push(null); return; } }
        if (tag) {
          const liste = tag.replace(/\s/g, '').split(',');
          const ohne = liste.filter(x => x !== 'PH' && x !== 'SH');
          if (ohne.length < liste.length) feiertage = true;
          if (!ohne.length) return;   // nur Feiertage oder Ferien: unbekannt, Regel außen vor
          tage = ohBereich(ohne.join(','), OH_TAGE);
          if (!tage) { regeln.length = 0; regeln.push(null); return; }
        }
        if (/^(off|closed)$/i.test(rest)) zeiten = [];
        // nur Tage oder Saison, keine Uhrzeit („Tu-Su“, „Jun-Aug“): an diesen Tagen geöffnet, Zeiten unbekannt
        else if (!rest) zeiten = monate || tage || datum ? [[0, 1440, 'ohne']] : null;
        else zeiten = ohZeiten(rest.replace(/\s/g, ''));
        if (!zeiten) { regeln.length = 0; regeln.push(null); return; }
        // Saison: Monate oder Tage mit Datum, an denen geöffnet ist (ein Schließtag wie „Dec 24-Dec 31 off“ ist keine)
        if ((monate || datum) && zeiten.length) saison = true;
        regeln.push({ zus: i > 0, monate, tage, datum, zeiten });
      });
      if (regeln[0] === null) return null;
    }
    // nur Schließtage („Dec 24 off“) sagen nichts über die übrigen Tage: unbekannt, nicht „immer zu“
    if (!regeln.length || regeln.every(r => !r.zeiten.length)) return null;
    return { regeln, feiertage, saison, immer: false };
  }
  function ohImDatum(datum, d) {
    const md = (d.getMonth() + 1) * 100 + d.getDate(), [a, b] = datum;
    return a <= b ? md >= a && md <= b : md >= a || md <= b;   // über den Jahreswechsel (Nov 15-Mar 15)
  }
  // Zeiträume eines Kalendertags (Minuten ab 0:00, Ende bis 2880), ohne den Überhang vom Vortag
  function ohTag(oh, d) {
    let z = [];
    for (const r of oh.regeln) {
      if (r.monate && !r.monate.has(d.getMonth())) continue;
      if (r.datum && !ohImDatum(r.datum, d)) continue;
      if (r.tage && !r.tage.has(d.getDay())) continue;
      // Zusatzregel nach „,“ ergänzt Zeiten; „, We off“ schließt diese Tage aber (wie opening_hours.js)
      z = r.zus && r.zeiten.length ? z.concat(r.zeiten) : r.zeiten.slice();
    }
    return z;
  }
  function hhmm(min) { min = ((min % 1440) + 1440) % 1440; return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0'); }
  // „bis“ mit Tag, wenn die Zeitspanne über Mitternacht reicht (Minuten ab dem Tag 0:00)
  function ohBis(ende, tagPlus) {
    if (ende === 1440) return '24:00';
    return (ende > 1440 ? (ende >= 2880 ? TAG_KURZ[tagPlus(Math.floor(ende / 1440)).getDay()] + ' ' : 'morgen ') : '') + hhmm(ende);
  }
  // Zustände: 'offen' | 'bald' | 'zu' | 'vage' | 'unbekannt'. vage = laut OSM wohl geöffnet, aber ohne sichere Uhrzeit
  // (nur Tage oder Saison eingetragen, offenes Ende): die App behauptet dann nichts, was sie nicht weiß.
  // Stand jetzt; „bald“ = schließt in höchstens 30 min
  function oeffnungJetzt(roh, jetzt) {
    const oh = oeffnungLesen(roh);
    if (!oh) return { zustand: 'unbekannt', text: '' };
    const zusatz = oh.feiertage ? ' (Feiertage nicht berücksichtigt)' : '';
    if (oh.immer) return { zustand: 'offen', text: 'rund um die Uhr geöffnet' };
    const { zus, tagPlus } = ohAchse(oh, jetzt);
    const m = jetzt.getHours() * 60 + jetzt.getMinutes();
    const jetztZ = zus.find(([a, b]) => a <= m && m < b);
    if (jetztZ) {
      if (jetztZ[2] === 'ohne') return { zustand: 'vage', text: 'heute geöffnet laut OSM, Uhrzeit nicht eingetragen' + zusatz };
      if (jetztZ[1] - m > 8 * 1440) return { zustand: 'offen', text: 'durchgehend geöffnet' + zusatz };
      if (jetztZ[2] === 'ab') return { zustand: 'vage', text: 'geöffnet ab ' + hhmm(jetztZ[0]) + ', Ende offen' + zusatz };
      if (jetztZ[2] === 'mind') return { zustand: 'offen', text: 'geöffnet mindestens bis ' + ohBis(jetztZ[1], tagPlus) + zusatz };
      return jetztZ[1] - m <= 30 ? { zustand: 'bald', text: 'schließt bald, um ' + hhmm(jetztZ[1]) + zusatz } : { zustand: 'offen', text: 'geöffnet bis ' + ohBis(jetztZ[1], tagPlus) + zusatz };
    }
    const vorher = zus.filter(([, b]) => b <= m && b > 0).pop();
    if (vorher && vorher[2] === 'mind') return { zustand: 'vage', text: 'geöffnet mindestens bis ' + hhmm(vorher[1]) + ', danach unklar' + zusatz };
    const naechst = zus.find(([a]) => a > m);
    const heuteZu = !zus.some(([a, b]) => a < 1440 && b > 0) ? 'heute geschlossen' : 'geschlossen';
    if (!naechst || naechst[0] >= 8 * 1440) return { zustand: 'zu', text: (oh.saison ? 'geschlossen, außerhalb der Saison' : heuteZu) + zusatz };
    const n = Math.floor(naechst[0] / 1440);
    if (naechst[2] === 'ohne') return { zustand: 'zu', text: heuteZu + ', geöffnet wieder ' + (n === 1 ? 'morgen' : TAG_KURZ[tagPlus(n).getDay()]) + ' (Uhrzeit nicht eingetragen)' + zusatz };
    const wann = n === 0 ? 'um ' : n === 1 ? 'morgen ' : TAG_KURZ[tagPlus(n).getDay()] + ' ';
    return { zustand: 'zu', text: heuteZu + ', öffnet ' + wann + hhmm(naechst[0]) + zusatz };
  }
  // alle Zeiträume von gestern bis in 8 Tagen auf einer Achse (Minuten ab dem Tag von `wann`, 0:00), zusammengefügt.
  // Gewissheit der zusammengefügten Spanne: 'ohne', sobald ein Teil ohne Uhrzeit ist, sonst die des Teils mit dem spätesten Ende
  function ohAchse(oh, wann) {
    const tag0 = new Date(wann.getFullYear(), wann.getMonth(), wann.getDate());
    const tagPlus = n => new Date(tag0.getFullYear(), tag0.getMonth(), tag0.getDate() + n);
    const alle = [];
    for (let n = -1; n <= 8; n++) for (const [a, b, art] of ohTag(oh, tagPlus(n))) alle.push([a + n * 1440, b + n * 1440, art]);
    alle.sort((x, y) => x[0] - y[0]);
    const zus = [];
    for (const z of alle) {
      const l = zus[zus.length - 1];
      if (l && z[0] <= l[1]) {
        if (l[2] === 'ohne' || z[2] === 'ohne') l[2] = 'ohne';
        else if (z[1] > l[1]) l[2] = z[2];
        l[1] = Math.max(l[1], z[1]);
      } else zus.push(z.slice());
    }
    return { zus, tagPlus };
  }

  // Passt ein Besuch? Ankunft `an` (Date), Aufenthalt `minuten`. { zustand: 'offen' | 'knapp' | 'zu' | 'vage' | 'unbekannt', text }
  // knapp = schließt während des Besuchs oder öffnet erst kurz nach der Ankunft (bis 30 min warten)
  function oeffnungBesuch(roh, an, minuten) {
    const oh = oeffnungLesen(roh);
    if (!oh) return { zustand: 'unbekannt', text: '' };
    if (oh.immer) return { zustand: 'offen', text: 'rund um die Uhr geöffnet' };
    const zusatz = oh.feiertage ? ' (Feiertage nicht berücksichtigt)' : '';
    const { zus, tagPlus } = ohAchse(oh, an);
    const m = an.getHours() * 60 + an.getMinutes(), bleib = Math.max(0, minuten || 0);
    const offen = zus.find(([a, b]) => a <= m && m < b);
    if (offen) {
      if (offen[2] === 'ohne') return { zustand: 'vage', text: 'an dem Tag geöffnet laut OSM, Uhrzeit nicht eingetragen' + zusatz };
      if (offen[1] - m > 8 * 1440) return { zustand: 'offen', text: 'durchgehend geöffnet' + zusatz };
      if (offen[2] === 'ab') return { zustand: 'vage', text: 'geöffnet ab ' + hhmm(offen[0]) + ', Ende offen' + zusatz };
      const bis = ohBis(offen[1], tagPlus);
      if (offen[2] === 'mind') return offen[1] >= m + bleib
        ? { zustand: 'offen', text: 'bei Ankunft geöffnet, mindestens bis ' + bis + zusatz }
        : { zustand: 'vage', text: 'geöffnet mindestens bis ' + bis + ', danach unklar' + zusatz };
      if (offen[1] < m + bleib) return { zustand: 'knapp', text: 'schließt um ' + bis + ', ' + (offen[1] - m) + ' min nach der Ankunft' + zusatz };
      return { zustand: 'offen', text: 'bei Ankunft geöffnet, bis ' + bis + zusatz };
    }
    const vorher = zus.filter(([, b]) => b <= m && b > 0).pop();
    if (vorher && vorher[2] === 'mind') return { zustand: 'vage', text: 'geöffnet mindestens bis ' + hhmm(vorher[1]) + ', danach unklar' + zusatz };
    const naechst = zus.find(([a]) => a > m);
    if (naechst && naechst[2] !== 'ohne' && naechst[0] - m <= 30) return { zustand: 'knapp', text: 'öffnet erst um ' + hhmm(naechst[0]) + zusatz };
    const amTag = naechst && naechst[0] < 1440 && naechst[2] !== 'ohne';
    return { zustand: 'zu', text: 'bei Ankunft geschlossen' + (amTag ? ', öffnet ' + hhmm(naechst[0]) : (!naechst || naechst[0] >= 8 * 1440) && oh.saison ? ' (außerhalb der Saison)' : ', an dem Tag nicht mehr') + zusatz };
  }

  // ---------- Reiseziele: Listen mit Orten, aus Dateien laden, als GPX weitergeben ----------
  const ZIEL_STICHWORTE = ['Berg', 'Stadt', 'Baden', 'Kind', 'Kultur', 'Essen', 'Rad', 'Winter'];
  const ZIEL_STAND = { idee: 'Idee', geplant: 'geplant', besucht: 'besucht' };
  function xmlText(s) {
    if (s == null) return '';
    s = String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    return s.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  }
  function xmlTag(inhalt, tag) { const m = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '>', 'i').exec(inhalt); return m ? xmlText(m[1]) : ''; }
  function zielOrt(lat, lon) { return typeof lat === 'number' && typeof lon === 'number' && isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0); }
  function zielLink(s) { s = String(s || '').trim(); return /^https?:\/\/\S+$/.test(s) ? s.slice(0, 500) : ''; }
  // Datei → { art, ziele: [{ name, lat, lon } oder { name, suche }, notiz, link] }; höchstens 300
  function zieleLesen(text, dateiname) {
    text = String(text || '').replace(/^﻿/, '');
    const name = String(dateiname || '').toLowerCase(), aus = [];
    const dazu = z => { if (aus.length < 300 && z.name) aus.push({ name: z.name.slice(0, 200), notiz: (z.notiz || '').slice(0, 2000), link: zielLink(z.link),
      ...(zielOrt(z.lat, z.lon) ? { lat: z.lat, lon: z.lon } : { suche: (z.suche || z.name).slice(0, 200) }) }); };
    const anfang = text.trimStart().slice(0, 400).toLowerCase();
    if (/\.gpx$/.test(name) || /<gpx[\s>]/.test(anfang)) {
      // auch selbstschließende <wpt … /> (sonst fräße der Ausdruck bis zum nächsten </wpt>)
      const re = /<wpt\b([^>]*?)(?:\/>|>([\s\S]*?)<\/wpt>)/gi;
      let m;
      while ((m = re.exec(text))) {
        const lat = parseFloat((/\blat="([^"]+)"/.exec(m[1]) || [])[1]), lon = parseFloat((/\blon="([^"]+)"/.exec(m[1]) || [])[1]);
        if (!zielOrt(lat, lon)) continue;
        const innen = m[2] || '';
        dazu({ name: xmlTag(innen, 'name') || 'Punkt', lat, lon, notiz: xmlTag(innen, 'desc') || xmlTag(innen, 'cmt'), link: (/<link\b[^>]*href="([^"]+)"/i.exec(innen) || [])[1] });
      }
      return { art: 'GPX', ziele: aus };
    }
    if (/\.kml$/.test(name) || /<kml[\s>]/.test(anfang)) {
      const re = /<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/gi;
      let m;
      while ((m = re.exec(text))) {
        const k = /<Point\b[\s\S]*?<coordinates>\s*([-\d.]+)\s*,\s*([-\d.]+)/i.exec(m[1]);
        if (!k) continue;
        const notiz = xmlTag(m[1], 'description');
        dazu({ name: xmlTag(m[1], 'name') || 'Ort', lat: +k[2], lon: +k[1], notiz, link: (/https?:\/\/[^\s"<]+/.exec(notiz) || [])[0] });
      }
      return { art: 'KML', ziele: aus };
    }
    if (/\.(geo)?json$/.test(name) || /^\s*\{/.test(text)) {
      let j;
      try { j = JSON.parse(text); } catch (e) { throw new Error('keine lesbare GeoJSON-Datei'); }
      const fs = j && j.type === 'FeatureCollection' ? j.features : j && j.type === 'Feature' ? [j] : null;
      if (!Array.isArray(fs)) throw new Error('keine GeoJSON-Datei (FeatureCollection mit Punkten)');
      for (const f of fs) {
        const g = f && f.geometry, p = (f && f.properties) || {};
        if (!g || g.type !== 'Point' || !Array.isArray(g.coordinates)) continue;
        dazu({ name: String(p.name || p.title || p.Name || 'Ort'), lat: +g.coordinates[1], lon: +g.coordinates[0], notiz: String(p.description || p.notiz || p.notes || ''), link: p.url || p.link || p.website });
      }
      return { art: 'GeoJSON', ziele: aus };
    }
    // Text oder CSV: eine Zeile je Ziel. Mit „;“ oder Tab getrennt: Name; Ort zum Suchen; Notiz; Link (oder eine Kopfzeile
    // mit name, ort, notiz, link, lat, lon). Ohne Trenner ist die ganze Zeile Name und Suchbegriff („Lindau, Bodensee“).
    const zeilen = text.split(/\r?\n/).map(z => z.trim()).filter(z => z && !z.startsWith('#'));
    if (!zeilen.length) return { art: 'Text', ziele: aus };
    // Komma nur mit Kopfzeile (Google Tabellen, Excel englisch), sonst bleibt „Lindau, Bodensee“ ein Suchbegriff
    const trenner = zeilen[0].includes('\t') ? '\t' : zeilen[0].includes(';') ? ';'
      : /^"?(name|titel|ziel)"?\s*,/i.test(zeilen[0]) ? ',' : null;
    // Felder in Anführungszeichen dürfen den Trenner enthalten: "Café; Bar";Lindau
    const ohneQ = x => x.trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"');
    const teile = z => {
      if (!trenner) return [ohneQ(z)];
      const out = [];
      let feld = '', inQ = false;
      for (let i = 0; i < z.length; i++) {
        const c = z[i];
        if (inQ) {
          if (c === '"' && z[i + 1] === '"') { feld += '"'; i++; }
          else if (c === '"') inQ = false;
          else feld += c;
        } else if (c === '"' && !feld.trim()) { inQ = true; feld = ''; }
        else if (c === trenner) { out.push(feld.trim()); feld = ''; }
        else feld += c;
      }
      // nicht geschlossenes Anführungszeichen: lieber einfach am Trenner teilen als die Spalten verlieren
      if (inQ) return z.split(trenner).map(ohneQ);
      out.push(feld.trim());
      return out;
    };
    let spalten = { name: 0, suche: 1, notiz: 2, link: 3, lat: -1, lon: -1 }, ab = 0;
    const kopf = teile(zeilen[0]).map(x => x.toLowerCase());
    if (trenner && kopf.some(x => /^(name|titel|ziel)$/.test(x))) {
      const finde = re => kopf.findIndex(x => re.test(x));
      spalten = { name: finde(/^(name|titel|ziel)$/), suche: finde(/^(ort|adresse|suche|wo)$/), notiz: finde(/^(notiz|beschreibung|notes?|description|kommentar)$/),
        link: finde(/^(link|url|webseite|website)$/), lat: finde(/^(lat|breite|latitude)$/), lon: finde(/^(lon|lng|länge|laenge|longitude)$/) };
      ab = 1;
    }
    for (const z of zeilen.slice(ab)) {
      const t = teile(z), w = i => (i >= 0 && t[i] != null ? t[i] : '');
      // Link in einer Zeile ohne Trenner: abtrennen
      let nm = w(spalten.name), link = w(spalten.link);
      if (!trenner) { const l = /\s(https?:\/\/\S+)$/.exec(nm); if (l) { link = l[1]; nm = nm.slice(0, l.index).trim(); } }
      dazu({ name: nm, suche: w(spalten.suche) || nm, notiz: w(spalten.notiz), link, lat: parseFloat(w(spalten.lat).replace(',', '.')), lon: parseFloat(w(spalten.lon).replace(',', '.')) });
    }
    return { art: trenner ? 'CSV' : 'Text', ziele: aus };
  }
  // gespeicherte Reiseziele prüfen (Speicher, Sicherung): { listen: [{ id, name }], ziele: [...] }
  function zielePruefen(d) {
    const text = (x, n) => (typeof x === 'string' ? x.slice(0, n) : '');
    const listen = (d && Array.isArray(d.listen) ? d.listen : []).map(l => ({ id: text(l && l.id, 64), name: text(l && l.name, 120) })).filter(l => l.id && l.name);
    const ids = new Set(listen.map(l => l.id));
    const ziele = (d && Array.isArray(d.ziele) ? d.ziele : []).filter(z => z && zielOrt(z.lat, z.lon) && ids.has(z.liste) && text(z.id, 64) && text(z.name, 200)).map(z => ({
      id: text(z.id, 64), liste: z.liste, name: text(z.name, 200), wo: text(z.wo, 200), lat: z.lat, lon: z.lon, notiz: text(z.notiz, 2000), link: zielLink(z.link),
      stich: Array.isArray(z.stich) ? z.stich.filter(s => ZIEL_STICHWORTE.includes(s)) : [], stand: ZIEL_STAND[z.stand] ? z.stand : 'idee',
      wikipedia: text(z.wikipedia, 300), wikidata: /^Q\d+$/.test(z.wikidata || '') ? z.wikidata : '', neu: text(z.neu, 40) }));
    return { listen, ziele };
  }
  // Liste als GPX-Wegpunkte (öffnet in anderen Karten-Apps, lädt hier wieder)
  function zieleGpx(name, ziele) {
    const z = ['<?xml version="1.0" encoding="UTF-8"?>', '<gpx version="1.1" creator="Gipfel und Gasse" xmlns="http://www.topografix.com/GPX/1/1">', '<metadata><name>' + esc(name) + '</name></metadata>'];
    for (const p of ziele) {
      z.push('<wpt lat="' + p.lat.toFixed(6) + '" lon="' + p.lon.toFixed(6) + '"><name>' + esc(p.name) + '</name>' + (p.notiz ? '<desc>' + esc(p.notiz) + '</desc>' : '') +
        (p.link ? '<link href="' + esc(p.link) + '"/>' : '') + '</wpt>');
    }
    z.push('</gpx>');
    return z.join('\n');
  }

  // ---------- Was ist hier? (Info beim Antippen der Karte) ----------
  // benannte Objekte im Umkreis, ohne Straßen, Grenzen, Routen, Flächennutzung, Gewässer und Orte (Dörfer kennt die Suche)
  function infoAbfrage(lat, lon, radius) {
    return '[out:json][timeout:12];nwr(around:' + Math.round(radius) + ',' + lat.toFixed(6) + ',' + lon.toFixed(6) + ')["name"][!"highway"][!"boundary"][!"route"]' +
      '[!"landuse"][!"waterway"][!"railway"][!"place"][!"power"];out center tags 40;';
  }
  const INFO_ART = {
    historic: { castle: 'Burg oder Schloss', monument: 'Denkmal', memorial: 'Gedenkstätte', ruins: 'Ruine', church: 'historische Kirche', monastery: 'Kloster', wayside_shrine: 'Bildstock', wayside_cross: 'Wegkreuz', archaeological_site: 'Ausgrabung', city_gate: 'Stadttor', tower: 'Turm' },
    tourism: { hotel: 'Hotel', guest_house: 'Pension', hostel: 'Herberge', camp_site: 'Campingplatz', zoo: 'Zoo', aquarium: 'Aquarium', theme_park: 'Freizeitpark', chalet: 'Ferienhaus' },
    amenity: { restaurant: 'Gasthaus', pub: 'Kneipe', bar: 'Bar', fast_food: 'Imbiss', pharmacy: 'Apotheke', theatre: 'Theater', cinema: 'Kino', library: 'Bücherei',
      townhall: 'Rathaus', marketplace: 'Markt', hospital: 'Krankenhaus', doctors: 'Arztpraxis', bank: 'Bank', post_office: 'Post', school: 'Schule', fuel: 'Tankstelle', planetarium: 'Planetarium' },
    leisure: { sports_centre: 'Sportanlage', water_park: 'Bad', swimming_pool: 'Schwimmbad', nature_reserve: 'Naturschutzgebiet', stadium: 'Stadion' },
    natural: { peak: 'Gipfel', saddle: 'Sattel', cave_entrance: 'Höhle', spring: 'Quelle', tree: 'Baum', rock: 'Fels', water: 'See' }
  };
  function infoArt(t) {
    const s = stadtArt(t);
    if (s !== 'Ort' && !(s === 'Denkmal' && INFO_ART.historic[t.historic])) return s;
    for (const k of ['historic', 'tourism', 'amenity', 'leisure', 'natural']) if (INFO_ART[k][t[k]]) return INFO_ART[k][t[k]];
    const o = ortArt(t);
    if (o !== 'Ort') return o;
    if (t.shop) return 'Geschäft';
    if (t.building || t['building:part']) return 'Gebäude';
    if (t.office) return 'Büro';
    return 'Ort';
  }
  // Treffer nach Nähe; was etwas zu erzählen hat (Wikipedia, Sehenswürdigkeit), rückt etwas vor. Mehrfache (online und
  // aus dem Kartenpaket) nur einmal. Höchstens 6.
  function infoLesen(listen, punkt) {
    const gesehen = new Map();
    for (const json of listen) for (const e of (json && json.elements) || []) {
      const t = e.tags || {}, lat = e.lat != null ? e.lat : e.center && e.center.lat, lon = e.lon != null ? e.lon : e.center && e.center.lon;
      if (lat == null || !t.name) continue;
      const id = e.type + '/' + e.id;
      if (gesehen.has(id) && Object.keys(gesehen.get(id).tags).length >= Object.keys(t).length) continue;
      const d = abstand(punkt, { lat, lon });
      const wert = d - (t.wikipedia || t.wikidata ? 15 : 0) - (t.tourism || t.historic ? 10 : 0) - (t.building && Object.keys(t).length < 4 ? -10 : 0);
      gesehen.set(id, { id, lat, lon, name: t.name, tags: t, art: infoArt(t), d, wert });
    }
    return [...gesehen.values()].sort((a, b) => a.wert - b.wert).slice(0, 6);
  }
  // Umkreis für das Antippen: etwa 30 Bildpunkte am Bildschirm, mindestens 15 m, höchstens 150 m
  function infoRadius(meterJePixel) { return Math.max(15, Math.min(150, Math.round(meterJePixel * 30))); }

  // ---------- Regenplan: drinnen in der Nähe ----------
  // Regen oder Gewitter erwartet: Wettercode Regen/Schauer/Gewitter oder Regenwahrscheinlichkeit ab 60 %
  function regenTag(code, wahrsch) { return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95 || (wahrsch != null && wahrsch >= 60); }
  const DRINNEN = [
    { k: 'museum', name: 'Museum', zeichen: '🖼️', test: t => t.tourism === 'museum' },
    { k: 'galerie', name: 'Galerie', zeichen: '🎨', test: t => t.tourism === 'gallery' },
    { k: 'aquarium', name: 'Aquarium', zeichen: '🐠', test: t => t.tourism === 'aquarium' },
    { k: 'planetarium', name: 'Planetarium', zeichen: '🔭', test: t => t.amenity === 'planetarium' },
    { k: 'theater', name: 'Theater', zeichen: '🎭', test: t => t.amenity === 'theatre' },
    { k: 'kino', name: 'Kino', zeichen: '🎬', test: t => t.amenity === 'cinema' },
    { k: 'bad', name: 'Hallenbad und Therme', zeichen: '🏊', test: t => t.leisure === 'water_park' || (t.leisure === 'sports_centre' && /swimming/.test(t.sport || '')) },
    { k: 'klettern', name: 'Kletterhalle', zeichen: '🧗', test: t => t.leisure === 'sports_centre' && /climbing/.test(t.sport || '') },
    { k: 'kirche', name: 'Kirche mit Wikipedia-Artikel', zeichen: '⛪', test: t => t.amenity === 'place_of_worship' && !!(t.wikipedia || t.wikidata) }
  ];
  function regenAbfrage(lat, lon, radius) {
    const um = '(around:' + Math.round(radius) + ',' + lat.toFixed(5) + ',' + lon.toFixed(5) + ')';
    const teile = ['nwr["tourism"~"^(museum|gallery|aquarium)$"]', 'nwr["amenity"~"^(planetarium|theatre|cinema)$"]', 'nwr["leisure"="water_park"]',
      'nwr["leisure"="sports_centre"]["sport"~"swimming|climbing"]', 'nwr["amenity"="place_of_worship"]["wikidata"]'];
    return '[out:json][timeout:25];(' + teile.map(t => t + um + ';').join('') + ');out center tags 150;';
  }
  function regenLesen(json, mitte) {
    const aus = [];
    for (const e of (json && json.elements) || []) {
      const t = e.tags || {}, lat = e.lat != null ? e.lat : e.center && e.center.lat, lon = e.lon != null ? e.lon : e.center && e.center.lon;
      if (lat == null || !t.name || t.access === 'private') continue;
      const kat = DRINNEN.find(k => k.test(t));
      if (!kat) continue;
      aus.push({ id: e.type + '/' + e.id, lat, lon, name: t.name, kat: kat.k, tags: t, d: abstand(mitte, { lat, lon }) });
    }
    return aus.sort((a, b) => a.d - b.d);
  }

  // Ort in Google Maps suchen (Öffnungszeiten, Bewertungen, Fotos stehen dort): Name mit Adresse aus OSM, sonst mit dem
  // Ortsnamen; ohne beides die Koordinaten (Google zeigt dann die Stelle). URL-Schnittstelle von Google (api=1).
  function googleSuche(name, t, ort, lat, lon) {
    t = t || {};
    const strasse = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
    const stadt = [t['addr:postcode'], t['addr:city'] || t['addr:place']].filter(Boolean).join(' ') || ort || '';
    const q = name && (strasse || stadt) ? [name, strasse, stadt].filter(Boolean).join(', ') : lat.toFixed(6) + ',' + lon.toFixed(6);
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  }
  // Anreise zum Start in Google Maps (URL-Schnittstelle von Google, öffnet am Telefon die App): Bus und Bahn oder Auto
  function anreiseLink(lat, lon, art) {
    return 'https://www.google.com/maps/dir/?api=1&destination=' + lat.toFixed(5) + ',' + lon.toFixed(5) + '&travelmode=' + (art === 'auto' ? 'driving' : 'transit');
  }

  // Parkplätze um einen Punkt: nur öffentliche (orteLesen kennt nur die), nach Abstand sortiert, mit Abstand in Metern
  function parkplaetze(orte, p) {
    return orte.filter(o => o.kat === 'parken').map(o => Object.assign({}, o, { weg: abstand(p, o) })).sort((a, b) => a.weg - b.weg);
  }
  // Kurzbeschreibung: Abstand, Gebühr, Plätze, Art (Wanderparkplatz, Parkhaus)
  function parkText(o) {
    const t = o.tags || {}, z = [(o.weg < 1000 ? Math.round(o.weg / 10) * 10 + ' m' : kmText(o.weg)) + ' vom Start'];
    if (t.fee === 'yes') z.push('gebührenpflichtig'); else if (t.fee === 'no') z.push('kostenlos');
    if (t.capacity && /^\d+$/.test(t.capacity)) z.push(t.capacity + ' Plätze');
    if (t.parking === 'multi-storey') z.push('Parkhaus'); else if (t.parking === 'underground') z.push('Tiefgarage');
    if (t.hiking === 'yes' || /wanderpark/i.test(t.name || '')) z.push('Wanderparkplatz');
    return z.join(' · ');
  }

  // Fehlermeldung eines Dienstes: kurz und verständlich statt einer HTML- oder Textseite des Servers
  function dienstFehler(status, text) {
    const t = String(text || '');
    if (status === 429) return 'zu viele Anfragen, bitte kurz warten';
    if (status >= 500 || /at capacity|too busy|timeout/i.test(t)) {
      return 'Dienst gerade überlastet' + (/capacity|busy/i.test(t) ? ' (alle Server belegt)' : '') + ', bitte in ein paar Minuten noch einmal';
    }
    if (/^\s*</.test(t)) return 'Fehler ' + status;
    return t.slice(0, 160) || 'Fehler ' + status;
  }
  // Umkreis um einen Punkt als Rechteck in Web-Mercator-Metern (EPSG:3857), wie Waymarked Trails es erwartet
  function bbox3857(lat, lon, radius) {
    const R0 = 6378137, x = l => R0 * l * Math.PI / 180, y = b => R0 * Math.log(Math.tan(Math.PI / 4 + b * Math.PI / 360));
    const dLat = radius / 111320, dLon = radius / (111320 * Math.cos(lat * Math.PI / 180));
    return [x(lon - dLon), y(lat - dLat), x(lon + dLon), y(lat + dLat)].map(v => Math.round(v));
  }
  // Antwort von Waymarked Trails (list/by_area) im Format von wegeLesen; group: INT, NAT, REG, LOC
  function wegeAusWmt(json, mitte) {
    const netz = g => (/^int/i.test(g || '') ? 'international' : /^nat/i.test(g || '') ? 'Fernwanderweg' : /^reg/i.test(g || '') ? 'regional' : /^loc/i.test(g || '') ? 'örtlich' : '');
    const out = [];
    for (const r of (json && json.results) || []) {
      if (r.type && r.type !== 'relation') continue;
      const name = r.name || (r.ref ? 'Weg ' + r.ref : '');
      if (!name || !Number.isInteger(r.id)) continue;
      out.push({ id: r.id, name, ref: r.ref || '', netz: netz(r.group), rund: false, km: null, betreiber: '', abstand: null });
    }
    const rang = w => (w.netz === 'Fernwanderweg' || w.netz === 'international' ? 1 : 0);
    return out.sort((a, b) => rang(a) - rang(b));
  }

  // ---------- Markierte Wanderwege (OSM-Routen route=hiking/foot) ----------
  // erst die Wege im Umkreis, dann die Routen, zu denen sie gehören: viel schneller als Routen direkt im Umkreis zu suchen
  // (das berechnet den ganzen Verlauf jeder Route, in den Bergen über das Zeitlimit von Overpass, Befund 04.11. am Walchensee)
  function wegeAbfrage(lat, lon, radius) {
    return '[out:json][timeout:25];way["highway"](around:' + radius + ',' + lat.toFixed(5) + ',' + lon.toFixed(5) + ');rel(bw)["route"~"^(hiking|foot)$"];out tags 80;';
  }
  const WEG_NETZ = { iwn: 'international', nwn: 'Fernwanderweg', rwn: 'regional', lwn: 'örtlich' };
  // Liste: Name (sonst Nummer oder Start–Ziel), Netz, Rundweg, Länge laut OSM, Abstand der Mitte; nach Abstand sortiert
  function wegeLesen(json, mitte) {
    const out = [];
    for (const el of (json && json.elements) || []) {
      if (el.type !== 'relation' || !el.tags) continue;
      const t = el.tags;
      const name = t.name || t['name:de'] || (t.ref ? 'Weg ' + t.ref : '') || (t.from && t.to ? t.from + ' – ' + t.to : '');
      if (!name) continue;
      const km = parseFloat(String(t.distance || '').replace(',', '.'));
      out.push({ id: el.id, name, ref: t.ref || '', netz: WEG_NETZ[t.network] || '', rund: t.roundtrip === 'yes',
        km: isFinite(km) && km > 0 ? km : null, betreiber: t.operator || '',
        abstand: el.center && mitte ? abstand(mitte, { lat: el.center.lat, lon: el.center.lon }) : null });
    }
    // Fernwege zuletzt (sie laufen durch, sind aber selten das Ziel eines Tages), sonst nach Abstand
    const rang = w => (w.netz === 'Fernwanderweg' || w.netz === 'international' ? 1 : 0);
    return out.sort((a, b) => rang(a) - rang(b) || (a.abstand || 0) - (b.abstand || 0));
  }
  function wegText(w) {
    const z = [];
    if (w.km) z.push(String(w.km).replace('.', ',') + ' km');
    if (w.rund) z.push('Rundweg');
    if (w.netz) z.push(w.netz);
    if (w.ref && !w.name.includes(w.ref)) z.push('Nr. ' + w.ref);
    if (w.abstand != null) z.push((w.abstand < 1000 ? Math.round(w.abstand / 50) * 50 + ' m' : kmText(w.abstand)) + ' entfernt');
    return z.join(' · ');
  }
  // Verlauf einer Route aus `out geom`: die Wege der Relation der Reihe nach aneinanderhängen (umdrehen, wenn das Ende
  // näher liegt); passt ein Stück nirgends an (unter 80 m), beginnt es einen neuen Abschnitt (luecke)
  function wegVerlauf(json) {
    const rel = ((json && json.elements) || []).find(e => e.type === 'relation' && Array.isArray(e.members));
    if (!rel) return [];
    const stuecke = rel.members.filter(m => m.type === 'way' && Array.isArray(m.geometry) && m.geometry.length > 1 && !/^(alternative|excursion|approach|connection)$/.test(m.role || ''))
      .map(m => m.geometry.map(g => ({ lat: g.lat, lon: g.lon })));
    if (!stuecke.length) return [];
    const pts = stuecke.shift().slice();
    while (stuecke.length) {
      const ende = pts[pts.length - 1];
      let best = -1, umdrehen = false, d = Infinity;
      stuecke.forEach((st, i) => {
        const a = abstand(ende, st[0]), b = abstand(ende, st[st.length - 1]);
        if (a < d) { d = a; best = i; umdrehen = false; }
        if (b < d) { d = b; best = i; umdrehen = true; }
      });
      // erstes Stück verkehrt herum? (sein Anfang hängt am zweiten)
      if (pts.length && stuecke.length && best >= 0 && d > 80) {
        const anf = pts[0], st = stuecke[best];
        if (Math.min(abstand(anf, st[0]), abstand(anf, st[st.length - 1])) < 80) { pts.reverse(); continue; }
      }
      const st = stuecke.splice(best, 1)[0];
      const teil = umdrehen ? st.slice().reverse() : st.slice();
      if (d < 1) teil.shift();
      else if (d > 80) teil[0] = Object.assign({}, teil[0], { luecke: true });
      for (const q of teil) pts.push(q);
    }
    return pts;
  }

  // ---------- Orte und Suche ohne Netz (Datei orte.json.gz im Kartenpaket, gebaut von karten/orte.py) ----------
  // Eintrag [lat, lon, "n123", Merkmale] → Element wie in der Antwort von Overpass (für orteLesen und stadtLesen)
  function ortElement(e) {
    return { type: { n: 'node', w: 'way', r: 'relation' }[e[2][0]] || 'node', id: +e[2].slice(1), lat: e[0], lon: e[1], tags: e[3] };
  }

  // ---------- Gipfelbuch: erreichte Gipfel aus gegangenen Touren ----------
  // Overpass: benannte Gipfel im Umkreis der Spur. Die Spur wird auf 100 m ausgedünnt; der Radius muss die Lücke plus die
  // 50 m für „erreicht“ abdecken, sonst fehlt der Gipfel am Umkehrpunkt (er liegt zwischen zwei behaltenen Punkten)
  const GIPFEL_RADIUS = 160;
  function gipfelAbfrage(pts) {
    const ll = ausduennen(pts, 100).map(p => p.lat.toFixed(5) + ',' + p.lon.toFixed(5)).join(',');
    return '[out:json][timeout:25];node["natural"="peak"]["name"](around:' + GIPFEL_RADIUS + ',' + ll + ');out 200;';
  }
  // erreicht = die Spur kommt bis auf `radius` Meter an den Gipfel (GPS und Kartenpunkt liegen oft 10–30 m auseinander)
  function gipfelErreicht(spur, elemente, radius) {
    radius = radius || 50;
    const aus = [], ids = new Set();
    for (const e of elemente || []) {
      const t = e.tags || {}, lat = e.lat != null ? e.lat : e.center && e.center.lat, lon = e.lon != null ? e.lon : e.center && e.center.lon;
      if (t.natural !== 'peak' || !t.name || lat == null || lon == null || ids.has(e.id)) continue;
      if (abstandZurLinie(spur, lat, lon) > radius) continue;
      ids.add(e.id);
      const ele = parseFloat(String(t.ele || '').replace(',', '.'));
      aus.push({ id: ({ way: 'w', relation: 'r' }[e.type] || 'n') + e.id, name: String(t.name).slice(0, 120), ele: isFinite(ele) ? Math.round(ele) : null, lat: +lat.toFixed(5), lon: +lon.toFixed(5) });
    }
    return aus;
  }
  // Gipfel einer Tour ins Buch: je Gipfel die Besuche (Tour und Tag), derselbe Besuch nicht doppelt. Liefert die neuen Gipfel.
  function gipfelbuchDazu(buch, gefunden, besuch) {
    const neu = [];
    for (const g of gefunden) {
      let e = buch.gipfel[g.id];
      if (!e) { e = buch.gipfel[g.id] = { name: g.name, ele: g.ele, lat: g.lat, lon: g.lon, besuche: [] }; neu.push(g); }
      if (!e.besuche.some(b => gipfelBesuchGleich(b, besuch))) e.besuche.push({ datum: besuch.datum, tour: besuch.tour, name: besuch.name });
      e.besuche.sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
    }
    return neu;
  }
  // Fotos vom Gipfel: aus der Fotoliste (fotoListe) die Bilder einer Tour, mit der der Gipfel besucht wurde, deren Ort
  // (R.fotoOrt: aus dem Foto, sonst Zeitpunkt auf der Spur, sonst Ort des Eintrags) höchstens radius Meter vom Gipfel liegt
  function gipfelFotos(g, liste, eintraege, radius) {
    const touren = new Set(g.besuche.map(b => b.tour).filter(Boolean));
    return liste.filter(x => {
      if (!x.tour || !touren.has(x.tour.id)) return false;
      const e = eintraege.get(x.eintrag);
      const o = fotoOrt(e && e.fotoInfo && e.fotoInfo[x.foto], e, x.tour.spur);
      return !!o && abstand(o, { lat: g.lat, lon: g.lon }) <= (radius || 150);
    });
  }
  function gipfelBesuchGleich(a, b) { return a.tour === b.tour && (a.tour !== '' || a.datum === b.datum); }
  // Gipfelbuch aus Speicher oder Sicherung prüfen: nur bekannte Felder, Kennungen n/w/r<Zahl>, nur Gipfel mit gültigem
  // Besuch (ein Gipfel ohne Besuch hätte die Seite angehalten). geprueft: Touren, die schon durchsucht sind
  function gipfelbuchPruefen(roh) {
    const buch = { gipfel: {}, geprueft: [] };
    if (roh && Array.isArray(roh.geprueft)) buch.geprueft = roh.geprueft.filter(x => typeof x === 'string' && x.length <= 64).slice(-5000);
    const g = roh && typeof roh === 'object' ? roh.gipfel : null;
    if (!g || typeof g !== 'object' || Array.isArray(g)) return buch;
    for (const [id, e] of Object.entries(g)) {
      if (!/^[nwr]\d{1,15}$/.test(id) || !e || typeof e.name !== 'string' || !zielOrt(e.lat, e.lon)) continue;
      const besuche = (Array.isArray(e.besuche) ? e.besuche : []).filter(b => b && typeof b.datum === 'string' && !isNaN(Date.parse(b.datum)))
        .slice(0, 500).map(b => ({ datum: b.datum.slice(0, 40), tour: typeof b.tour === 'string' ? b.tour.slice(0, 64) : '', name: typeof b.name === 'string' ? b.name.slice(0, 120) : '' }));
      if (!besuche.length) continue;
      buch.gipfel[id] = { name: e.name.slice(0, 120), ele: typeof e.ele === 'number' && isFinite(e.ele) ? Math.round(e.ele) : null, lat: e.lat, lon: e.lon, besuche };
    }
    return buch;
  }
  // Übersicht: Gipfel nach dem letzten Besuch (neueste zuerst), Kennzahlen
  function gipfelbuchListe(buch) {
    const liste = Object.entries(buch.gipfel).map(([id, e]) => Object.assign({ id }, e, { zuletzt: e.besuche.length ? e.besuche[e.besuche.length - 1].datum : '' }))
      .sort((a, b) => String(b.zuletzt).localeCompare(String(a.zuletzt)));
    const mitHoehe = liste.filter(g => g.ele != null);
    const hoechster = mitHoehe.length ? mitHoehe.reduce((a, b) => (b.ele > a.ele ? b : a)) : null;
    return { liste, anzahl: liste.length, besuche: liste.reduce((s, g) => s + g.besuche.length, 0), hoechster };
  }

  // Abstand eines Punkts zur Linie durch pts in Metern (kürzester Abstand zu einem ihrer Abschnitte)
  function abstandZurLinie(pts, lat, lon) {
    const kx = Math.cos(lat * RAD) * 111320, ky = 110540;
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const ax = (pts[i].lon - lon) * kx, ay = (pts[i].lat - lat) * ky;
      if (i === pts.length - 1) { if (pts.length === 1) best = Math.hypot(ax, ay); break; }
      if (pts[i + 1].luecke) { best = Math.min(best, Math.hypot(ax, ay)); continue; }
      const bx = (pts[i + 1].lon - lon) * kx, by = (pts[i + 1].lat - lat) * ky;
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0;
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
    return best;
  }

  // Umgebung der Strecke: [süd, west, nord, ost] um `radius` Meter erweitert
  function streckenRahmen(pts, radius) {
    let s = 90, w = 180, n = -90, o = -180;
    for (const p of pts) { s = Math.min(s, p.lat); n = Math.max(n, p.lat); w = Math.min(w, p.lon); o = Math.max(o, p.lon); }
    const db = radius / 110540, dl = radius / (111320 * Math.cos(((s + n) / 2) * RAD));
    return [s - db, w - dl, n + db, o + dl];
  }

  // Orte im Umkreis von `radius` Metern um die Strecke (oder um einen Punkt), wie die Overpass-Abfrage „around“:
  // gemessen zu den Abschnitten der Strecke (auf 50 m vereinfacht), nicht nur zu ihren Punkten
  function orteUmkreis(orte, pts, radius, max) {
    const linie = ausduennen(pts, 50), r = streckenRahmen(pts, radius);
    const out = [];
    for (const e of orte) {
      if (e[0] < r[0] || e[0] > r[2] || e[1] < r[1] || e[1] > r[3]) continue;
      if (abstandZurLinie(linie, e[0], e[1]) <= radius) out.push(ortElement(e));
      if (out.length >= (max || 1500)) break;
    }
    return { elements: out };
  }

  // Orte in einem Ausschnitt [süd, west, nord, ost], wie die Stadt-Abfrage
  function orteAusschnitt(orte, bbox, max) {
    const out = [];
    for (const e of orte) {
      if (e[0] < bbox[0] || e[0] > bbox[2] || e[1] < bbox[1] || e[1] > bbox[3]) continue;
      out.push(ortElement(e));
      if (out.length >= (max || 2000)) break;
    }
    return { elements: out };
  }

  // Schreibweise für den Vergleich: klein, ohne Akzente, ß = ss, nur Buchstaben und Ziffern
  function suchNorm(t) {
    return String(t).toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  // Suche in [Name, lat, lon, Art, bei Ort, Rang]: jedes Wort der Anfrage muss ein Wort des Namens (oder des Orts)
  // beginnen, oder die Anfrage steckt im Namen. Reihenfolge: Rang, genauer Treffer, Nähe zur Kartenmitte.
  function sucheOffline(liste, text, nahe, n) {
    const q = suchNorm(text);
    if (q.length < 2) return [];
    const woerter = q.split(' ');
    const treffer = [];
    for (const e of liste) {
      if (e.n === undefined) { e.n = suchNorm(e[0]); e.w = suchNorm(e[4] || ''); }
      const namenW = e.n.split(' '), alle = e.w ? namenW.concat(e.w.split(' ')) : namenW;
      const passt = woerter.every(w => alle.some(x => x.startsWith(w))) || (q.length >= 4 && e.n.includes(q));
      if (!passt) continue;
      let punkte = e[5];
      if (e.n === q) punkte += 40;
      else if (e.n.startsWith(q)) punkte += 25;
      else if (woerter.every(w => namenW.some(x => x.startsWith(w)))) punkte += 10;
      if (nahe) {
        const km = abstand({ lat: e[1], lon: e[2] }, { lat: nahe.lat, lon: nahe.lng != null ? nahe.lng : nahe.lon }) / 1000;
        punkte -= Math.min(45, 12 * Math.log2(1 + km / 3));
      }
      treffer.push([punkte, e]);
    }
    treffer.sort((a, b) => b[0] - a[0]);
    return treffer.slice(0, n || 7).map(([, e]) => ({ name: e[0], wo: [e[3], e[4]].filter(Boolean).join(' · '), lat: e[1], lon: e[2], offline: true }));
  }

  // Orte in eine kurze Reihenfolge bringen; der Start bleibt vorn. rund = true: die Runde endet am Start,
  // sonst ist es ein offener Weg ohne Rückweg. Nächster Nachbar, dann 2-opt (Teilstücke umdrehen, solange es
  // kürzer wird). Luftlinie genügt dafür.
  function wegOrdnen(start, orte, rund) {
    const pts = [start].concat(orte), n = pts.length;
    if (n <= 2) return orte.slice();
    const D = pts.map(a => pts.map(b => abstand(a, b)));
    const weg = [0], frei = new Set(pts.map((_, i) => i).slice(1));
    while (frei.size) {
      const letzt = weg[weg.length - 1];
      let best = null;
      for (const i of frei) if (best == null || D[letzt][i] < D[letzt][best]) best = i;
      weg.push(best); frei.delete(best);
    }
    if (rund) weg.push(0);
    const kante = (a, b) => (b < weg.length ? D[weg[a]][weg[b]] : 0);   // offener Weg: hinter dem Ende keine Kante
    const ende = rund ? weg.length - 1 : weg.length;
    let besser = true, runden = 0;
    while (besser && runden++ < 50) {
      besser = false;
      for (let i = 1; i < ende - 1; i++) {
        for (let j = i + 1; j < ende; j++) {
          const vorher = D[weg[i - 1]][weg[i]] + kante(j, j + 1);
          const nachher = D[weg[i - 1]][weg[j]] + (j + 1 < weg.length ? D[weg[i]][weg[j + 1]] : 0);
          if (nachher < vorher - 0.01) { weg.splice(i, j - i + 1, ...weg.slice(i, j + 1).reverse()); besser = true; }
        }
      }
    }
    return weg.slice(1, rund ? -1 : undefined).map(i => pts[i]);
  }
  function wegLaenge(start, orte, rund) {
    const r = [start].concat(orte, rund ? [start] : []);
    let m = 0;
    for (let i = 1; i < r.length; i++) m += abstand(r[i - 1], r[i]);
    return m;
  }
  const rundgangOrdnen = (start, orte) => wegOrdnen(start, orte, true);
  const rundgangLaenge = (start, orte) => wegLaenge(start, orte, true);
  // geschätzte Dauer eines Rundgangs in Minuten: kurze Reihenfolge, Luftlinie mal 1,3 (Umwege in der Stadt) bei 4 km/h,
  // plus Besichtigungszeit der Orte (Feld min)
  function rundgangMinuten(start, orte) {
    const reihe = rundgangOrdnen(start, orte);
    return rundgangLaenge(start, reihe) * 1.3 / 4000 * 60 + reihe.reduce((s, o) => s + (+o.min || 0), 0);
  }

  // ---------- Höhendaten (Terrarium-Kacheln aus dem Offline-Paket) ----------
  // Terrarium: Höhe = R·256 + G + B/256 − 32768 Meter
  function terrarium(r, g, b) { return r * 256 + g + b / 256 - 32768; }

  // RGBA-Pixel (Uint8ClampedArray, 4 Werte je Pixel) → Höhen in Metern
  function terrariumGitter(rgba) {
    const n = rgba.length / 4, h = new Float32Array(n);
    for (let i = 0; i < n; i++) h[i] = terrarium(rgba[4 * i], rgba[4 * i + 1], rgba[4 * i + 2]);
    return h;
  }

  // Bodenmeter je Pixel einer 256er-Kachel auf Zoomstufe z bei Breite lat
  function meterJePixel(z, lat) { return 40075016.686 * Math.cos(lat * RAD) / (256 * Math.pow(2, z)); }

  // Höhengitter (256 + 2 Pixel Rand)² für Kartenkachel x/y auf Zoom z aus Quellkacheln der Stufe s (s ≤ z), bilinear.
  // kachel(tx, ty) liefert die 256×256-Höhen einer Quellkachel oder null; der Rand kommt aus den Nachbarkacheln,
  // damit Schummerung und Höhenlinien an Kachelgrenzen nahtlos sind. Fehlt eine Nachbarkachel, wird am Rand gehalten.
  function randGitter(kachel, x, y, z, s) {
    const f = Math.pow(2, z - s), N = 258, out = new Float32Array(N * N);
    const tx0 = Math.floor(x / f), ty0 = Math.floor(y / f);
    const wert = (gx, gy) => {
      let tx = Math.floor(gx / 256), ty = Math.floor(gy / 256), t = kachel(tx, ty);
      if (!t) { tx = tx0; ty = ty0; t = kachel(tx, ty); gx = Math.min(tx * 256 + 255, Math.max(tx * 256, gx)); gy = Math.min(ty * 256 + 255, Math.max(ty * 256, gy)); }
      return t ? t[(gy - ty * 256) * 256 + (gx - tx * 256)] : 0;
    };
    for (let j = 0; j < N; j++) {
      const sy = (y * 256 + j - 1 + 0.5) / f - 0.5, y0 = Math.floor(sy), ty = sy - y0;
      for (let i = 0; i < N; i++) {
        const sx = (x * 256 + i - 1 + 0.5) / f - 0.5, x0 = Math.floor(sx), tx = sx - x0;
        out[j * N + i] = (wert(x0, y0) * (1 - tx) + wert(x0 + 1, y0) * tx) * (1 - ty) + (wert(x0, y0 + 1) * (1 - tx) + wert(x0 + 1, y0 + 1) * tx) * ty;
      }
    }
    return out;
  }

  // Ausschnitt (ox, oy, Kantenlänge groesse in Pixeln) eines g×g-Gitters bilinear auf w×w vergrößern
  function aufziehen(gitter, g, ox, oy, groesse, w) {
    const out = new Float32Array(w * w), f = groesse / w;
    for (let y = 0; y < w; y++) {
      const sy = Math.min(g - 1, Math.max(0, oy + (y + 0.5) * f - 0.5)), y0 = Math.floor(sy), y1 = Math.min(g - 1, y0 + 1), ty = sy - y0;
      for (let x = 0; x < w; x++) {
        const sx = Math.min(g - 1, Math.max(0, ox + (x + 0.5) * f - 0.5)), x0 = Math.floor(sx), x1 = Math.min(g - 1, x0 + 1), tx = sx - x0;
        out[y * w + x] = (gitter[y0 * g + x0] * (1 - tx) + gitter[y0 * g + x1] * tx) * (1 - ty) + (gitter[y1 * g + x0] * (1 - tx) + gitter[y1 * g + x1] * tx) * ty;
      }
    }
    return out;
  }

  // Textwinkel so drehen, dass Schrift nie auf dem Kopf steht (Ergebnis zwischen −90° und +90°)
  function lesbarerWinkel(w) {
    while (w > Math.PI / 2) w -= Math.PI;
    while (w <= -Math.PI / 2) w += Math.PI;
    return w;
  }

  // welche Quellkacheln (Stufe s) randGitter für Kachel x/y auf Zoom z braucht
  function randKacheln(x, y, z, s) {
    const f = Math.pow(2, z - s), lo = v => Math.floor(Math.floor((v * 256 - 1 + 0.5) / f - 0.5) / 256), hi = v => Math.floor((Math.floor((v * 256 + 256 + 0.5) / f - 0.5) + 1) / 256);
    const out = [];
    for (let ty = lo(y); ty <= hi(y); ty++) for (let tx = lo(x); tx <= hi(x); tx++) out.push([tx, ty]);
    return out;
  }

  // Schummerung nach Horn: Licht aus Nordwest (315°) und 45° Höhe. Ergebnis 0 (Schatten) … 1 (voll beleuchtet).
  function schummerung(h, w, hoehe, mpp, ueberhoehung) {
    const out = new Float32Array(w * hoehe), k = (ueberhoehung || 1.5) / (8 * mpp);
    // Lichtrichtung 315° (Kompass) ist in mathematischer Zählung 360 − 315 + 90 = 135°
    const az = 135 * RAD, zen = 45 * RAD;
    const at = (x, y) => h[Math.min(hoehe - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
    for (let y = 0; y < hoehe; y++) {
      for (let x = 0; x < w; x++) {
        const a = at(x - 1, y - 1), b = at(x, y - 1), c = at(x + 1, y - 1), d = at(x - 1, y), f = at(x + 1, y), g = at(x - 1, y + 1), i = at(x, y + 1), j = at(x + 1, y + 1);
        const dzdx = ((c + 2 * f + j) - (a + 2 * d + g)) * k;
        const dzdy = ((g + 2 * i + j) - (a + 2 * b + c)) * k;
        const neigung = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy));
        const richtung = Math.atan2(dzdy, -dzdx);
        const v = Math.cos(zen) * Math.cos(neigung) + Math.sin(zen) * Math.sin(neigung) * Math.cos(az - richtung);
        out[y * w + x] = Math.max(0, Math.min(1, v));
      }
    }
    return out;
  }

  // Hangneigung in Grad je Pixel (Horn wie die Schummerung, ohne Überhöhung). h: Höhengitter w×hoehe, mpp: Meter je Pixel
  function hangneigung(h, w, hoehe, mpp) {
    const out = new Float32Array(w * hoehe), k = 1 / (8 * mpp);
    const at = (x, y) => h[Math.min(hoehe - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
    for (let y = 0; y < hoehe; y++) {
      for (let x = 0; x < w; x++) {
        const a = at(x - 1, y - 1), b = at(x, y - 1), c = at(x + 1, y - 1), d = at(x - 1, y), f = at(x + 1, y), g = at(x - 1, y + 1), i = at(x, y + 1), j = at(x + 1, y + 1);
        const dzdx = ((c + 2 * f + j) - (a + 2 * d + g)) * k, dzdy = ((g + 2 * i + j) - (a + 2 * b + c)) * k;
        out[y * w + x] = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) / RAD;
      }
    }
    return out;
  }
  // Farbstufen wie in Hangneigungskarten für Skitouren (swisstopo, Alpenverein): ab 30° gelb, 35° orange, 40° rot,
  // 45° violett; darunter durchsichtig
  const HANG_STUFEN = [[45, [150, 40, 170]], [40, [225, 30, 30]], [35, [245, 140, 0]], [30, [235, 215, 0]]];
  function hangFarbe(grad) { for (const [g, f] of HANG_STUFEN) if (grad >= g) return f; return null; }

  // Warteschlange für höchstens max gleichzeitige Aufgaben. Ein frei werdender Platz geht direkt an die nächste wartende
  // Aufgabe; vorher zählte frei() erst herunter, und in der Lücke bis zum Aufwachen konnte sich eine neue Anfrage
  // dazwischendrängen (dann liefen vier statt drei)
  function warteschlange(max) {
    let aktiv = 0;
    const warten = [];
    return {
      platz() { if (aktiv < max) { aktiv++; return Promise.resolve(); } return new Promise(r => warten.push(r)); },
      frei() { const n = warten.shift(); if (n) n(); else aktiv = Math.max(0, aktiv - 1); },
      get aktiv() { return aktiv; }, get wartend() { return warten.length; }
    };
  }

  // Abstand der Höhenlinien je Zoomstufe: [Abstand, jede wievielte ist eine Zähllinie]
  function linienAbstand(z) {
    if (z >= 14) return [20, 5];
    if (z >= 12) return [50, 5];
    if (z >= 11) return [100, 5];
    return [200, 5];
  }

  // Höhenlinien mit Marching Squares: Liste von Strichen [x1, y1, x2, y2, höhe] in Pixeln des Gitters
  function hoehenlinien(h, w, hoehe, abstand) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < h.length; i++) { if (h[i] < lo) lo = h[i]; if (h[i] > hi) hi = h[i]; }
    const out = [];
    if (!isFinite(lo) || hi - lo < 1e-6) return out;
    for (let stufe = Math.ceil(lo / abstand) * abstand; stufe <= hi; stufe += abstand) {
      for (let y = 0; y < hoehe - 1; y++) {
        for (let x = 0; x < w - 1; x++) {
          const a = h[y * w + x], b = h[y * w + x + 1], c = h[(y + 1) * w + x + 1], d = h[(y + 1) * w + x];
          const fall = (a >= stufe ? 8 : 0) | (b >= stufe ? 4 : 0) | (c >= stufe ? 2 : 0) | (d >= stufe ? 1 : 0);
          if (fall === 0 || fall === 15) continue;
          const t = (p, q) => (stufe - p) / (q - p);
          const oben = [x + t(a, b), y], rechts = [x + 1, y + t(b, c)], unten = [x + t(d, c), y + 1], links = [x, y + t(a, d)];
          const strich = (p, q) => out.push([p[0], p[1], q[0], q[1], stufe]);
          switch (fall) {
            case 1: case 14: strich(links, unten); break;
            case 2: case 13: strich(unten, rechts); break;
            case 3: case 12: strich(links, rechts); break;
            case 4: case 11: strich(oben, rechts); break;
            case 6: case 9: strich(oben, unten); break;
            case 7: case 8: strich(links, oben); break;
            case 5: strich(links, oben); strich(unten, rechts); break;
            case 10: strich(oben, rechts); strich(links, unten); break;
          }
        }
      }
    }
    return out;
  }

  // Kachel und Pixel für einen Punkt (Web-Mercator)
  function kachelPixel(lat, lon, z) {
    const n = Math.pow(2, z), x = (lon + 180) / 360 * n;
    const r = lat * RAD, y = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n;
    return { x: Math.floor(x), y: Math.floor(y), px: (x - Math.floor(x)) * 256, py: (y - Math.floor(y)) * 256 };
  }

  return {
    abstand, laengen, hoehenmeter, hoehenmeterSpur, gehzeit, fahrzeit, laufzeit, zeitFuer, paceText, kmAnsage, autoPause, rundkursPunkte, versatz, zeitText, kmText, tagsLesen, SAC, wegtyp, untergrund, anteile, maxSteigung,
    kinderwagen, schwierigkeit, brouterLesen, linie, auswerten, aufStrecke, rest, ausduennen, gpxSchreiben, gpxLesen, gpxQuelle, gpxProfil, gpxPunktArt, gpxDauer,
    hinweisText, routenKachel, richtung, abbiegeBefehl, linkSchreiben, linkLesen, ORTE, ortArt, overpassAbfrage, orteLesen, wetterText, esc,
    FAMILIE, familieHalbzeit, STADT, stadtAbfrage, stadtLesen, stadtArt, wikiLink, sonnenuntergang, uhr, zeitplan, gradMinSek, notfallText, abseitsText, gewitterTage, sicherungLesen, gewitterAb, statistik, sicherungTagebuch, tagIso, tagebuchTage, tourZeit, reiseTouren, fotoListe, reiseHeute, tagebuchPruefen, heftSkizze, spurTeile, ortElement, orteUmkreis, orteAusschnitt, abstandZurLinie, streckenRahmen, suchNorm, sucheOffline, rundgangOrdnen, rundgangLaenge, rundgangMinuten, parkplaetze, parkText, wegeAbfrage, wegeLesen, wegText, wegVerlauf, dienstFehler, bbox3857, wegeAusWmt, crc32, zipTeile, zipLesen, bildArt, exifLesen, fotoOrt, packliste, packWetter, wegOrdnen, wegLaenge,
    terrarium, terrariumGitter, meterJePixel, randGitter, randKacheln, aufziehen, lesbarerWinkel, schummerung, warteschlange, hangneigung, hangFarbe, HANG_STUFEN, linienAbstand, hoehenlinien, kachelPixel,
    wikiQuelle, wikiAusWikidata, wikiKurz, oeffnungLesen, oeffnungJetzt, oeffnungBesuch, zeitBis, zeitZwischen, infoPruefen, ohStand, ohDatum, googleOrtLink, tourWetterUrl, wetterStunde, tourWetterText, stoppInfo, fuehrungText, etappen, etappeAusschnitt, telAdresse, bescheidText, ankunftText, tourCheck, notsignalAn, tagesAufteilung, tageVorschlag, tageWahl, unterkunftAbfrage, unterkunftWahl, gipfelAbfrage, gipfelErreicht, gipfelbuchDazu, gipfelbuchPruefen, gipfelbuchListe, gipfelBesuchGleich, gipfelFotos, GIPFEL_RADIUS, regenTag, DRINNEN, regenAbfrage, regenLesen, anreiseLink,
    infoAbfrage, infoArt, infoLesen, infoRadius,
    ZIEL_STICHWORTE, ZIEL_STAND, zieleLesen, zielePruefen, zieleGpx, googleSuche
  };
})();
if (typeof module !== 'undefined') module.exports = R;
