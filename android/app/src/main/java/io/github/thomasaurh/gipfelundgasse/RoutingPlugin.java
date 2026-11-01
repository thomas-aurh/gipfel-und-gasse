package io.github.thomasaurh.gipfelundgasse;

import android.content.Context;
import android.content.res.AssetManager;
import android.system.Os;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;

/**
 * Routen ohne Netz mit BRouter auf den Routendaten der installierten Kartenpakete.
 * JS: const Routing = Capacitor.registerPlugin('Routing');
 *   Routing.kacheln()                          → { kacheln: ["E10_N45", …] }  (vorhandene Routendaten)
 *   Routing.route({ punkte: [[lon, lat], …], profil: "hiking-mountain" }) → { geojson }
 * Die Antwort ist dasselbe GeoJSON wie von brouter.de; Fehlermeldungen sind die von BRouter (z. B. „position not mapped“).
 */
@CapacitorPlugin(name = "Routing")
public class RoutingPlugin extends Plugin {
    // Berechnungen nacheinander: Verweis-Ordner und Profile werden je Aufruf neu aufgebaut und dürfen sich nicht überschneiden
    private static final Object SPERRE = new Object();
    private static final String TAG = "GipfelGasseRouting";
    private static final Set<String> PROFILE = new HashSet<>(java.util.Arrays.asList("hiking-mountain", "trekking", "shortest"));

    private File basis() { return new File(getContext().getFilesDir(), "brouter"); }

    /** Profile aus den App-Dateien kopieren, wenn sie fehlen oder von einer anderen BRouter-Fassung stammen. */
    private File profile() throws Exception {
        File dir = new File(basis(), "profile");
        AssetManager am = getContext().getAssets();
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
    private File segmente(Set<String> gefunden) throws Exception {
        File dir = new File(basis(), "segmente");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("Ordner für Routendaten nicht anlegbar");
        File[] alt = dir.listFiles();
        if (alt != null) for (File f : alt) if (!f.delete()) Log.w(TAG, "alter Verweis bleibt: " + f);
        java.util.List<String> ids = new java.util.ArrayList<>();
        KartenServer.pakete(getContext(), ids);
        for (String id : ids) {
            File[] fs = new File(KartenServer.ordner(getContext()), id).listFiles();
            if (fs == null) continue;
            for (File f : fs) {
                String k = Routing.kachelAusName(f.getName());
                if (k == null || gefunden.contains(k)) continue;
                Os.symlink(f.getAbsolutePath(), new File(dir, k + ".rd5").getAbsolutePath());
                gefunden.add(k);
            }
        }
        return dir;
    }

    @PluginMethod
    public void kacheln(PluginCall call) {
        try {
            Set<String> k = new HashSet<>();
            synchronized (SPERRE) { segmente(k); }
            JSObject o = new JSObject();
            o.put("kacheln", new JSArray(k));
            call.resolve(o);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void route(PluginCall call) {
        JSArray punkte = call.getArray("punkte", null);
        String profil = call.getString("profil", "hiking-mountain");
        if (punkte == null || punkte.length() < 2 || !PROFILE.contains(profil)) { call.reject("Ungültige Anfrage"); return; }
        new Thread(() -> {
            try {
                double[][] p = new double[punkte.length()][];
                for (int i = 0; i < p.length; i++) {
                    JSONArray q = punkte.getJSONArray(i);
                    p[i] = new double[] { q.getDouble(0), q.getDouble(1) };
                }
                String geojson;
                synchronized (SPERRE) {
                    Set<String> k = new HashSet<>();
                    File seg = segmente(k);
                    for (double[] q : p) {
                        if (!k.contains(Routing.kachel(q[0], q[1]))) throw new Exception("keine Routendaten für diese Gegend (Kartenpaket fehlt)");
                    }
                    geojson = Routing.route(seg, new File(profile(), profil + ".brf"), p, 60000);
                }
                JSObject o = new JSObject();
                o.put("geojson", geojson);
                call.resolve(o);
            } catch (Throwable e) {
                Log.w(TAG, "Route nicht berechenbar", e);
                call.reject(e.getMessage() != null ? e.getMessage() : e.toString());
            }
        }).start();
    }
}
