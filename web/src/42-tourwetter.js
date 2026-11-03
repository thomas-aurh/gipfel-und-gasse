// Wetter für die Tour: Start, höchster Punkt und Ziel (je Tag bei Etappen), jeweils für die Stunde, in der man dort ist.
// Eine Anfrage an Open-Meteo, mit Höhe der Punkte (die Vorhersage gilt dann für diese Höhe, nicht für das Raster).
let tourWetterNr = 0, tourWetterFuer = '';
// gezeigte Vorhersage gilt für diese Route, diesen Tag und diese Startzeit; ändert sich etwas, ist sie weg (neu laden)
const tourWetterSchluessel = () => (S.ergebnis ? S.ergebnis.laenge.toFixed(0) + '|' + S.ergebnis.pts.length : '') + '|' + JSON.stringify(S.wps.map(w => [w.lat, w.lon, w.nacht ? 1 : 0, w.min || 0])) + '|' + $('startTag').value + '|' + $('startZeit').value + '|' + $('pausewahl').value + '|' + tempoAktuell();
function tourWetterPruefen() {
  if (tourWetterSchluessel() === tourWetterFuer) return;
  tourWetterNr++; tourWetterFuer = ''; $('tourWetter').innerHTML = '';
}

// Punkte und Zeiten: Startzeit aus dem Zeitplan (sonst 9 Uhr), am Tag des Zeitplans (sonst heute)
function tourWetterPunkte() {
  const e = S.ergebnis;
  if (!e || e.pts.length < 2) return { punkte: [], ohneStart: false };
  const tag = $('startTag').value ? new Date($('startTag').value + 'T12:00') : new Date();
  const [h, m] = ($('startZeit').value || '09:00').split(':').map(Number);
  const et = etappenAktuell() || [{ von: 0, bis: S.wps.length - 1, vonD: 0, bisD: e.laenge, zeit: e.zeit }];
  const pause = (+$('pausewahl').value || 0) / 60;
  const punkte = [];
  et.forEach((s, k) => {
    const start = new Date(tag.getFullYear(), tag.getMonth(), tag.getDate() + k, h, m);
    const teil = e.pts.filter(p => p.d >= s.vonD - 0.01 && p.d <= s.bisD + 0.01);
    if (teil.length < 2) return;
    const a = teil[0], z = teil[teil.length - 1];
    let besicht = 0;
    if (!S.fest) for (let i = k === 0 ? 0 : s.von + 1; i <= s.bis; i++) besicht += +S.wps[i].min || 0;
    const dauer = s.zeit + besicht / 60 + pause;
    const tagName = et.length > 1 ? 'Tag ' + (k + 1) + ': ' : '';
    punkte.push({ name: tagName + 'Start', lat: a.lat, lon: a.lon, ele: a.ele, t: start.getTime() });
    // höchster Punkt nur, wenn er sich vom Anfang und Ende abhebt (sonst ist es eine Stadt- oder Talrunde)
    let hi = null;
    for (const p of teil) if (p.ele != null && (!hi || p.ele > hi.ele)) hi = p;
    const rand = Math.max(a.ele == null ? -Infinity : a.ele, z.ele == null ? -Infinity : z.ele);
    if (hi && hi.ele - rand >= 100) {
      const t = R.zeitZwischen(e.pts, s.vonD, hi.d, tempoAktuell(), artAktuell());
      punkte.push({ name: tagName + 'Höchster Punkt (' + Math.round(hi.ele) + ' m)', lat: hi.lat, lon: hi.lon, ele: hi.ele, t: start.getTime() + (t + (s.zeit ? pause * t / s.zeit : 0)) * 3600e3 });
    }
    punkte.push({ name: tagName + (k < et.length - 1 ? 'Übernachtung' : 'Ziel'), lat: z.lat, lon: z.lon, ele: z.ele, t: start.getTime() + dauer * 3600e3 });
  });
  return { punkte, ohneStart: !$('startZeit').value };
}

$('bTourWetter').onclick = async () => {
  const { punkte, ohneStart } = tourWetterPunkte();
  const box = $('tourWetter');
  if (!punkte.length) { box.textContent = 'Erst eine Route planen.'; return; }
  const nr = ++tourWetterNr;
  tourWetterFuer = tourWetterSchluessel();
  box.textContent = 'Wetter wird geladen …';
  try {
    let j = await holen(R.tourWetterUrl(punkte), null, 20);
    if (nr !== tourWetterNr) return;
    if (!Array.isArray(j)) j = [j];   // ein Punkt: Open-Meteo antwortet ohne Liste
    const warn = new Set();
    const zeilen = punkte.map((p, i) => {
      const w = R.tourWetterText(R.wetterStunde(j[i], p.t));
      w.warn.forEach(x => warn.add(x));
      return '<div class="tw-zeile' + (w.warn.length ? ' warn' : '') + '"><b>' + R.esc(p.name) + '</b> · ' + R.esc(new Date(p.t).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })) +
        ' Uhr<br><span class="klein">' + R.esc(w.text) + (w.warn.length ? ' · ⚠️ ' + R.esc(w.warn.join(', ')) : '') + '</span></div>';
    });
    box.innerHTML = (warn.size ? '<div class="warnung">⚠️ ' + R.esc([...warn].join(', ')) + ' auf der Tour: Zeiten prüfen, Grate und Gipfel dann meiden.</div>' : '') + zeilen.join('') +
      '<p class="klein">' + R.esc((ohneStart ? 'Ohne Startzeit ab 9 Uhr gerechnet. ' : '') + 'Open-Meteo, umgerechnet auf die Höhe der Punkte; Zeiten nach der Gehzeit ohne Puffer.') + '</p>';
  } catch (err) {
    if (nr === tourWetterNr) box.textContent = 'Wetter nicht erreichbar: ' + err.message;
  }
};
