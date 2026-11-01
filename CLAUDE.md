# gipfel-und-gasse

Tourenplaner von Thomas für Berg und Stadt (Web-App plus Android-App). Öffentliches Repo: nichts Persönliches, keine
Geheimnisse, keine Schlüssel. Antworten auf Deutsch.

- Beim Start einer Session zuerst `STAND.md` lesen (offen, Entscheidungen, Auslieferung, erledigt).
- Änderungen nur über einen Branch `claude/<zweck>` und einen Pull Request; gemergt wird nur mit grüner Prüfung
  (`.github/workflows/app.yml`), gebunden an den geprüften Commit.
- Prüfen lokal: `sh web/pruefen.sh` und `node web/test/ui.js` (Klicktest, Dienste nachgebildet). Android-SDK und die
  Kartendienste sind in der Cloud-Umgebung gesperrt: Android baut und testet GitHub Actions.
- Session-Abschluss: `STAND.md` und README nachziehen (wie der Skill `projekt-abschluss` in other-projects).
