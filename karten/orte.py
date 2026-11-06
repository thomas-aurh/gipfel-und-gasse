#!/usr/bin/env python3
"""Orte für die Offline-Suche und „Orte entlang der Route“ aus OSM-Auszügen (PBF, z. B. von Geofabrik).

Aufruf: python3 karten/orte.py <west> <süd> <ost> <nord> <ausgabe.json.gz> <auszug.osm.pbf> [<auszug> …]
Braucht: pip install osmium (pyosmium)

Ausgabe (gzip-JSON):
  {"v": 1, "bbox": [w, s, o, n],
   "orte":  [[lat, lon, "n123", {Merkmale}], …]   dieselbe Auswahl, die die App sonst bei Overpass abfragt
                                                   (Orte entlang der Route und Sehenswürdigkeiten in der Stadt)
   "suche": [[Name, lat, lon, Art, bei Ort, Rang], …]  Orte, Gipfel, Seen, Straßen und benannte Orte von oben
   "trails": [[Skala, Name, [lat, lon, dlat, dlon, …]], …]  Wege mit mtb:scale (Skala 0–6 = S0–S6), Verlauf vereinfacht
                                                   (Douglas-Peucker, 3 m), in 1e-5 Grad, ab dem zweiten Punkt als Differenz}
Mehrere Auszüge dürfen sich überlappen (z. B. Bayern und Österreich); doppelte Objekte zählen einmal.
"""
import gzip
import json
import math
import re
import sys
import unicodedata

import osmium

# ---------- Auswahl wie die Overpass-Abfragen der App (web/src/00-rechnen.js: overpassAbfrage, stadtAbfrage) ----------
HISTORIC = {"monument", "memorial", "castle", "ruins", "city_gate", "archaeological_site", "fort", "palace", "manor",
            "church", "monastery", "tower", "building"}


def ist_ort(t, knoten):
    to, am, le, na = t.get("tourism"), t.get("amenity"), t.get("leisure"), t.get("natural")
    # Orte entlang der Route
    if to in ("alpine_hut", "wilderness_hut", "viewpoint", "picnic_site"):
        return True
    if am in ("restaurant", "cafe", "biergarten", "drinking_water", "toilets", "shelter", "parking"):
        return True
    if le in ("playground", "bathing_place", "swimming_area", "picnic_table"):
        return True
    if knoten:
        if am == "fountain" and t.get("drinking_water") == "yes":
            return True
        if na in ("peak", "waterfall", "cave_entrance") or t.get("waterway") == "waterfall":
            return True
        if t.get("highway") == "bus_stop" or t.get("railway") in ("station", "halt") or t.get("aerialway") == "station":
            return True
    # Sehenswürdigkeiten in der Stadt
    if to in ("attraction", "museum", "gallery", "artwork", "zoo", "aquarium", "theme_park"):
        return True
    if t.get("historic") in HISTORIC and "name" in t:
        return True
    if am == "place_of_worship" and "wikidata" in t:
        return True
    if am == "fountain" and "name" in t:
        return True
    if am == "ice_cream":
        return True
    if le in ("park", "garden") and "name" in t:
        return True
    if to == "information" and t.get("information") == "office":
        return True
    return False


# nur diese Merkmale braucht die App (Einordnung, Name, Fenster mit Öffnungszeiten, Höhe, Betreiber, Webseite,
# Eintritt und Rollstuhl in den Fenstern der Sehenswürdigkeiten; Prüfdatum der Öffnungszeiten, damit die App ihr Alter
# zeigt, Abgleich mit Google vom 03.11. in docs/oeffnungszeiten-abgleich.md)
BEHALTEN = ("name", "name:de", "ele", "natural", "tourism", "amenity", "leisure", "historic", "waterway", "highway",
            "railway", "aerialway", "drinking_water", "access", "wikipedia", "wikidata", "opening_hours", "operator",
            "website", "contact:website", "information", "fee", "charge", "wheelchair",
            "check_date", "check_date:opening_hours")

