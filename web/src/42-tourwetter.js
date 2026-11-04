// Wetter für die Tour: Start, höchster Punkt und Ziel (je Tag bei Etappen), jeweils für die Stunde, in der man dort ist.
// Eine Anfrage an Open-Meteo, mit Höhe der Punkte (die Vorhersage gilt dann für diese Höhe, nicht für das Raster).
let tourWetterNr = 0, tourWetterFuer = '';
// zuletzt geladene Vorhersage zusammengefasst (für die Packliste), gilt für tourWetterFuer
const TOURWETTER = { fuer: '', wetter: null };
// gezeigte Vorhersage gilt für diese Route, diesen Tag und diese Startzeit; ändert sich etwas, ist sie weg (neu laden)
const tourWetterSchluessel = () => (S.ergebnis ? S.ergebnis.laenge.toFixed(0) + '|' + S.ergebnis.pts.length + '|' + S.ergebnis.zeit.toFixed(3) : '') + '|' + artAktuell() + '|' + JSON.stringify(S.wps.map(w => [w.lat, w.lon, w.nacht ? 1 : 0, w.min || 0])) + '|' + $('startTag').value + '|' + $('startZeit').value + '|' + (S.tagesStart || []).join(',') + '|' + $('pausewahl').value + '|' + tempoAktuell();
function tourWetterPruefen() {
  if (tourWetterSchluessel() === tourWetterFuer) return;
  tourWetterNr++; tourWetterFuer = ''; $('tourWetter').innerHTML = '';
}

// Punkte und Zeiten: Startzeit aus dem Zeitplan; ohne sie 9 Uhr am geplanten Tag, ohne Tag ab der nächsten vollen Stunde
function tourWetterPunkte() {
  const e = S.ergebnis;
  if (!e || e.pts.length < 2) return { punkte: [], ohneStart: false };
  const jetzt = new Date();
  const tag = $('startTag').value ? new Date($('startTag').value + 'T12:00') : jetzt;
  const [h, m] = $('startZeit').value ? $('startZeit').value.split(':').map(Number) : $('startTag').value ? [9, 0] : [jetzt.getHours() + 1, 0];
  const et = etappenAktuell() || [{ von: 0, bis: S.wps.length - 1, vonD: 0, bisD: e.laenge, zeit: e.zeit }];
  const pause = (+$('pausewahl').value || 0) / 60;
  const punkte = [];
  et.forEach((s, k) => {
    const [hk, mk] = k && S.tagesStart && S.tagesStart[k] ? S.tagesStart[k].split(':').map(Number) : [h, m];
    const start = new Date(tag.getFullYear(), tag.getMonth(), tag.getDate() + k, hk, mk);
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
      // Besichtigungen der Stopps davor (und am Start an Tag 1) verschieben die Ankunft am höchsten Punkt
      let vorher = 0;
      if (!S.fest && e.stueckEnde) for (let i = k === 0 ? 0 : s.von + 1; i <= s.bis; i++) if (i === 0 || e.stueckEnde[i - 1] <= hi.d) vorher += +S.wps[i].min || 0;
      punkte.push({ name: tagName + 'Höchster Punkt (' + Math.round(hi.ele) + ' m)', lat: hi.lat, lon: hi.lon, ele: hi.ele, t: start.getTime() + (t + vorher / 60 + (s.zeit ? pause * t / s.zeit : 0)) * 3600e3 });
    }
    punkte.push({ name: tagName + (k < et.length - 1 ? 'Übernachtung' : 'Ziel'), lat: z.lat, lon: z.lon, ele: z.ele, t: start.getTime() + dauer * 3600e3 });
  });
  return { punkte, ohneStart: !$('startZeit').value };
}

