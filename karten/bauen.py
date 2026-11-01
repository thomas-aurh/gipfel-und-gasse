#!/usr/bin/env python3
"""Baut die Offline-Kartenpakete aus karten/regionen.json und schreibt pakete.json.

Aufruf: python3 karten/bauen.py <ausgabeordner> <protomaps-quelle> [region-id] [--alte-liste pakete.json]
  protomaps-quelle: URL oder Datei eines Protomaps-Weltdatensatzes (PMTiles), z. B. https://build.protomaps.com/20261031.pmtiles
Braucht das Programm „pmtiles“ (go-pmtiles) im PATH oder in $PMTILES, und das Paket pmtiles für hoehe.py.
Je Region entstehen <id>-karte.pmtiles (Vektorkarte) und <id>-hoehe.pmtiles (Höhen), auf Wunsch Routendaten und
<id>-orte.json.gz (Orte und Suche aus OSM-Auszügen von Geofabrik, karten/orte.py, braucht pip install osmium);
die Liste nennt Größe und SHA-256 jeder Datei, die App prüft beides nach dem Download.
Zum Testen ohne Netz: ROUTEN_QUELLE (Ordner mit Routen-Kacheln), OSM_QUELLE (PBF- oder OSM-Dateien, mit : getrennt).
"""
import datetime
import hashlib
import json
import os
import re
import math
import shutil
import subprocess
import sys
import time
import urllib.request

HIER = os.path.dirname(os.path.abspath(__file__))
REPO = "thomas-aurh/gipfel-und-gasse"
TAG = "kartenpakete"
HINWEIS = ("Kartendaten © OpenStreetMap-Mitwirkende (ODbL), Vektorkacheln Protomaps; Höhen: Mapzen/Tilezen Terrain Tiles "
           "(u. a. SRTM, GMTED2010, EU-DEM: produziert mit Copernicus-Daten, finanziert von der EU); Routendaten: BRouter (brouter.de)")
ROUTEN = "https://brouter.de/brouter/segments4/{}.rd5"
OSM = "https://download.geofabrik.de/{}-latest.osm.pbf"
OSM_HINWEIS = "; Orte: OpenStreetMap über Geofabrik"


def routen_kacheln(w, s, o, n):
    """Namen der BRouter-Kacheln (5°×5°), die das Gebiet berührt, z. B. E10_N45."""
    out = []
    for x in range(int(math.floor(w / 5)) * 5, int(math.floor(o / 5)) * 5 + 1, 5):
        for y in range(int(math.floor(s / 5)) * 5, int(math.floor(n / 5)) * 5 + 1, 5):
            out.append(("W" + str(-x) if x < 0 else "E" + str(x)) + "_" + ("S" + str(-y) if y < 0 else "N" + str(y)))
    return out


def laden(url, ziel):
    for versuch in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "GipfelUndGasse-Kartenpakete"}), timeout=120) as r, open(ziel, "wb") as f:
                shutil.copyfileobj(r, f, 1 << 20)
            return
        except Exception as e:  # noqa: BLE001 - Netzfehler: nochmal
            if versuch == 4:
                raise RuntimeError(f"{url}: {e}") from e
            time.sleep(5 * 2 ** versuch)


def sha256(datei):
    h = hashlib.sha256()
    with open(datei, "rb") as f:
        for teil in iter(lambda: f.read(1 << 20), b""):
            h.update(teil)
    return h.hexdigest()


def ausfuehren(befehl):
    print("$ " + " ".join(befehl), flush=True)
    subprocess.run(befehl, check=True)


