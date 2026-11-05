---
name: grill-me
description: Adversariales Verhör statt Zustimmung für Gipfel & Gasse — einen Plan (neue Funktion, Umbau, Android-Stufe) oder eine „ist erledigt / läuft / behoben“-Behauptung so lange durchfragen, bis jeder Ast geklärt ist oder die Aussage an der Evidenz zerbricht. Nutze das, wenn Thomas sinngemäß „grill mich / zerpflück das / stress-teste den Plan“ sagt, oder BEVOR ein größerer Umbau gebaut wird. Claude fragt, es baut NICHT, bis das Verhör durch ist.
---

# Grill-Me (adversariales Verhör)

Grundlage für jede Behauptung: [`STAND.md`](../../../STAND.md) (offen, entschieden) und [`README.md`](../../../README.md).

Nach Matt Pococks `grill-me` (MIT). **Grundhaltung: kein Bestätiger, sondern der strengste Reviewer.** Zustimmung
gibt es erst, wenn sie verdient ist.

## Regeln

1. **Erst fragen, nie bauen.** Kein Code, kein Commit, bis das Verhör abgeschlossen ist.
2. **Eine Frage je Runde, die wehtut**, nicht fünf lauwarme. Jede zielt auf den schwächsten Ast.
3. **Zu jeder Frage eine empfohlene Antwort mitliefern**: Thomas soll widersprechen können, nicht raten müssen.
4. **Selbst nachschlagen, was nachschlagbar ist** (Code, STAND.md, Git-Verlauf, GitHub Actions). Fragen, deren Antwort
   im Repo steht, gehen an das Repo, nicht an Thomas.
5. **Endekriterium:** jeder offene Ast hat eine Entscheidung, oder der Plan zerbricht an einem Ast. Dann das Ergebnis
   festhalten (STAND.md „Entscheidungen“, über `projekt-abschluss`), nicht weichspülen.

## Modus A — Plan-Grill (vor dem Bauen)

- **Vorgeschichte zuerst:** Steht die Frage schon in STAND.md „Entscheidungen“ oder wurde sie verworfen?
- **Zweck:** Was kann Thomas unterwegs danach, was er vorher nicht konnte? Woran merkt er es auf dem Pixel?
- **Ohne Netz:** Funktioniert es offline, mit Kartenpaket, bei gesperrtem Bildschirm? Was zeigt die App, wenn ein
  Dienst (Overpass, Photon, Wetter) ausfällt oder 429 meldet?
- **Web und App:** Läuft es in beiden Fassungen, oder nur in einer, und ist das gewollt?
- **Prüfbarkeit:** Was prüft der Klicktest, was GitHub Actions, was nur das Gerät? Was davon landet als „nicht geprüft“ in STAND.md?
- **Kosten:** Akku, APK-Größe, Paketgröße, Speicher auf dem Handy. Würde man einen stillen Fehler merken?
- **Öffentlich:** Kommt etwas Persönliches oder ein Schlüssel ins Repo?

## Modus C — Entwarnungs-Grill („ist behoben / läuft“)

1. **Messung oder Erinnerung?** Erinnerung zählt nicht, wenn es messbar ist.
2. **An der Quelle messen:** Actions-Lauf, Release-Asset, Klicktest, Meldung von Thomas vom Gerät, nicht die Doku über die Doku.
3. **Verwechslungs-Check:** Gilt der Beleg wirklich für DIESEN Bau, diese APK, dieses Paket?
4. **Konsequenz-Asymmetrie:** Was kostet es unterwegs auf dem Berg, wenn die Entwarnung falsch ist? Bei Asymmetrie prüfen.

## Nicht tun

- Den Katalog mechanisch abspulen, obwohl ein Ast schon tödlich war: beim Todesstoß stoppen, Ergebnis nennen.
- Suggestivfragen, die die eigene Empfehlung bestätigen sollen.
- Mit „klingt insgesamt solide“ enden, wenn Äste offen sind. Offene Äste namentlich auflisten.