// ---------- Packliste: aus Tourart, Länge, Höhe, Tagen und dem geladenen Wetter; Abhaken je Tour, eigene Dinge für alle ----------
function packDaten() {
  const e = S.ergebnis;
  if (!e) return null;
  const et = etappenAktuell();
  const pause = (+$('pausewahl').value || 0) / 60;
  const stunden = (et ? Math.max(...et.map(x => x.zeit)) : e.zeit + besichtigung() / 60) + pause;
  return { profil: S.profil, stunden, auf: e.auf, ab: e.ab, hoch: e.hoch, tage: et ? et.length : 1, kind: tempoAktuell() <= 0.7 && artAktuell() === 'fuss',
    dunkel: $('zeitplan').classList.contains('warnung') && /knapp/.test($('zeitplan').textContent),
    wetter: TOURWETTER.fuer && TOURWETTER.fuer === tourWetterSchluessel() ? TOURWETTER.wetter : null };
}
const packSchluessel = () => 'pack.' + (S.tourId || 'neu');
function packlisteZeigen(box) {
  const d = packDaten();
  box.innerHTML = '';
  if (!d) { box.textContent = 'Erst eine Route planen.'; return; }
  const l = R.packliste(d), hak = SPEICHER.lesen(packSchluessel(), {}) || {};
  const eigene = (SPEICHER.lesen('packEigene', []) || []).filter(x => typeof x === 'string');
  if (eigene.length) l.gruppen.push({ name: 'Eigenes', dinge: eigene.map((was, i) => ({ id: 'eigen:' + was, was, warum: '', weg: i })) });
  let alle = 0, fertig = 0;
  for (const gr of l.gruppen) {
    const h = document.createElement('h4'); h.textContent = gr.name; box.appendChild(h);
    for (const x of gr.dinge) {
      alle++; if (hak[x.id]) fertig++;
      const lab = document.createElement('label');
      lab.className = hak[x.id] ? 'erledigt' : '';
      const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!hak[x.id]; c.dataset.id = x.id;
      c.onchange = () => { const m = SPEICHER.lesen(packSchluessel(), {}) || {}; if (c.checked) m[x.id] = 1; else delete m[x.id]; SPEICHER.schreiben(packSchluessel(), m); packlisteNeu(); };
      const sp = document.createElement('span');
      sp.innerHTML = R.esc(x.was) + (x.warum ? '<small>' + R.esc(x.warum) + '</small>' : '');
      lab.append(c, sp);
      if (x.weg != null) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'mini'; b.textContent = '✕'; b.title = 'Aus „Eigenes“ entfernen';
        b.onclick = ev => { ev.preventDefault(); const l2 = (SPEICHER.lesen('packEigene', []) || []).filter(v => v !== x.was); SPEICHER.schreiben('packEigene', l2); packlisteNeu(); };
        lab.appendChild(b);
      }
      box.appendChild(lab);
    }
  }
  const kopf = document.createElement('p'); kopf.className = 'klein pack-stand';
  kopf.textContent = fertig + ' von ' + alle + ' eingepackt.' + (l.hinweise.length ? ' ' + l.hinweise.join(' ') : '');
  box.prepend(kopf);
  const f = document.createElement('form'); f.className = 'pack-eigen';
  f.innerHTML = '<input type="text" maxlength="80" placeholder="Eigenes dazu, z. B. Fernglas" aria-label="Eigenes Ding für die Packliste"><button class="knopf" type="submit">＋</button>' +
    '<button class="knopf" type="button" data-leeren>Haken weg</button>';
  f.onsubmit = ev => {
    ev.preventDefault();
    const v = f.querySelector('input').value.trim();
    if (!v) return;
    const l2 = (SPEICHER.lesen('packEigene', []) || []).filter(x => x !== v).concat([v]).slice(-40);
    SPEICHER.schreiben('packEigene', l2); packlisteNeu();
  };
  f.querySelector('[data-leeren]').onclick = () => { SPEICHER.schreiben(packSchluessel(), {}); packlisteNeu(); };
  box.appendChild(f);
}
// offene Packlisten neu zeichnen (Haken, Wetter, andere Tour)
function packlisteNeu() { document.querySelectorAll('.pack-box .pack:not([hidden])').forEach(packlisteZeigen); }
document.querySelectorAll('[data-pack]').forEach(b => {
  b.onclick = () => {
    const box = b.parentElement.querySelector('.pack');
    box.hidden = !box.hidden;
    b.setAttribute('aria-expanded', String(!box.hidden));
    if (!box.hidden) packlisteZeigen(box);
  };
});

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
    TOURWETTER.fuer = tourWetterFuer;
    TOURWETTER.wetter = R.packWetter(punkte.map((p, i) => R.wetterStunde(j[i], p.t)));
    packlisteNeu();
    const zeilen = punkte.map((p, i) => {
      const w = R.tourWetterText(R.wetterStunde(j[i], p.t), p.t < Date.now() - 3600e3);
      w.warn.forEach(x => warn.add(x));
      return '<div class="tw-zeile' + (w.warn.length ? ' warn' : '') + '"><b>' + R.esc(p.name) + '</b> · ' + R.esc(new Date(p.t).toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit' })) +
        ' Uhr<br><span class="klein">' + R.esc(w.text) + (w.warn.length ? ' · ⚠️ ' + R.esc(w.warn.join(', ')) : '') + '</span></div>';
    });
    box.innerHTML = (warn.size ? '<div class="warnung">⚠️ ' + R.esc([...warn].join(', ')) + ' auf der Tour: Zeiten prüfen, Grate und Gipfel dann meiden.</div>' : '') + zeilen.join('') +
      '<p class="klein">' + R.esc((ohneStart ? ($('startTag').value ? 'Ohne Startzeit ab 9 Uhr gerechnet. ' : 'Ohne Tag und Startzeit ab der nächsten vollen Stunde gerechnet. ') : '') + 'Open-Meteo, umgerechnet auf die Höhe der Punkte; Zeiten nach der Gehzeit ohne Puffer.') + '</p>';
  } catch (err) {
    if (nr === tourWetterNr) box.textContent = 'Wetter nicht erreichbar: ' + err.message;
  }
};
