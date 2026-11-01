#!/usr/bin/env python3
"""Künstliche Kartenpakete für den Klicktest (ohne Netz): Vektorkarte im Protomaps-Schema und Höhendaten (Terrarium)
mit einem Berg (Gipfel 1800 m bei 47,585 N / 11,35 O). Ausgabe: test/out/karten/probe/{karte,hoehe}.pmtiles
Braucht: pip install pmtiles mapbox-vector-tile pillow
"""
import gzip
import io
import math
import os

import mapbox_vector_tile
from PIL import Image
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer

BBOX = (11.30, 47.55, 11.40, 47.62)
ZIEL = os.path.join(os.path.dirname(__file__), "out", "karten", "probe")


def kx(lon, z): return int((lon + 180) / 360 * 2 ** z)
def ky(lat, z):
    r = math.radians(lat)
    return int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** z)
def lon_von(x, z): return x / 2 ** z * 360 - 180
def lat_von(y, z): return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / 2 ** z))))


def kacheln(zmin, zmax):
    for z in range(zmin, zmax + 1):
        for x in range(kx(BBOX[0], z), kx(BBOX[2], z) + 1):
            for y in range(ky(BBOX[3], z), ky(BBOX[1], z) + 1):
                yield z, x, y


def schreiben(datei, tiles, typ, kompr, maxz, meta):
    with open(datei, "wb") as f:
        w = Writer(f)
        for tid in sorted(tiles):
            w.write_tile(tid, tiles[tid])
        w.finalize({"tile_type": typ, "tile_compression": kompr,
                    "min_lon_e7": int(BBOX[0] * 1e7), "min_lat_e7": int(BBOX[1] * 1e7),
                    "max_lon_e7": int(BBOX[2] * 1e7), "max_lat_e7": int(BBOX[3] * 1e7),
                    "center_zoom": 12, "center_lon_e7": int(11.35e7), "center_lat_e7": int(47.585e7)}, meta)


def hoehe(lat, lon):
    d2 = ((lat - 47.585) * 111000) ** 2 + ((lon - 11.35) * 75000) ** 2
    return 600 + 1200 * math.exp(-d2 / (1800 ** 2))


def vektor():
    tiles = {}
    for z, x, y in kacheln(0, 14):
        ext = 4096
        ganz = [(0, 0), (ext, 0), (ext, ext), (0, ext), (0, 0)]
        see = [(800, 800), (1800, 800), (1800, 1600), (800, 1600), (800, 800)]
        layers = [
            {"name": "earth", "features": [{"geometry": {"type": "Polygon", "coordinates": [ganz]}, "properties": {"kind": "earth"}}]},
            {"name": "water", "features": [{"geometry": {"type": "Polygon", "coordinates": [see]}, "properties": {"kind": "lake", "name": "Probesee"}}]},
            {"name": "roads", "features": [
                {"geometry": {"type": "LineString", "coordinates": [(0, 2000), (4096, 2600)]}, "properties": {"kind": "minor_road", "kind_detail": "residential", "name": "Probeweg"}},
                {"geometry": {"type": "LineString", "coordinates": [(2000, 0), (2400, 4096)]}, "properties": {"kind": "path", "kind_detail": "path"}}]},
        ]
        mvt = mapbox_vector_tile.encode(layers, default_options={"extents": ext, "y_coord_down": True})
        tiles[zxy_to_tileid(z, x, y)] = gzip.compress(mvt, mtime=0)
    schreiben(os.path.join(ZIEL, "karte.pmtiles"), tiles, TileType.MVT, Compression.GZIP, 14,
              {"name": "Probekarte", "vector_layers": [{"id": n, "fields": {}} for n in ("earth", "water", "roads")]})


def dem():
    tiles = {}
    for z, x, y in kacheln(0, 12):
        img = Image.new("RGB", (256, 256))
        px = img.load()
        for j in range(256):
            lat = lat_von(y + (j + 0.5) / 256, z)
            for i in range(256):
                e = hoehe(lat, lon_von(x + (i + 0.5) / 256, z)) + 32768
                r, rest = divmod(e, 256)
                g = int(rest)
                px[i, j] = (int(r), g, int((rest - g) * 256))
        b = io.BytesIO()
        img.save(b, "PNG")
        tiles[zxy_to_tileid(z, x, y)] = b.getvalue()
    schreiben(os.path.join(ZIEL, "hoehe.pmtiles"), tiles, TileType.PNG, Compression.NONE, 12,
              {"name": "Probehöhen", "encoding": "terrarium"})


if __name__ == "__main__":
    os.makedirs(ZIEL, exist_ok=True)
    vektor()
    dem()
    print("Testkarten in " + ZIEL)
