#!/usr/bin/env python3
"""Entfernt Dateien von der Release „kartenpakete“, die weder die neue noch die vorige Paketliste nennt.

Aufruf: python3 karten/aufraeumen.py <neue pakete.json> [<vorige pakete.json>]   (braucht gh mit GH_TOKEN)
Die vorige Liste bleibt gültig, bis jede App die neue geholt hat; ihre Dateien bleiben deshalb einen Bau lang liegen.
"""
import json
import os
import subprocess
import sys

TAG = "kartenpakete"


def namen(liste):
    if not liste or not os.path.exists(liste):
        return set()
    d = json.load(open(liste, encoding="utf-8"))
    return {os.path.basename(f["url"]) for p in d.get("pakete", []) for f in p.get("dateien", [])}


def main():
    behalten = namen(sys.argv[1]) | namen(sys.argv[2] if len(sys.argv) > 2 else None) | {"pakete.json"}
    vorhanden = json.loads(subprocess.run(["gh", "release", "view", TAG, "--json", "assets"], check=True, capture_output=True, text=True).stdout)["assets"]
    for a in vorhanden:
        if a["name"] not in behalten:
            print("entferne " + a["name"], flush=True)
            subprocess.run(["gh", "release", "delete-asset", TAG, a["name"], "--yes"], check=True)


if __name__ == "__main__":
    main()
