---
name: projekt-abschluss
description: Session-Abschluss für Gipfel & Gasse. Nutze das, wenn in einer Session an der Web-App oder der Android-App gearbeitet wurde und Thomas sinngemäß „Abschluss machen“, „Stand festhalten“, „schreib den Stand weg“ oder „Session abschließen“ sagt. Alles landet in diesem Repo (STAND.md, README), nicht im Vault second-brain, nicht im Börsen-Dashboard und nicht in other-projects. Der globale Skill session-abschluss gilt hier nicht.
---

# Projekt-Abschluss (Gipfel & Gasse)

Ziel: Am Ende einer Session sagt das Repo selbst, was die App kann, was offen ist und warum sie so gebaut ist.
Kurz, aktueller Stand, ein Ort je Sache. Das Repo ist **öffentlich**: nichts Persönliches, keine Geheimnisse.

## 0. Arbeitsplatz

- Am PC der Klon `C:\src\gipfel-und-gasse`, in der Cloud der Klon der Session. Arbeit auf einem eigenen Branch
  `claude/<zweck>` von `origin/main`, nie direkt auf `main`.
- Vorher `git fetch --prune` und `git status --short --branch`: liegt fremde Arbeit im Baum, nichts anfassen und Thomas fragen.
- Vor dem ersten Push `git ls-remote --heads origin claude/<zweck>`: der Branchname muss frei sein.

## 1. Gelerntes der Session suchen

Das ganze Gespräch absuchen, nicht nur nach Signalwörtern:

1. **Thomas' Korrekturen und Regeln**: „immer …“, „ab jetzt …“, „schon wieder …“, auch eine Anweisung mitten in einem
   Auftrag, die über diese Session hinaus gelten soll.
2. **Eigene Fallen**: falsch gemessen, zu früh behauptet, am falschen Ort gesucht. Lehre ist die Art des Fehlers, die
   wiederkommen kann, nicht der Hergang.

Je Fund prüfen, ob er schon steht. Wenn nicht: Regel für jede Session → `CLAUDE.md` (nur mit Thomas' Ja), Bau- oder
Gerätefalle → STAND.md „Entscheidungen“ bzw. `web/README.md`. Ein Einzelfall ohne Wiederholung ist keine Lehre.

## 2. Prüfen

- `sh web/pruefen.sh` und `node web/test/ui.js`. Rot ⇒ erst beheben.
- Hat sich etwas geändert, das man sieht: im Browser durchklicken (lokaler Testserver auf 127.0.0.1, nicht `file://`),
  hell und dunkel, Handybreite.
- Android baut und testet nur GitHub Actions (`.github/workflows/app.yml`). Was nur auf dem Gerät prüfbar ist (GPS,
  Ansagen bei gesperrtem Bildschirm, Kamera, Erlaubnisse), kommt in STAND.md unter „Offen“ als „nicht geprüft“, mit Grund.

## 3. STAND.md

Datei: [`STAND.md`](../../../STAND.md); dazu [`README.md`](../../../README.md) und [`web/README.md`](../../../web/README.md).

| Abschnitt | Was hinein |
|---|---|
| **Offen** | nicht Geprüftes, nicht Gebautes, was auf Thomas wartet (z. B. Test auf dem Pixel). Erledigtes **streichen**, nicht abhaken. |
| **Entscheidungen** | eine Zeile je Entscheidung: was, warum, was verworfen wurde, Datum. Alte Entscheidung ersetzen, nicht doppeln. |
| **Auslieferung** | Download-Seite der APK, Release `kartenpakete`, Web-App; wie sie entstehen. |
| **Erledigt** | neuer Block **oben**: Datum, was, PR-Nummer. Höchstens rund 10 Zeilen je Session. |

Regeln: Aktueller Stand statt Geschichte, die Geschichte steht in Git. Keine Zahl an zwei Orten. Ein Zustand
(„läuft“, „auf dem Pixel bestätigt“) nur, wenn er gemessen oder von Thomas gemeldet ist, mit Datum.

## 4. README

README und `web/README.md` nachziehen, wenn sich Bedienung, Funktionen, Aufbau oder Bau geändert haben. Die
Installationsanleitung muss zur aktuellen Download-Seite passen.

## 5. Git und Pull Request

1. Alles der Session auf einem Branch, ein Pull Request nach `main`. Body höchstens fünf Zeilen: was, warum, geprüft.
2. Check-Status **auswerten** (`gh pr view <n> --json headRefOid,statusCheckRollup`), nicht nur anzeigen.
3. Copilot-Review lesen, falls eine kommt (`gh api repos/thomas-aurh/gipfel-und-gasse/pulls/<n>/reviews` und
   `…/comments`). Sachbefunde vor dem Merge beheben und nachmessen, Formulierungsbefunde dürfen verworfen werden.
4. Gemergt wird nur grün und gebunden an den geprüften Commit, als eigener Befehl:
   `gh pr merge <n> --squash --delete-branch --match-head-commit <sha>`.
5. Danach `git switch main && git pull --prune`, eigenen lokalen Branch löschen. Am Ende liegt kein Branch der Session ungemergt.

## 6. Auslieferung

Nach dem Merge baut GitHub Actions die APK. Den Lauf abwarten und messen, dass die Download-Seite die neue APK trägt
(`gh release view neueste --json assets`), nicht annehmen.

## 7. Bericht an Thomas

Auf Deutsch, kurz: was fertig ist, wo es liegt (PR-Link, Download-Seite), was auf dem Gerät noch zu prüfen ist.

## Schnell-Check

Gelerntes gesucht? Prüfungen grün? STAND.md: Offen aktuell, Erledigt oben, Entscheidungen mit Grund? README
nachgezogen? PR grün gemergt, Branch weg? APK auf der Download-Seite gemessen? Dann ist die Session fertig.