# ---------- Suche ----------
ORTSART = {"city": ("Stadt", 100), "town": ("Stadt", 80), "village": ("Dorf", 50), "suburb": ("Stadtteil", 35),
           "quarter": ("Stadtteil", 30), "neighbourhood": ("Viertel", 25), "hamlet": ("Weiler", 25),
           "isolated_dwelling": ("Einöde", 15), "locality": ("Flur", 12), "square": ("Platz", 35)}
NATURART = {"peak": ("Gipfel", 55), "saddle": ("Sattel", 35), "volcano": ("Gipfel", 50), "glacier": ("Gletscher", 40),
            "water": ("See", 40), "waterfall": ("Wasserfall", 35), "cave_entrance": ("Höhle", 30)}
STRASSEN = {"motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "living_street",
            "pedestrian", "road"}


def poi_art(t):
    """Art eines Orts aus der Auswahl oben, mit Rang für die Reihenfolge der Treffer."""
    to, am, le = t.get("tourism"), t.get("amenity"), t.get("leisure")
    tabelle = [
        (to in ("alpine_hut",), "Berghütte", 50), (to == "wilderness_hut", "Selbstversorgerhütte", 40),
        (t.get("railway") in ("station", "halt"), "Bahnhof", 45), (t.get("aerialway") == "station", "Bergbahn", 40),
        (to == "museum", "Museum", 40), (to == "gallery", "Galerie", 30), (to in ("zoo", "aquarium", "theme_park"), "Freizeit", 40),
        (to == "attraction", "Sehenswürdigkeit", 40), (to == "viewpoint", "Aussichtspunkt", 30),
        (t.get("historic") in ("castle", "palace", "fort", "manor"), "Schloss/Burg", 40),
        (t.get("historic") in ("monastery", "church"), "Kirche/Kloster", 35), ("historic" in t, "Denkmal", 25),
        (am == "place_of_worship", "Kirche", 30), (le in ("park", "garden"), "Park", 30),
        (le in ("bathing_place", "swimming_area"), "Badestelle", 30), (am == "biergarten", "Biergarten", 30),
        (am in ("restaurant",), "Gasthaus", 22), (am == "cafe", "Café", 20), (am == "ice_cream", "Eisdiele", 18),
        (t.get("highway") == "bus_stop", "Haltestelle", 18), (to == "information", "Touristinfo", 20),
        (am == "fountain", "Brunnen", 18), (to == "artwork", "Kunstwerk", 15), (le == "playground", "Spielplatz", 12),
        (to == "picnic_site", "Rastplatz", 12), (am == "parking", "Parkplatz", 10), (am == "shelter", "Unterstand", 10),
    ]
    for passt, art, rang in tabelle:
        if passt:
            return art, rang
    na = t.get("natural")
    if na in NATURART:
        return NATURART[na]
    return "Ort", 10


def norm(s):
    s = unicodedata.normalize("NFD", s.lower().replace("ß", "ss"))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def abstand(a, b):
    kx = math.cos(math.radians((a[0] + b[0]) / 2)) * 111320
    return math.hypot((a[1] - b[1]) * kx, (a[0] - b[0]) * 110540)


class Raster:
    """Einfaches Gitter für „was liegt in der Nähe“ (Zellen von 0,05°)."""
    def __init__(self, zelle=0.05):
        self.z, self.zellen = zelle, {}

    def schluessel(self, lat, lon):
        return int(math.floor(lat / self.z)), int(math.floor(lon / self.z))

    def dazu(self, lat, lon, wert):
        self.zellen.setdefault(self.schluessel(lat, lon), []).append((lat, lon, wert))

    def nahe(self, lat, lon, ring=1):
        i, j = self.schluessel(lat, lon)
        for di in range(-ring, ring + 1):
            for dj in range(-ring, ring + 1):
                yield from self.zellen.get((i + di, j + dj), ())


