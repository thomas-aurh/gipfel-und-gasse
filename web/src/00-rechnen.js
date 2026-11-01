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
    let best = 0, j = 0;
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].ele == null) continue;
      while (j < pts.length && (pts[j].d - pts[i].d < fenster || pts[j].ele == null)) j++;
      if (j >= pts.length) break;
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
    const eles = pts.map(p => p.ele);
    const hm = hoehenmeter(eles);
    const gueltig = eles.filter(e => e != null);
    const steigung = maxSteigung(pts);
    return {
      pts, abschnitte, laenge, stueckEnde, hinweise,
      auf: hm.auf, ab: hm.ab,
      hoch: gueltig.length ? Math.round(Math.max(...gueltig)) : null,
      tief: gueltig.length ? Math.round(Math.min(...gueltig)) : null,
      zeit: art === 'rad' ? fahrzeit(laenge, hm.auf, tempo) : gehzeit(laenge, hm.auf, hm.ab, tempo),
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
        if (b.d < von || a.d > bis) continue;
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
    const eles = [];
    let i = 0;
    while (i < pts.length && pts[i].d < d) i++;
    // Höhe genau an der aktuellen Stelle, zwischen den Nachbarpunkten eingerechnet
    if (i > 0 && i < pts.length && pts[i - 1].ele != null && pts[i].ele != null && pts[i].d > pts[i - 1].d) {
      const t = (d - pts[i - 1].d) / (pts[i].d - pts[i - 1].d);
      eles.push(pts[i - 1].ele + (pts[i].ele - pts[i - 1].ele) * t);
    }
    for (; i < pts.length; i++) eles.push(pts[i].ele);
    const ges = pts.length ? pts[pts.length - 1].d : 0;
    const hm = hoehenmeter(eles);
    const m = Math.max(0, ges - d);
    return { meter: m, auf: hm.auf, ab: hm.ab, zeit: art === 'rad' ? fahrzeit(m, hm.auf, tempo) : gehzeit(m, hm.auf, hm.ab, tempo) };
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
        out.push({ lat, lon, ele: e ? parseFloat(e[1]) : null, name: n ? unesc(n[1].trim()) : null, t: t ? Date.parse(t[1]) : null });
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
    const kopf = /<(?:metadata|trk|rte)\b[^>]*>[\s\S]*?<name>([\s\S]*?)<\/name>/.exec(text);
    if (!pts.length && !wpt.length) throw new Error('In der Datei steht keine Spur und keine Route.');
    return { name: kopf ? unesc(kopf[1].trim()) : null, pts, wpt };
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
    const a = Math.abs(x), g = Math.floor(a), m = Math.floor((a - g) * 60), s = ((a - g) * 60 - m) * 60;
    return g + '° ' + m + '′ ' + s.toFixed(1).replace('.', ',') + '″ ' + (x >= 0 ? pos : neg);
  }
  // Text zum Vorlesen und Senden: Dezimalgrad (für Leitstellen und Karten-Apps), Grad/Minuten/Sekunden, Höhe, Genauigkeit
  function notfallText(p) {
    const dez = p.lat.toFixed(5) + ', ' + p.lon.toFixed(5);
    return 'Mein Standort: ' + dez + ' (' + gradMinSek(p.lat, 'N', 'S') + ', ' + gradMinSek(p.lon, 'O', 'W') + ')' +
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
    let d;
    try { d = JSON.parse(text); } catch (e) { throw new Error('keine Sicherung von Gipfel & Gasse (kein JSON)'); }
    if (!d || d.app !== 'gipfel-und-gasse' || !Array.isArray(d.touren)) throw new Error('keine Sicherung von Gipfel & Gasse');
    return d.touren.map(tourPruefen).filter(Boolean);
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
        wps.push(w.length > 2 ? [w[0], w[1], text(w[2], 120) || '', Math.max(0, zahl(w[3]) || 0)] : [w[0], w[1]]);
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
    if (['wandern', 'stadt', 'rad', 'kurz', 'linie'].includes(t.profil)) out.profil = t.profil;
    if (t.modus === 'berg' || t.modus === 'stadt') out.modus = t.modus;
    if (zahl(t.tempo) != null && t.tempo > 0 && t.tempo < 3) out.tempo = t.tempo;
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

  // ---------- Orte und Suche ohne Netz (Datei orte.json.gz im Kartenpaket, gebaut von karten/orte.py) ----------
  // Eintrag [lat, lon, "n123", Merkmale] → Element wie in der Antwort von Overpass (für orteLesen und stadtLesen)
  function ortElement(e) {
    return { type: { n: 'node', w: 'way', r: 'relation' }[e[2][0]] || 'node', id: +e[2].slice(1), lat: e[0], lon: e[1], tags: e[3] };
  }

  // Abstand eines Punkts zur Linie durch pts in Metern (kürzester Abstand zu einem ihrer Abschnitte)
  function abstandZurLinie(pts, lat, lon) {
    const kx = Math.cos(lat * RAD) * 111320, ky = 110540;
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const ax = (pts[i].lon - lon) * kx, ay = (pts[i].lat - lat) * ky;
      if (i === pts.length - 1) { if (pts.length === 1) best = Math.hypot(ax, ay); break; }
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
    abstand, laengen, hoehenmeter, gehzeit, fahrzeit, zeitText, kmText, tagsLesen, SAC, wegtyp, untergrund, anteile, maxSteigung,
    kinderwagen, schwierigkeit, brouterLesen, linie, auswerten, aufStrecke, rest, ausduennen, gpxSchreiben, gpxLesen,
    hinweisText, routenKachel, richtung, abbiegeBefehl, linkSchreiben, linkLesen, ORTE, ortArt, overpassAbfrage, orteLesen, wetterText, esc,
    STADT, stadtAbfrage, stadtLesen, stadtArt, wikiLink, sonnenuntergang, uhr, zeitplan, gradMinSek, notfallText, abseitsText, gewitterTage, sicherungLesen, ortElement, orteUmkreis, orteAusschnitt, abstandZurLinie, streckenRahmen, suchNorm, sucheOffline, rundgangOrdnen, rundgangLaenge, wegOrdnen, wegLaenge,
    terrarium, terrariumGitter, meterJePixel, randGitter, randKacheln, aufziehen, lesbarerWinkel, schummerung, linienAbstand, hoehenlinien, kachelPixel
  };
})();
if (typeof module !== 'undefined') module.exports = R;
