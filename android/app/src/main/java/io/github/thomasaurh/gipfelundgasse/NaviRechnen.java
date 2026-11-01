package io.github.thomasaurh.gipfelundgasse;

import java.util.Locale;

/**
 * Reine Rechnungen für die Navigation, ohne Android-Klassen (damit sie als einfacher JUnit-Test laufen).
 * Gleiche Formeln wie web/src/00-rechnen.js: Haversine, Höhenmeter mit 5-m-Schwelle, Gehzeit nach DIN 33466.
 */
public final class NaviRechnen {
    private NaviRechnen() {}

    /**
     * Strecke: Breite, Länge, Höhe (NaN = unbekannt) und Meter ab Start.
     * luecke[i] = true: Punkt i beginnt einen neuen Abschnitt (z. B. zweite Aufnahme einer GPX-Datei); der Sprung dorthin
     * zählt nicht als Weg und ist keine Verbindung, auf der man laufen könnte.
     */
    public static final class Strecke {
        public final double[] lat, lon, ele, d;
        public final boolean[] luecke;
        public Strecke(double[] lat, double[] lon, double[] ele) { this(lat, lon, ele, null); }
        public Strecke(double[] lat, double[] lon, double[] ele, boolean[] luecke) {
            this.lat = lat; this.lon = lon; this.ele = ele;
            this.luecke = luecke != null ? luecke : new boolean[lat.length];
            this.d = new double[lat.length];
            for (int i = 1; i < lat.length; i++) d[i] = d[i - 1] + (this.luecke[i] ? 0 : abstand(lat[i - 1], lon[i - 1], lat[i], lon[i]));
        }
        /** Gleiche Geometrie (für erneut gesendete, unveränderte Routen). */
        public boolean gleich(Strecke o) {
            if (o == null || o.groesse() != groesse()) return false;
            for (int i = 0; i < groesse(); i++) if (lat[i] != o.lat[i] || lon[i] != o.lon[i] || luecke[i] != o.luecke[i]) return false;
            return true;
        }
        public int groesse() { return lat.length; }
        public double laenge() { return d.length == 0 ? 0 : d[d.length - 1]; }
    }

    /** Lage auf der Strecke: Meter ab Start und Abstand neben der Strecke. */
    public static final class Lage {
        public final double d, abw;
        Lage(double d, double abw) { this.d = d; this.abw = abw; }
    }

    public static final class Rest {
        public final double meter, auf, ab, stunden;
        Rest(double meter, double auf, double ab, double stunden) { this.meter = meter; this.auf = auf; this.ab = ab; this.stunden = stunden; }
    }

