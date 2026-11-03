package io.github.thomasaurh.gipfelundgasse;

import android.content.Context;
import android.content.res.AssetManager;
import android.system.Os;
import android.util.Log;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashSet;
import java.util.Set;

/**
 * Profile und Routendaten für BRouter ohne Netz, gemeinsam für das Routing-Plugin (Planen) und den Navigationsdienst
 * (Umplanen unterwegs).
 */
final class BRouterDateien {
    private BRouterDateien() {}

    // Berechnungen nacheinander: Verweis-Ordner und Profile werden je Aufruf neu aufgebaut und dürfen sich nicht überschneiden
    static final Object SPERRE = new Object();
    static final Set<String> PROFILE = new HashSet<>(java.util.Arrays.asList("hiking-mountain", "trekking", "shortest"));
    private static final String TAG = "GipfelGasseRouting";

    private static File basis(Context c) { return new File(c.getFilesDir(), "brouter"); }

    /** Profile aus den App-Dateien kopieren, wenn sie fehlen oder von einer anderen BRouter-Fassung stammen. */
    static File profile(Context c) throws Exception {
        File dir = new File(basis(c), "profile");
        AssetManager am = c.getAssets();
        String fassung = lesen(am, "brouter/fassung.txt");
        File merker = new File(dir, "fassung.txt");
        if (!merker.isFile() || !fassung.equals(NaviService.dateiLesen(merker))) {
            if (!dir.exists() && !dir.mkdirs()) throw new Exception("Profilordner nicht anlegbar");
            for (String f : new String[] { "hiking-mountain.brf", "trekking.brf", "shortest.brf", "lookups.dat", "fassung.txt" }) {
                try (InputStream in = am.open("brouter/" + f); OutputStream out = new FileOutputStream(new File(dir, f))) {
                    byte[] b = new byte[16384];
                    int n;
                    while ((n = in.read(b)) > 0) out.write(b, 0, n);
                }
            }
        }
        return dir;
    }

    private static String lesen(AssetManager am, String pfad) throws Exception {
        try (InputStream in = am.open(pfad)) {
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            byte[] b = new byte[1024];
            int n;
            while ((n = in.read(b)) > 0) out.write(b, 0, n);
            return out.toString("UTF-8");
        }
    }

    /**
     * Ordner mit Verweisen auf die Routendaten aller Pakete unter den Namen, die BRouter erwartet (E10_N45.rd5).
     * Wird bei jedem Aufruf neu aufgebaut; das ist billig und folgt Installieren und Löschen ohne Buchführung.
     */
    static File segmente(Context c, Set<String> gefunden) throws Exception {
        File dir = new File(basis(c), "segmente");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("Ordner für Routendaten nicht anlegbar");
        File[] alt = dir.listFiles();
        if (alt != null) for (File f : alt) if (!f.delete()) Log.w(TAG, "alter Verweis bleibt: " + f);
        java.util.List<String> ids = new java.util.ArrayList<>();
        KartenServer.pakete(c, ids);
        for (String id : ids) {
            File[] fs = new File(KartenServer.ordner(c), id).listFiles();
            if (fs == null) continue;
            for (File f : fs) {
                String k = Routing.kachelAusName(f.getName());
                if (k == null || gefunden.contains(k)) continue;
                String ziel = new File(dir, k + ".rd5").getAbsolutePath();
                // ein alter Verweis, der sich oben nicht löschen ließ, darf nicht das ganze Offline-Routing kippen
                try { Os.remove(ziel); } catch (android.system.ErrnoException e) { /* war keiner da */ }
                try {
                    Os.symlink(f.getAbsolutePath(), ziel);
                    gefunden.add(k);
                } catch (android.system.ErrnoException e) {
                    Log.w(TAG, "Verweis auf Routendaten nicht anlegbar: " + k, e);
                }
            }
        }
        return dir;
    }

    /**
     * Route ohne Netz als GeoJSON (wie brouter.de); null, wenn für einen der Punkte keine Routendaten installiert sind.
     * @param punkte {Länge, Breite}
     */
    static String route(Context c, double[][] punkte, String profil, long maxMs) throws Exception {
        if (!PROFILE.contains(profil)) throw new Exception("unbekanntes Profil");
        synchronized (SPERRE) {
            Set<String> k = new HashSet<>();
            File seg = segmente(c, k);
            for (double[] q : punkte) if (!k.contains(Routing.kachel(q[0], q[1]))) return null;
            return Routing.route(seg, new File(profile(c), profil + ".brf"), punkte, maxMs);
        }
    }
}