def mitte(obj):
    """Mittelpunkt: Knoten selbst, Fläche über den äußeren Ring, Linie über ihren mittleren Punkt."""
    if isinstance(obj, osmium.osm.Node):
        return obj.location.lat, obj.location.lon
    if isinstance(obj, osmium.osm.Area):
        for ring in obj.outer_rings():
            pts = [(n.location.lat, n.location.lon) for n in ring]
            if len(pts) > 1 and pts[0] == pts[-1]:
                pts = pts[:-1]
            if pts:
                return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
        return None
    knoten = list(obj.nodes)
    if not knoten:
        return None
    n = knoten[len(knoten) // 2]
    return n.location.lat, n.location.lon


# ---------- MTB-Trails (Wege mit mtb:scale) ----------
def mtb_skala(wert):
    """Erste Ziffer von mtb:scale („2+“, „1-“, „3;4“), sonst None. Skala S0–S6."""
    m = re.match(r"\s*([0-6])", wert or "")
    return int(m.group(1)) if m else None


def vereinfachen(pts, toleranz=3.0):
    """Douglas-Peucker in Metern (lokal eben gerechnet), Anfang und Ende bleiben."""
    if len(pts) < 3:
        return pts
    kx = math.cos(math.radians(pts[0][0])) * 111320
    xy = [((p[1] - pts[0][1]) * kx, (p[0] - pts[0][0]) * 110540) for p in pts]
    behalten = [False] * len(pts)
    behalten[0] = behalten[-1] = True
    stapel = [(0, len(pts) - 1)]
    while stapel:
        a, b = stapel.pop()
        (ax, ay), (bx, by) = xy[a], xy[b]
        dx, dy = bx - ax, by - ay
        lang = math.hypot(dx, dy)
        best, weit = -1, toleranz
        for i in range(a + 1, b):
            px, py = xy[i]
            d = abs(dy * (px - ax) - dx * (py - ay)) / lang if lang else math.hypot(px - ax, py - ay)
            if d > weit:
                best, weit = i, d
        if best >= 0:
            behalten[best] = True
            stapel += [(a, best), (best, b)]
    return [p for p, k in zip(pts, behalten) if k]


def trail_eintrag(skala, name, pts):
    """[Skala, Name, [lat, lon, dlat, dlon, …]] in 1e-5 Grad."""
    flach, vorher = [], None
    for lat, lon in pts:
        q = (round(lat * 1e5), round(lon * 1e5))
        if vorher is None:
            flach += [q[0], q[1]]
        elif q != vorher:
            flach += [q[0] - vorher[0], q[1] - vorher[1]]
        else:
            continue
        vorher = q
    return [skala, name, flach]


def lesen(dateien, bbox):
    w, s, o, n = bbox
    orte, suche, orte_ids, gesehen = [], [], set(), set()
    trails, trail_ids = [], set()
    schluessel = ("place", "tourism", "amenity", "natural", "leisure", "historic", "waterway", "highway", "railway", "aerialway")
    for datei in dateien:
        fp = (osmium.FileProcessor(datei)
              .with_areas(osmium.filter.KeyFilter("tourism", "amenity", "leisure", "historic", "natural", "place"))
              .with_filter(osmium.filter.KeyFilter(*schluessel)))
        for obj in fp:
            if isinstance(obj, osmium.osm.Relation):
                continue
            if isinstance(obj, osmium.osm.Area):
                kennung = ("w" if obj.from_way() else "r") + str(obj.orig_id())
            elif isinstance(obj, osmium.osm.Way):
                kennung = "w" + str(obj.id)
            else:
                kennung = "n" + str(obj.id)
            t = {tag.k: tag.v for tag in obj.tags}
            if isinstance(obj, osmium.osm.Way) and "mtb:scale" in t and "highway" in t and obj.id not in trail_ids:
                skala = mtb_skala(t["mtb:scale"])
                try:
                    pts = [(n_.location.lat, n_.location.lon) for n_ in obj.nodes]
                except osmium.InvalidLocationError:
                    pts = []
                if skala is not None and len(pts) > 1 and any(w <= p[1] <= o and s <= p[0] <= n for p in pts):
                    trail_ids.add(obj.id)
                    trails.append(trail_eintrag(skala, t.get("name:de") or t.get("name") or "", vereinfachen(pts)))
            strasse = isinstance(obj, osmium.osm.Way) and t.get("highway") in STRASSEN and "name" in t
            # geschlossene Wege kommen als Fläche (gleiche Kennung), offene Wege als Straße oder als Ort (z. B. eine
            # Stadtmauer mit historic=citywalls und Namen); die Mitte ist dann ihr mittlerer Punkt
            if isinstance(obj, osmium.osm.Way) and not strasse and (obj.is_closed() or not ist_ort(t, False)):
                continue
            if isinstance(obj, osmium.osm.Area) and "highway" in t:
                continue
            try:
                m = mitte(obj)
            except osmium.InvalidLocationError:
                continue
            if not m or not (w <= m[1] <= o and s <= m[0] <= n):
                continue
            lat, lon = round(m[0], 5), round(m[1], 5)
            knoten = isinstance(obj, osmium.osm.Node)
            if not strasse and ist_ort(t, knoten) and kennung not in orte_ids:
                orte_ids.add(kennung)
                orte.append([lat, lon, kennung, {k: t[k] for k in BEHALTEN if k in t}])
            name = t.get("name:de") or t.get("name")
            if not name or kennung in gesehen:
                continue
            gesehen.add(kennung)
            if strasse:
                art, rang = "Straße", 20 if t["highway"] not in ("pedestrian", "living_street") else 25
            elif t.get("place") in ORTSART:
                art, rang = ORTSART[t["place"]]
            elif ist_ort(t, knoten) or t.get("natural") in NATURART:
                if t.get("natural") == "water" and t.get("water") in ("river", "canal", "stream", "pond", "reservoir"):
                    art, rang = ({"pond": ("Teich", 20), "reservoir": ("Stausee", 40)}).get(t["water"], ("Gewässer", 15))
                else:
                    art, rang = poi_art(t)
            else:
                continue
            if "wikidata" in t or "wikipedia" in t:
                rang += 10
            if t.get("natural") == "peak" and t.get("ele"):
                try:
                    rang += min(20, int(float(t["ele"].replace(",", ".").split()[0]) / 200))
                except ValueError:
                    pass
            suche.append([name, lat, lon, art, "", rang, t.get("place")])
    return orte, suche, trails


def bei_ort(suche):
    """Zu jedem Treffer den nächsten Ort (Stadt im Umkreis von 15 km, Dorf 3 km), für die Zeile unter dem Namen."""
    reichweite = {"city": 15000, "town": 6000, "village": 3000}
    raster = Raster()
    for e in suche:
        if e[6] in reichweite:
            raster.dazu(e[1], e[2], e)
    for e in suche:
        if e[6] in ("city", "town"):
            continue
        best, wert = None, 1.0
        for lat, lon, ort in raster.nahe(e[1], e[2], ring=3):
            if ort is e:
                continue
            q = abstand((e[1], e[2]), (lat, lon)) / reichweite[ort[6]]
            if q < wert:
                best, wert = ort, q
        if best and best[0] != e[0]:
            e[4] = best[0]


def zusammenfassen(suche):
    """Gleicher Name und gleiche Art in der Nähe (z. B. die Abschnitte einer Straße) zählen einmal."""
    raster, out = Raster(0.02), []
    for e in sorted(suche, key=lambda e: -e[5]):
        k = (norm(e[0]), e[3])
        doppelt = any(v == k and abstand((e[1], e[2]), (lat, lon)) < 1500 for lat, lon, v in raster.nahe(e[1], e[2]))
        if doppelt:
            continue
        raster.dazu(e[1], e[2], k)
        out.append(e[:6])
    return out


def main():
    if len(sys.argv) < 7:
        sys.exit(__doc__)
    bbox = [float(x) for x in sys.argv[1:5]]
    ziel, dateien = sys.argv[5], sys.argv[6:]
    orte, suche, trails = lesen(dateien, bbox)
    bei_ort(suche)
    suche = zusammenfassen(suche)
    daten = {"v": 1, "bbox": bbox, "orte": orte, "suche": suche, "trails": trails}
    with gzip.open(ziel, "wt", encoding="utf-8", compresslevel=9) as f:
        json.dump(daten, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  Orte: {len(orte)}, Suchbegriffe: {len(suche)}, MTB-Trails: {len(trails)}", flush=True)


if __name__ == "__main__":
    main()