    public static double abstand(double lat1, double lon1, double lat2, double lon2) {
        double r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
        double s = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.pow(Math.sin(dLon / 2), 2);
        return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(s)));
    }

    /**
     * Nächster Punkt der Strecke. vorher = bisheriger Fortschritt (oder NaN): dann zählt zuerst nur das Stück kurz davor
     * bis 2 km danach, damit Rundtouren nicht ans Ende springen.
     */
    public static Lage aufStrecke(Strecke s, double lat, double lon, double vorher) {
        Lage best = null;
        if (!Double.isNaN(vorher)) best = suche(s, lat, lon, vorher - 300, vorher + 2000);
        if (best == null || best.abw > 150) {
            Lage alle = suche(s, lat, lon, Double.NEGATIVE_INFINITY, Double.POSITIVE_INFINITY);
            if (alle != null && (best == null || alle.abw < best.abw)) best = alle;
        }
        if (best == null) best = new Lage(0, s.groesse() > 0 ? abstand(s.lat[0], s.lon[0], lat, lon) : 0);
        return best;
    }

    private static Lage suche(Strecke s, double lat, double lon, double von, double bis) {
        double kx = Math.cos(lat * Math.PI / 180) * 111320, ky = 110540;
        Lage best = null;
        for (int i = 0; i < s.groesse() - 1; i++) {
            if (s.luecke[i + 1]) continue;   // keine Verbindung zwischen zwei Abschnitten
            if (s.d[i + 1] < von || s.d[i] > bis) continue;
            double ax = (s.lon[i] - lon) * kx, ay = (s.lat[i] - lat) * ky;
            double bx = (s.lon[i + 1] - lon) * kx, by = (s.lat[i + 1] - lat) * ky;
            double dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
            double t = l2 > 0 ? -(ax * dx + ay * dy) / l2 : 0;
            t = Math.max(0, Math.min(1, t));
            double px = ax + t * dx, py = ay + t * dy, abw = Math.sqrt(px * px + py * py);
            if (best == null || abw < best.abw - 0.01) best = new Lage(s.d[i] + t * (s.d[i + 1] - s.d[i]), abw);
        }
        return best;
    }

    /** Auf- und Abstieg mit Schwelle (Wackler des Höhenmodells zählen nicht). */
    public static double[] hoehenmeter(double[] eles, int von, double startEle, double schwelle) {
        double auf = 0, ab = 0, ref = startEle;
        for (int i = von; i < eles.length; i++) {
            double e = eles[i];
            if (Double.isNaN(e)) continue;
            if (Double.isNaN(ref)) { ref = e; continue; }
            double diff = e - ref;
            if (diff >= schwelle) { auf += diff; ref = e; }
            else if (diff <= -schwelle) { ab -= diff; ref = e; }
        }
        return new double[] { Math.round(auf), Math.round(ab) };
    }

    /** Gehzeit in Stunden nach DIN 33466; tempo 1 = normal, 0.7 = mit Kind. */
    public static double gehzeit(double meter, double auf, double ab, double tempo) {
        double h = meter / 1000 / 4, v = auf / 300 + ab / 500;
        return (Math.max(h, v) + Math.min(h, v) / 2) / (tempo > 0 ? tempo : 1);
    }

    public static double fahrzeit(double meter, double auf, double tempo) {
        return (meter / 1000 / 16 + auf / 600) / (tempo > 0 ? tempo : 1);
    }

    /** Was ab Meter d noch kommt; die Höhe an der Stelle selbst wird zwischen den Nachbarpunkten eingerechnet. */
    public static Rest rest(Strecke s, double d, double tempo, boolean rad) {
        int i = 0;
        while (i < s.groesse() && s.d[i] < d) i++;
        double start = Double.NaN;
        if (i > 0 && i < s.groesse() && !Double.isNaN(s.ele[i - 1]) && !Double.isNaN(s.ele[i]) && s.d[i] > s.d[i - 1]) {
            double t = (d - s.d[i - 1]) / (s.d[i] - s.d[i - 1]);
            start = s.ele[i - 1] + (s.ele[i] - s.ele[i - 1]) * t;
        }
        double[] hm = hoehenmeter(s.ele, i, start, 5);
        double m = Math.max(0, s.laenge() - d);
        return new Rest(m, hm[0], hm[1], rad ? fahrzeit(m, hm[0], tempo) : gehzeit(m, hm[0], hm[1], tempo));
    }

    /** Rest mit geänderter Zeit (z. B. plus Besichtigungen). */
    public static Rest restMit(double meter, double auf, double ab, double stunden) { return new Rest(meter, auf, ab, stunden); }

    /** Abbiegehinweis als Text (Befehlscodes von BRouter, wie R.hinweisText in der Web-App), null = keine Ansage. */
    public static String hinweisText(int cmd, int exit) {
        switch (cmd) {
            case 2: return "links abbiegen";
            case 3: return "leicht links";
            case 4: return "scharf links";
            case 5: return "rechts abbiegen";
            case 6: return "leicht rechts";
            case 7: return "scharf rechts";
            case 8: return "links halten";
            case 9: return "rechts halten";
            case 10: case 11: case 15: return "wenden";
            case 13: case 14: return exit > 0 ? "im Kreisverkehr die " + exit + ". Ausfahrt" : "in den Kreisverkehr";
            case 17: return "links ausfahren";
            case 18: return "rechts ausfahren";
            default: return null;
        }
    }

    /** Vorankündigung: „In 100 Metern links abbiegen.“ */
    public static String hinweisVorab(double bis, int cmd, int exit) {
        String t = hinweisText(cmd, exit);
        return t == null ? null : "In " + kmDativ(bis) + " " + t + ".";
    }

    /** Kurz davor: „Jetzt links abbiegen.“ */
    public static String hinweisJetzt(int cmd, int exit) {
        String t = hinweisText(cmd, exit);
        return t == null ? null : "Jetzt " + t + ".";
    }

    public static String kmText(double meter) {
        if (meter < 1000) return Math.round(meter) + " m";
        return String.format(Locale.GERMANY, meter < 10000 ? "%.1f km" : "%.0f km", meter / 1000);
    }

    /** Für Ansagen: „2,5 Kilometer“, „300 Meter“ (auf 50 m gerundet). */
    public static String kmSprache(double meter) {
        if (meter < 1000) return (Math.max(50, Math.round(meter / 50) * 50)) + " Meter";
        double km = Math.round(meter / 100) / 10.0;
        if (km == Math.floor(km)) return (long) km + (km == 1 ? " Kilometer" : " Kilometer");
        return String.format(Locale.GERMANY, "%.1f Kilometer", km);
    }

    /** Nach „in“: „100 Metern“, „1,5 Kilometern“, „1 Kilometer“ bleibt (ein Kilometer). */
    public static String kmDativ(double meter) {
        String s = kmSprache(meter);
        if (s.endsWith(" Meter")) return s + "n";
        if (s.endsWith(" Kilometer") && !s.equals("1 Kilometer")) return s + "n";
        return s.equals("1 Kilometer") ? "einem Kilometer" : s;
    }

    public static String zeitText(double stunden) {
        if (Double.isNaN(stunden) || Double.isInfinite(stunden)) return "–";
        long min = Math.round(stunden * 60 / 5) * 5;
        if (stunden > 0 && min == 0) min = 5;
        long h = min / 60, m = min % 60;
        return h > 0 ? String.format(Locale.GERMANY, "%d:%02d h", h, m) : m + " min";
    }

    public static String zeitSprache(double stunden) {
        long min = Math.max(5, Math.round(stunden * 60 / 5) * 5);
        long h = min / 60, m = min % 60;
        if (h == 0) return m + " Minuten";
        String sh = h == 1 ? "eine Stunde" : h + " Stunden";
        return m == 0 ? sh : sh + " " + m + " Minuten";
    }
}
