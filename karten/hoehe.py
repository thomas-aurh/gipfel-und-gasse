#!/usr/bin/env python3
"""Höhen-Paket für eine Region: Terrarium-Kacheln (Mapzen/Tilezen Terrain Tiles, AWS Open Data) in eine PMTiles-Datei.

Aufruf: python3 karten/hoehe.py <west> <süd> <ost> <nord> <maxzoom> <ausgabe.pmtiles>
Terrarium: Höhe = (R * 256 + G + B / 256) - 32768 Meter. Die App zeichnet daraus Höhenlinien und Schummerung und liest
Höhen für gerade Linien und GPX-Dateien ohne Netz.
"""
import concurrent.futures
import math
import sys
import time
import urllib.request

from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer

QUELLE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
HINWEIS = ("Höhen: Mapzen/Tilezen Terrain Tiles (u. a. SRTM, GMTED2010, EU-DEM: produziert mit Copernicus-Daten, "
           "finanziert von der EU)")


def kachel_x(lon, z):
    return int((lon + 180) / 360 * 2 ** z)


def kachel_y(lat, z):
    r = math.radians(lat)
    return int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** z)


def kacheln(west, sued, ost, nord, maxzoom):
    for z in range(0, maxzoom + 1):
        x0, x1 = kachel_x(west, z), kachel_x(ost, z)
        y0, y1 = kachel_y(nord, z), kachel_y(sued, z)
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                yield z, x, y


def holen(zxy):
    z, x, y = zxy
    url = QUELLE.format(z=z, x=x, y=y)
    for versuch in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "GipfelUndGasse-Kartenpakete"}), timeout=60) as r:
                return zxy, r.read()
        except Exception as e:  # noqa: BLE001 - Netzfehler: nochmal
            if versuch == 4:
                raise RuntimeError(f"{url}: {e}") from e
            time.sleep(2 ** versuch)


def main():
    if len(sys.argv) != 7:
        sys.exit(__doc__)
    west, sued, ost, nord = map(float, sys.argv[1:5])
    maxzoom, ausgabe = int(sys.argv[5]), sys.argv[6]
    liste = list(kacheln(west, sued, ost, nord, maxzoom))
    print(f"{len(liste)} Höhenkacheln z0–{maxzoom}", flush=True)
    daten = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        for i, (zxy, inhalt) in enumerate(pool.map(holen, liste)):
            daten[zxy_to_tileid(*zxy)] = inhalt
            if i % 200 == 0:
                print(f"  {i}/{len(liste)}", flush=True)
    with open(ausgabe, "wb") as f:
        w = Writer(f)
        for tid in sorted(daten):
            w.write_tile(tid, daten[tid])
        w.finalize(
            {
                "tile_type": TileType.PNG,
                "tile_compression": Compression.NONE,
                "min_lon_e7": int(west * 1e7), "min_lat_e7": int(sued * 1e7),
                "max_lon_e7": int(ost * 1e7), "max_lat_e7": int(nord * 1e7),
                "center_zoom": min(maxzoom, 10),
                "center_lon_e7": int((west + ost) / 2 * 1e7), "center_lat_e7": int((sued + nord) / 2 * 1e7),
            },
            {"name": "Höhen (Terrarium)", "encoding": "terrarium", "attribution": HINWEIS},
        )
    print(f"geschrieben: {ausgabe}", flush=True)


if __name__ == "__main__":
    main()
