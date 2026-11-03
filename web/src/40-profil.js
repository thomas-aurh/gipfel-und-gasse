// Farben der gewählten Darstellung (hell oder dunkel) aus den CSS-Variablen
function farbe(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#68736b'; }
// Höhenprofil: Fläche nach Steigung gefärbt, Zeigen und Tippen markiert die Stelle auf der Karte
const profilMarke = L.circleMarker([0, 0], { radius: 7, color: '#fff', weight: 3, fillColor: '#1f2a22', fillOpacity: 1, interactive: false });
let profilGeo = null;   // Maße der letzten Zeichnung, für das Zeigen

function steigungsFarbe(g) {
  const a = Math.abs(g);
  if (a < 6) return '#8fc79a';
  if (a < 12) return '#f2cf5b';
  if (a < 20) return '#f0913c';
  return '#d64532';
}

function profilZeichnen(markeD) {
  const c = $('profil'), e = S.ergebnis;
  const box = $('profilbox');
  if (!e || !e.pts.some(p => p.ele != null)) { box.hidden = true; profilGeo = null; return; }
  box.hidden = false;
  const dpr = window.devicePixelRatio || 1;
  const w = c.clientWidth || 360, h = c.clientHeight || 140;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const pts = e.pts.filter(p => p.ele != null);
  let lo = Infinity, hi = -Infinity;   // Schleife statt Math.min(...): große Aufzeichnungen sprengen sonst den Stapel
  for (const p of pts) { if (p.ele < lo) lo = p.ele; if (p.ele > hi) hi = p.ele; }
  const spanne = Math.max(50, hi - lo), unten = Math.floor((lo - spanne * 0.08) / 10) * 10, oben = Math.ceil((hi + spanne * 0.12) / 10) * 10;
  const L0 = 38, R0 = 6, T0 = 6, B0 = 18, bw = w - L0 - R0, bh = h - T0 - B0;
  const gesamt = e.laenge || 1;
  const X = d => L0 + d / gesamt * bw, Y = v => T0 + bh - (v - unten) / (oben - unten) * bh;
  profilGeo = { L0, bw, gesamt };

  // Gitter und Beschriftung
  g.font = '10px sans-serif'; g.fillStyle = farbe('--grau'); g.strokeStyle = farbe('--spur'); g.lineWidth = 1;
  const stufe = [10, 20, 50, 100, 200, 250, 500, 1000].find(s => (oben - unten) / s <= 4) || 1000;
  for (let v = Math.ceil(unten / stufe) * stufe; v <= oben; v += stufe) {
    g.beginPath(); g.moveTo(L0, Y(v)); g.lineTo(w - R0, Y(v)); g.stroke();
    g.textAlign = 'right'; g.fillText(v + ' m', L0 - 4, Y(v) + 3);
  }
  const km = gesamt / 1000, kmStufe = [0.5, 1, 2, 5, 10, 20, 50, 100].find(s => km / s <= 6) || 100;
  g.textAlign = 'center';
  for (let k = 0; k <= km + 1e-9; k += kmStufe) g.fillText(String(Math.round(k * 10) / 10).replace('.', ',') + (k === 0 ? '' : ' km'), Math.min(X(k * 1000), w - 16), h - 4);

  // Fläche in Stücken von etwa 2 px, gefärbt nach Steigung
  for (let i = 0, j = 0; i < pts.length - 1; i = j) {
    j = i + 1;
    while (j < pts.length - 1 && X(pts[j].d) - X(pts[i].d) < 2) j++;
    const dd = pts[j].d - pts[i].d;
    const stg = dd > 0 ? (pts[j].ele - pts[i].ele) / dd * 100 : 0;
    g.fillStyle = steigungsFarbe(stg);
    g.beginPath();
    g.moveTo(X(pts[i].d), Y(unten));
    for (let k = i; k <= j; k++) g.lineTo(X(pts[k].d), Y(pts[k].ele));
    g.lineTo(X(pts[j].d), Y(unten));
    g.closePath(); g.fill();
  }
  g.strokeStyle = farbe('--text'); g.lineWidth = 1.5; g.beginPath();
  pts.forEach((p, i) => i ? g.lineTo(X(p.d), Y(p.ele)) : g.moveTo(X(p.d), Y(p.ele)));
  g.stroke();

  // Wegpunkte als kleine Striche
  g.fillStyle = '#e5532d';
  (e.stueckEnde || []).forEach(d => g.fillRect(X(d) - 1, T0, 2, 6));

  if (markeD != null) {
    const p = punktBei(markeD);
    g.strokeStyle = farbe('--text'); g.lineWidth = 1;
    g.beginPath(); g.moveTo(X(markeD), T0); g.lineTo(X(markeD), T0 + bh); g.stroke();
    if (p && p.ele != null) { g.fillStyle = farbe('--text'); g.beginPath(); g.arc(X(markeD), Y(p.ele), 4, 0, 7); g.fill(); }
  }
}

// Punkt bei Meter d, zwischen den Nachbarn eingerechnet
function punktBei(d) {
  const pts = S.ergebnis && S.ergebnis.pts;
  if (!pts || !pts.length) return null;
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].d < d) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi], t = b.d > a.d ? Math.max(0, Math.min(1, (d - a.d) / (b.d - a.d))) : 0;
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t, ele: a.ele != null && b.ele != null ? a.ele + (b.ele - a.ele) * t : (a.ele != null ? a.ele : b.ele), a, b };
}

function profilZeigen(ev) {
  if (!profilGeo) return;
  const r = $('profil').getBoundingClientRect();
  const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
  const d = Math.max(0, Math.min(profilGeo.gesamt, (x - profilGeo.L0) / profilGeo.bw * profilGeo.gesamt));
  const p = punktBei(d);
  if (!p) return;
  profilMarke.setLatLng([p.lat, p.lon]).addTo(karte);
  // Steigung über ±50 m
  const v = punktBei(Math.max(0, d - 50)), n = punktBei(Math.min(profilGeo.gesamt, d + 50));
  const strecke = Math.min(profilGeo.gesamt, d + 50) - Math.max(0, d - 50);
  const stg = v && n && v.ele != null && n.ele != null && strecke > 0 ? Math.round((n.ele - v.ele) / strecke * 100) : null;
  $('profilinfo').textContent = 'bei ' + R.kmText(d) + (p.ele != null ? ' · ' + Math.round(p.ele) + ' m Höhe' : '') + (stg != null ? ' · Steigung ' + stg + ' %' : '');
  profilZeichnen(d);
}

function profilWeg() {
  profilMarke.remove();
  $('profilinfo').textContent = 'Über das Profil fahren zeigt die Stelle auf der Karte.';
  profilZeichnen();
}

$('profil').addEventListener('pointermove', profilZeigen);
$('profil').addEventListener('pointerdown', profilZeigen);
$('profil').addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') profilWeg(); });
// Doppeltipp: Karte zur Stelle schieben
$('profil').addEventListener('dblclick', ev => {
  if (!profilGeo) return;
  const r = $('profil').getBoundingClientRect();
  const p = punktBei(Math.max(0, (ev.clientX - r.left - profilGeo.L0) / profilGeo.bw * profilGeo.gesamt));
  if (p) karte.setView([p.lat, p.lon], Math.max(karte.getZoom(), 15));
});
window.addEventListener('resize', () => profilZeichnen());
