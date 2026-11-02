package io.github.thomasaurh.gipfelundgasse;

import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
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
    private static final String TAG = "GipfelGasseRouting";
    private static final Set<String> PROFILE = BRouterDateien.PROFILE;

    @PluginMethod
    public void kacheln(PluginCall call) {
        try {
            Set<String> k = new HashSet<>();
            synchronized (BRouterDateien.SPERRE) { BRouterDateien.segmente(getContext(), k); }
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
                String geojson = BRouterDateien.route(getContext(), p, profil, 60000);
                if (geojson == null) throw new Exception("keine Routendaten für diese Gegend (Kartenpaket fehlt)");
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
