package io.github.thomasaurh.gipfelundgasse;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Umplanen beim Navigieren, ohne Android-Klassen (damit es als JUnit-Test läuft): Wer von der Route abkommt, bekommt
 * ab dem Standort eine neue Route zum nächsten noch nicht erreichten Ziel, danach über die übrigen Ziele wie geplant.
 * Ziele sind {Breite, Länge, Meter ab Start, Besichtigungsminuten}; Namen liegen daneben in einer eigenen Liste.
 */
public final class Umplanen {
    private Umplanen() {}

    /** Ein Ziel gilt als erreicht, wenn der Fortschritt höchstens so viele Meter davor liegt. */
    static final double ERREICHT = 30;

    /** Index des ersten noch offenen Ziels; −1, wenn keines mehr offen ist. Ohne Fortschritt (nie auf der Route) alle. */
    public static int naechstes(List<double[]> ziele, double fortschritt) {
        double ab = Double.isNaN(fortschritt) ? Double.NEGATIVE_INFINITY : fortschritt + ERREICHT;
        for (int i = 0; i < ziele.size(); i++) if (ziele.get(i)[2] > ab) return i;
        return -1;
    }

    /** Wegpunkte für BRouter als {Länge, Breite}: Standort, dann die offenen Ziele ab {@code ab}. */
    public static double[][] punkte(double lat, double lon, List<double[]> ziele, int ab) {
        double[][] p = new double[1 + ziele.size() - ab][];
        p[0] = new double[] { lon, lat };
        for (int i = ab; i < ziele.size(); i++) p[1 + i - ab] = new double[] { ziele.get(i)[1], ziele.get(i)[0] };
        return p;
    }

    /** Dieselbe Anfrage wie die Web-App an brouter.de (web/src/10-dienste.js), nur mit mehreren Punkten. */
    public static String url(String basis, double[][] punkte, String profil) {
        StringBuilder s = new StringBuilder(basis).append("?lonlats=");
        for (int i = 0; i < punkte.length; i++) {
            if (i > 0) s.append('|');
            s.append(String.format(Locale.ROOT, "%.6f,%.6f", punkte[i][0], punkte[i][1]));
        }
        return s.append("&profile=").append(profil)
            .append("&alternativeidx=0&format=geojson&timode=2&profile:turnInstructionRoundabouts=1").toString();
    }

    /** Neue Route: Strecke, Abbiegehinweise {Meter, Befehl, Ausfahrt} und die Meter der offenen Ziele darauf. */
    public static final class Neu {
        public final NaviRechnen.Strecke strecke;
        public final List<double[]> hinweise;
        public final double[] zielMeter;
        Neu(NaviRechnen.Strecke s, List<double[]> h, double[] z) { strecke = s; hinweise = h; zielMeter = z; }
    }

    /**
     * Antwort von BRouter (GeoJSON, online wie offline gleich) lesen, wie R.brouterLesen in der Web-App.
     * @param ziele die offenen Ziele in Reihenfolge; ihre Lage auf der neuen Strecke wird der Reihe nach gesucht
     */
    public static Neu lesen(String geojson, List<double[]> ziele) throws Exception {
        JSONObject f = new JSONObject(geojson).getJSONArray("features").getJSONObject(0);
        JSONArray c = f.getJSONObject("geometry").getJSONArray("coordinates");
        int n = c.length();
        if (n < 2) throw new Exception("BRouter: keine Route in der Antwort");
        double[] lat = new double[n], lon = new double[n], ele = new double[n];
        for (int i = 0; i < n; i++) {
            JSONArray p = c.getJSONArray(i);
            lon[i] = p.getDouble(0); lat[i] = p.getDouble(1);
            ele[i] = p.length() > 2 && !p.isNull(2) ? p.getDouble(2) : Double.NaN;
        }
        NaviRechnen.Strecke s = new NaviRechnen.Strecke(lat, lon, ele);
        List<double[]> h = new ArrayList<>();
        JSONObject props = f.optJSONObject("properties");
        JSONArray vh = props == null ? null : props.optJSONArray("voicehints");
        if (vh != null) for (int i = 0; i < vh.length(); i++) {
            JSONArray v = vh.optJSONArray(i);
            if (v == null || v.length() < 2) continue;
            int idx = v.optInt(0, -1);
            if (idx < 0 || idx >= n) continue;
            // Kreisverkehr links (14): Ausfahrt negativ
            h.add(new double[] { s.d[idx], v.optInt(1), Math.abs(v.optInt(2, 0)) });
        }
        // offene Ziele der Reihe nach auf der Strecke suchen (BRouter legt die Route durch jeden Punkt); das letzte ist das Ende
        double[] z = new double[ziele.size()];
        int von = 0;
        for (int k = 0; k < ziele.size(); k++) {
            if (k == ziele.size() - 1) { z[k] = s.laenge(); break; }
            int best = von;
            double bestAbw = Double.MAX_VALUE;
            for (int i = von; i < n; i++) {
                double a = NaviRechnen.abstand(lat[i], lon[i], ziele.get(k)[0], ziele.get(k)[1]);
                if (a < bestAbw) { bestAbw = a; best = i; }
            }
            z[k] = s.d[best];
            von = best;
        }
        return new Neu(s, h, z);
    }
}