def main():
    argv = [a for a in sys.argv[1:] if not a.startswith("--")]
    alte = None
    if "--alte-liste" in sys.argv:
        alte = sys.argv[sys.argv.index("--alte-liste") + 1]
        argv = [a for a in argv if a != alte]
    if len(argv) < 2:
        sys.exit(__doc__)
    ziel, quelle = argv[0], argv[1]
    nur = argv[2] if len(argv) > 2 and argv[2] else None
    os.makedirs(ziel, exist_ok=True)
    pmtiles = os.environ.get("PMTILES", "pmtiles")
    stand = re.search(r"(\d{8})", quelle)
    stand = datetime.datetime.strptime(stand.group(1), "%Y%m%d").date().isoformat() if stand else datetime.date.today().isoformat()

    regionen = json.load(open(os.path.join(HIER, "regionen.json"), encoding="utf-8"))["regionen"]
    liste = {"pakete": []}
    if alte and os.path.exists(alte):
        liste = json.load(open(alte, encoding="utf-8"))
    bekannte = {p["id"]: p for p in liste.get("pakete", [])}
    gebaut = []

    for r in regionen:
        if nur and r["id"] != nur:
            continue
        w, s, o, n = r["bbox"]
        karte = os.path.join(ziel, r["id"] + "-karte.pmtiles")
        hoehe = os.path.join(ziel, r["id"] + "-hoehe.pmtiles")
        ausfuehren([pmtiles, "extract", quelle, karte, f"--bbox={w},{s},{o},{n}", f"--maxzoom={r.get('maxzoom', 15)}", "--download-threads=4"])
        ausfuehren([sys.executable, os.path.join(HIER, "hoehe.py"), str(w), str(s), str(o), str(n), str(r.get("hoehe_maxzoom", 12)), hoehe])
        dateien = []
        for name, pfad in (("karte.pmtiles", karte), ("hoehe.pmtiles", hoehe)):
            # unveränderlicher Name mit dem Anfang der Prüfsumme: eine ältere Liste zeigt nie auf eine neuere Datei
            pruef = sha256(pfad)
            fest = os.path.join(ziel, f"{r['id']}-{name.split('.')[0]}-{pruef[:12]}.pmtiles")
            os.replace(pfad, fest)
            dateien.append({
                "name": name,
                "url": f"https://github.com/{REPO}/releases/download/{TAG}/{os.path.basename(fest)}",
                "groesse": os.path.getsize(fest),
                "sha256": pruef,
            })
            print(f"  {os.path.basename(fest)}: {os.path.getsize(fest) / 1048576:.1f} MB", flush=True)
        if r.get("routing"):
            for k in routen_kacheln(w, s, o, n):
                name = "routing-" + k.lower().replace("_", "-") + ".rd5"
                tmp = os.path.join(ziel, name)
                if os.environ.get("ROUTEN_QUELLE"):   # zum Testen: Ordner mit fertigen Kacheln
                    shutil.copyfile(os.path.join(os.environ["ROUTEN_QUELLE"], k + ".rd5"), tmp)
                else:
                    print(f"$ lade Routendaten {k}", flush=True)
                    laden(ROUTEN.format(k), tmp)
                pruef = sha256(tmp)
                fest = os.path.join(ziel, f"{name[:-4]}-{pruef[:12]}.rd5")
                os.replace(tmp, fest)
                dateien.append({
                    "name": name, "kachel": k,
                    "url": f"https://github.com/{REPO}/releases/download/{TAG}/{os.path.basename(fest)}",
                    "groesse": os.path.getsize(fest), "sha256": pruef,
                })
                print(f"  {os.path.basename(fest)}: {os.path.getsize(fest) / 1048576:.1f} MB", flush=True)
        if r.get("orte"):
            if os.environ.get("OSM_QUELLE"):
                auszuege = os.environ["OSM_QUELLE"].split(":")
            else:
                auszuege = []
                for teil in r["orte"]:
                    pfad = os.path.join(ziel, "osm-" + teil.replace("/", "-") + ".osm.pbf")
                    if not os.path.exists(pfad):   # mehrere Regionen teilen sich einen Auszug
                        print(f"$ lade OSM-Auszug {teil}", flush=True)
                        laden(OSM.format(teil), pfad)
                    auszuege.append(pfad)
            tmp = os.path.join(ziel, r["id"] + "-orte.json.gz")
            ausfuehren([sys.executable, os.path.join(HIER, "orte.py"), str(w), str(s), str(o), str(n), tmp] + auszuege)
            pruef = sha256(tmp)
            fest = os.path.join(ziel, f"{r['id']}-orte-{pruef[:12]}.json.gz")
            os.replace(tmp, fest)
            dateien.append({
                "name": "orte.json.gz",
                "url": f"https://github.com/{REPO}/releases/download/{TAG}/{os.path.basename(fest)}",
                "groesse": os.path.getsize(fest), "sha256": pruef,
            })
            print(f"  {os.path.basename(fest)}: {os.path.getsize(fest) / 1048576:.1f} MB", flush=True)
        gebaut.append(r["id"])
        bekannte[r["id"]] = {
            "id": r["id"], "name": r["name"], "bbox": r["bbox"], "maxzoom": r.get("maxzoom", 15),
            "hoehe_maxzoom": r.get("hoehe_maxzoom", 12), "stand": stand,
            "attribution": HINWEIS + (OSM_HINWEIS if r.get("orte") else ""), "dateien": dateien,
        }

    # nur Regionen, die es in regionen.json noch gibt
    ids = [r["id"] for r in regionen]
    liste = {
        "erstellt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "quelle": quelle,
        "pakete": [bekannte[i] for i in ids if i in bekannte],
    }
    with open(os.path.join(ziel, "pakete.json"), "w", encoding="utf-8") as f:
        json.dump(liste, f, ensure_ascii=False, indent=2)
    # welche Regionen in diesem Lauf neu gebaut wurden (nur die prüft die Probe)
    with open(os.path.join(ziel, "gebaut.json"), "w", encoding="utf-8") as f:
        json.dump(gebaut, f)
    print("pakete.json: " + ", ".join(p["id"] + " (" + p["stand"] + ")" for p in liste["pakete"]), flush=True)


if __name__ == "__main__":
    main()
