# gipfel-und-gasse

Tourenplaner von Thomas für Berg und Stadt (Web-App plus Android-App). Öffentliches Repo: nichts Persönliches, keine
Geheimnisse, keine Schlüssel. Antworten auf Deutsch.

- Beim Start einer Session zuerst `STAND.md` lesen (offen, Entscheidungen, Auslieferung, erledigt).
- Nur dieses Projekt: Vault `second-brain`, Börse und andere Repos haben hier nichts verloren, auch wenn ein Vault
  geladen ist; deren offene Punkte, Termine und Nachtbefunde weder melden noch abarbeiten (Thomas, 03.11.).
- Änderungen nur über einen Branch `claude/<zweck>` und einen Pull Request; gemergt wird nur mit grüner Prüfung
  (`.github/workflows/app.yml`), gebunden an den geprüften Commit.
- Prüfen lokal: `sh web/pruefen.sh` und `node web/test/ui.js` (Klicktest, Dienste nachgebildet; läuft auch in GitHub
  Actions als Pflicht). Android-SDK und die Kartendienste sind in der Cloud-Umgebung gesperrt: Android baut und testet
  GitHub Actions.
- Session-Abschluss: Skill `projekt-abschluss` (`.claude/skills/`), nicht der globale `session-abschluss`. Pläne
  vorher stress-testen: Skill `grill-me`.
