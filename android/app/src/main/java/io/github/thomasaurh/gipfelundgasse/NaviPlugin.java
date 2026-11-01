package io.github.thomasaurh.gipfelundgasse;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.net.Uri;
import android.os.Build;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Brücke zwischen Oberfläche (JavaScript) und Navigationsdienst.
 * JS: const Navi = Capacitor.registerPlugin('Navi');
 *   Navi.starten({ pts, stopps, tempo, rad, folgen, aufzeichnen, ansagen })  startet oder ändert die Sitzung
 *   Navi.status()                    → Zustand (auch nach einem Neustart der Oberfläche)
 *   Navi.aufzeichnungHolen({ leeren }) → { start, spur: [[lat, lon, ele, zeit], …] }
 *   Navi.teilen({ name, text, mime }) → Datei über das Teilen-Menü von Android weitergeben (z. B. GPX an CoMaps)
 *   Navi.drucken({ name })           → Druckdialog von Android für die aktuelle Seite
 *   Ereignis "position": { lat, lon, gen, rest, abw, aufz }
 */
@CapacitorPlugin(
    name = "Navi",
    permissions = {
        @Permission(alias = "standort", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = "mitteilungen", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class NaviPlugin extends Plugin {

    @Override
    public void load() {
        NaviService.Z.beiNeuem = () -> getBridge().executeOnMainThread(() -> notifyListeners("position", stand()));
    }

    @PluginMethod
    public void starten(PluginCall call) {
        if (getPermissionState("standort") != PermissionState.GRANTED) {
            requestPermissionForAlias("standort", call, "nachStandort");
            return;
        }
        nachStandort(call);
    }

    @PermissionCallback
    private void nachStandort(PluginCall call) {
        if (getPermissionState("standort") != PermissionState.GRANTED) {
            call.reject("Ohne Standort-Erlaubnis geht es nicht. In den Android-Einstellungen unter Apps › Gipfel & Gasse › Berechtigungen freigeben.", "KEIN_STANDORT");
            return;
        }
        // Mitteilungen (ab Android 13): ohne sie läuft der Dienst trotzdem, nur unsichtbar
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("mitteilungen") != PermissionState.GRANTED) {
            requestPermissionForAlias("mitteilungen", call, "nachMitteilungen");
            return;
        }
        nachMitteilungen(call);
    }

    @PermissionCallback
    private void nachMitteilungen(PluginCall call) {
        NaviService.Zustand z = NaviService.Z;
        synchronized (z) {
            JSArray pts = call.getArray("pts", null);
            if (pts != null && pts.length() > 1) {
                int n = pts.length();
                double[] lat = new double[n], lon = new double[n], ele = new double[n];
                for (int i = 0; i < n; i++) {
                    JSONArray p = pts.optJSONArray(i);
                    lat[i] = p.optDouble(0); lon[i] = p.optDouble(1);
                    ele[i] = p.isNull(2) ? Double.NaN : p.optDouble(2, Double.NaN);
                }
                z.strecke = new NaviRechnen.Strecke(lat, lon, ele);
            }
            JSArray stopps = call.getArray("stopps", null);
            if (stopps != null) {
                z.stopps = new ArrayList<>();
                z.stoppNamen = new ArrayList<>();
                for (int i = 0; i < stopps.length(); i++) {
                    JSONObject s = stopps.optJSONObject(i);
                    if (s == null) continue;
                    z.stopps.add(new double[] { s.optDouble("d", 0), s.optDouble("min", 0) });
                    z.stoppNamen.add(s.optString("name", "Stopp"));
                }
            }
            z.tempo = call.getDouble("tempo", z.tempo);
            z.rad = call.getBoolean("rad", z.rad);
            z.ansagen = call.getBoolean("ansagen", z.ansagen);
            boolean warFolgen = z.folgen;
            z.folgen = call.getBoolean("folgen", z.folgen) && z.strecke != null;
            if (!z.folgen || !warFolgen) z.folgenSeit = 0;   // neu gestartet: Begrüßung und Ansagen von vorn
            else if (pts != null) {
                // Route während der Fahrt geändert: ohne neue Begrüßung weiter, Stopps neu zählen
                z.fortschritt = Double.NaN;
                z.stoppAngekuendigt = new boolean[z.stopps.size()];
                z.stoppErreicht = new boolean[z.stopps.size()];
                z.zielGemeldet = false;
            }
            boolean warAufz = z.aufzeichnen;
            z.aufzeichnen = call.getBoolean("aufzeichnen", z.aufzeichnen);
            if (z.aufzeichnen && !warAufz) z.aufzStart = 0;    // neue Aufzeichnung
        }
        Context c = getContext();
        Intent i = new Intent(c, NaviService.class);
        if (z.folgen || z.aufzeichnen) {
            ContextCompat.startForegroundService(c, i);
        } else if (z.laeuft) {
            c.startService(new Intent(c, NaviService.class).setAction(NaviService.AKTION_BEENDEN));
        }
        call.resolve(stand());
    }

    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(stand());
    }

    @PluginMethod
    public void aufzeichnungHolen(PluginCall call) {
        NaviService.Zustand z = NaviService.Z;
        JSObject o = new JSObject();
        JSArray a = new JSArray();
        long start;
        synchronized (z) {
            List<double[]> spur = z.spur;
            start = z.aufzStart;
            if (spur.isEmpty()) {
                // nach einem Neustart: die gesicherte Datei lesen
                try {
                    File f = new File(getContext().getFilesDir(), "aufzeichnung.json");
                    if (f.exists()) {
                        byte[] b = new byte[(int) f.length()];
                        try (FileInputStream in = new FileInputStream(f)) { int gelesen = in.read(b); if (gelesen < b.length) b = java.util.Arrays.copyOf(b, Math.max(0, gelesen)); }
                        JSONObject g = new JSONObject(new String(b, StandardCharsets.UTF_8));
                        start = g.optLong("start", 0);
                        JSONArray s = g.optJSONArray("spur");
                        if (s != null) for (int i = 0; i < s.length(); i++) a.put(s.optJSONArray(i));
                    }
                } catch (Exception e) { /* nichts gesichert */ }
            } else {
                for (double[] p : spur) {
                    JSONArray q = new JSONArray();
                    try { q.put(p[0]); q.put(p[1]); q.put(Double.isNaN(p[2]) ? JSONObject.NULL : p[2]); q.put((long) p[3]); } catch (Exception e) { continue; }
                    a.put(q);
                }
            }
            if (call.getBoolean("leeren", false) && !z.aufzeichnen) {
                z.spur.clear(); z.aufzStart = 0; z.aufzMeter = 0;
                new File(getContext().getFilesDir(), "aufzeichnung.json").delete();
            }
        }
        o.put("start", start);
        o.put("spur", a);
        call.resolve(o);
    }

    /** Datei über das Teilen-Menü weitergeben (WebView kann keine Downloads). */
    @PluginMethod
    public void teilen(PluginCall call) {
        String name = call.getString("name", "tour.gpx").replaceAll("[^\\w.\\- äöüÄÖÜß]", "_");
        String text = call.getString("text", "");
        String mime = call.getString("mime", "application/gpx+xml");
        try {
            File ordner = new File(getContext().getCacheDir(), "teilen");
            if (!ordner.exists() && !ordner.mkdirs()) throw new Exception("Ordner nicht anlegbar");
            File f = new File(ordner, name);
            try (FileOutputStream out = new FileOutputStream(f)) { out.write(text.getBytes(StandardCharsets.UTF_8)); }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent senden = new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri)
                .putExtra(Intent.EXTRA_SUBJECT, name).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent wahl = Intent.createChooser(senden, "Weitergeben an …");
            wahl.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(wahl);
            call.resolve();
        } catch (Exception e) {
            call.reject("Teilen ging nicht: " + e.getMessage());
        }
    }

    /** Druckdialog von Android (dort auch „Als PDF speichern“). */
    @PluginMethod
    public void drucken(PluginCall call) {
        String name = call.getString("name", "Gipfel und Gasse");
        getBridge().executeOnMainThread(() -> {
            try {
                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                PrintDocumentAdapter innen = getBridge().getWebView().createPrintDocumentAdapter(name);
                pm.print(name, new FertigMelder(innen, call), new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            } catch (Exception e) {
                call.reject("Drucken ging nicht: " + e.getMessage());
            }
        });
    }

    /** Reicht alles an den Druck-Adapter der WebView weiter und meldet, wenn der Dialog fertig ist. */
    private static final class FertigMelder extends PrintDocumentAdapter {
        private final PrintDocumentAdapter innen;
        private final PluginCall call;
        FertigMelder(PrintDocumentAdapter innen, PluginCall call) { this.innen = innen; this.call = call; }
        @Override public void onStart() { innen.onStart(); }
        @Override public void onLayout(PrintAttributes alt, PrintAttributes neu, android.os.CancellationSignal abbruch,
                                       LayoutResultCallback cb, android.os.Bundle extras) { innen.onLayout(alt, neu, abbruch, cb, extras); }
        @Override public void onWrite(android.print.PageRange[] seiten, android.os.ParcelFileDescriptor ziel,
                                      android.os.CancellationSignal abbruch, WriteResultCallback cb) { innen.onWrite(seiten, ziel, abbruch, cb); }
        @Override public void onFinish() { innen.onFinish(); call.resolve(); }
    }

    private JSObject stand() {
        NaviService.Zustand z = NaviService.Z;
        JSObject o = new JSObject();
        synchronized (z) {
            o.put("laeuft", z.laeuft);
            o.put("folgen", z.folgen);
            o.put("aufzeichnen", z.aufzeichnen);
            Location l = z.letzte;
            if (l != null) {
                o.put("lat", l.getLatitude());
                o.put("lon", l.getLongitude());
                o.put("gen", l.hasAccuracy() ? l.getAccuracy() : null);
                o.put("t", l.getTime());
            }
            if (z.folgen && z.rest != null) {
                JSObject r = new JSObject();
                r.put("meter", z.rest.meter);
                r.put("auf", z.rest.auf);
                r.put("stunden", z.rest.stunden);
                o.put("rest", r);
                o.put("abw", Double.isNaN(z.abw) ? null : z.abw);
                o.put("abseits", z.abseitsGemeldet);
            }
            if (z.aufzStart != 0) {
                JSObject a = new JSObject();
                a.put("meter", z.aufzMeter);
                a.put("start", z.aufzStart);
                a.put("punkte", z.spur.size());
                double[] hm = NaviRechnen.hoehenmeter(eles(z.spur), 0, Double.NaN, 8);
                a.put("auf", hm[0]);
                o.put("aufz", a);
            }
        }
        return o;
    }

    private static double[] eles(List<double[]> spur) {
        double[] e = new double[spur.size()];
        for (int i = 0; i < e.length; i++) e[i] = spur.get(i)[2];
        return e;
    }
}
