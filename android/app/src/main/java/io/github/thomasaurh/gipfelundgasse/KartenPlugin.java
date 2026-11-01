package io.github.thomasaurh.gipfelundgasse;

import android.app.DownloadManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.StatFs;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Offline-Kartenpakete: Liste holen, herunterladen (Android-Download-Manager, läuft im Hintergrund weiter),
 * Prüfsumme kontrollieren, löschen. Die Oberfläche liest die Dateien danach über {@link KartenServer}.
 * JS: const Karten = Capacitor.registerPlugin('Karten');
 *   Karten.liste({ index })          → { installiert: [meta…], verfuegbar: {…}|null, fehler, frei }
 *   Karten.laden({ id, dateien, meta }) → startet den Download
 *   Karten.status()                  → { laufend: [{ id, geladen, gesamt, zustand, meldung }] }
 *   Karten.loeschen({ id })
 */
@CapacitorPlugin(name = "Karten")
public class KartenPlugin extends Plugin {
    private static final String TAG = "GipfelGasseKarten";
    private static final String PREFS = "kartenpakete";
    private final Set<String> pruefenLaeuft = new HashSet<>();
    private final JSObject fehlerJe = new JSObject();

    private SharedPreferences prefs() { return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    @PluginMethod
    public void liste(PluginCall call) {
        String index = call.getString("index", null);
        new Thread(() -> {
            JSObject o = new JSObject();
            o.put("installiert", installiert());
            try {
                File f = KartenServer.ordner(getContext());
                o.put("frei", new StatFs(f.getAbsolutePath()).getAvailableBytes());
            } catch (Exception e) { /* egal */ }
            if (index != null && index.startsWith("https://")) {
                try {
                    o.put("verfuegbar", new JSONObject(holen(index)));
                } catch (Exception e) {
                    o.put("fehler", "Liste der Kartenpakete nicht erreichbar: " + e.getMessage());
                }
            }
            call.resolve(o);
        }).start();
    }

    /** Liest https-Text (ohne CORS-Grenzen der WebView), folgt Weiterleitungen (GitHub-Releases). */
    private static String holen(String adresse) throws Exception {
        URL url = new URL(adresse);
        for (int i = 0; i < 5; i++) {
            HttpURLConnection c = (HttpURLConnection) url.openConnection();
            c.setConnectTimeout(15000); c.setReadTimeout(20000);
            c.setInstanceFollowRedirects(false);
            c.setRequestProperty("User-Agent", "GipfelUndGasse-App");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400) { url = new URL(url, c.getHeaderField("Location")); c.disconnect(); continue; }
            if (code != 200) throw new Exception("Fehler " + code);
            try (InputStream in = c.getInputStream()) {
                java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                byte[] b = new byte[16384];
                int n;
                while ((n = in.read(b)) > 0) out.write(b, 0, n);
                return out.toString("UTF-8");
            }
        }
        throw new Exception("zu viele Weiterleitungen");
    }

    private JSArray installiert() {
        File[] alte = KartenServer.ordner(getContext()).listFiles((d, n) -> n.startsWith(".alt-"));
        if (alte != null) for (File f : alte) { String id = f.getName().substring(5); synchronized (sperre(id)) { aufraeumen(id); } }
        JSArray a = new JSArray();
        List<String> ids = new ArrayList<>();
        KartenServer.pakete(getContext(), ids);
        for (String id : ids) {
            try {
                File meta = new File(new File(KartenServer.ordner(getContext()), id), "paket.json");
                a.put(new JSONObject(NaviService.dateiLesen(meta)));
            } catch (Exception e) { Log.w(TAG, "paket.json unlesbar: " + id, e); }
        }
        return a;
    }

    // ---------- Laden, Prüfen, Austauschen ----------
    // Ablauf je Paket: Download in den Vorbereitungsordner .neu-<id>, Prüfsummen, paket.json dort schreiben, dann Austausch
    // (alter Ordner → .alt-<id>, .neu-<id> → <id>, .alt-<id> löschen). Jeder Ladeauftrag hat eine Kennung („gen“); ein
    // Prüfvorgang aktiviert nur, wenn seine Kennung noch gilt. Alles je Paket unter einer Sperre.
    private final java.util.Map<String, Object> sperren = new java.util.HashMap<>();

    private Object sperre(String id) { synchronized (sperren) { return sperren.computeIfAbsent(id, k -> new Object()); } }

    private File neuOrdner(String id) { return new File(KartenServer.ordner(getContext()), ".neu-" + id); }
    private File altOrdner(String id) { return new File(KartenServer.ordner(getContext()), ".alt-" + id); }
    private File paketOrdner(String id) { return new File(KartenServer.ordner(getContext()), id); }

    private static void ordnerLoeschen(File d) {
        File[] fs = d.listFiles();
        if (fs != null) for (File f : fs) if (!f.delete()) Log.w(TAG, "nicht löschbar: " + f);
        if (d.exists() && !d.delete()) Log.w(TAG, "Ordner nicht löschbar: " + d);
    }

    /** Nach einem Abbruch mitten im Austausch: alten Stand zurückholen bzw. Reste entfernen. */
    private void aufraeumen(String id) {
        File alt = altOrdner(id), ziel = paketOrdner(id);
        if (alt.exists()) {
            if (!new File(ziel, "paket.json").isFile()) { ordnerLoeschen(ziel); if (!alt.renameTo(ziel)) Log.w(TAG, "alter Stand nicht zurückholbar: " + id); }
            else ordnerLoeschen(alt);
        }
    }

    private void auftraegeEntfernen(DownloadManager dm, String eintragText) {
        if (eintragText == null) return;
        try {
            JSONArray auftraege = new JSONObject(eintragText).getJSONArray("auftraege");
            for (int i = 0; i < auftraege.length(); i++) { long dl = auftraege.getJSONObject(i).optLong("dl", -1); if (dl >= 0) dm.remove(dl); }
        } catch (Exception e) { Log.w(TAG, "alte Aufträge nicht entfernbar", e); }
    }

    @PluginMethod
    public void laden(PluginCall call) {
        String id = call.getString("id", "");
        JSArray dateien = call.getArray("dateien", null);
        JSObject meta = call.getObject("meta", new JSObject());
        if (!Bereich.sichererName(id) || dateien == null || dateien.length() == 0) { call.reject("Ungültiges Paket"); return; }
        DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        synchronized (sperre(id)) {
            aufraeumen(id);
            // ein früherer Versuch für dieses Paket: dessen Aufträge beenden, Vorbereitungsordner leeren
            auftraegeEntfernen(dm, prefs().getString(id, null));
            prefs().edit().remove(id).apply();
            fehlerJe.remove(id);
            File dir = neuOrdner(id);
            ordnerLoeschen(dir);
            if (!dir.mkdirs()) { call.reject("Ordner nicht anlegbar"); return; }
            // installiertes Paket: unveränderte Dateien (gleiche Prüfsumme) werden übernommen statt neu geladen
            JSONObject installiert = null;
            try { installiert = new JSONObject(NaviService.dateiLesen(new File(paketOrdner(id), "paket.json"))); } catch (Exception e) { /* noch keins */ }
            long noetig = 0;
            for (int i = 0; i < dateien.length(); i++) {
                JSONObject d = dateien.optJSONObject(i);
                if (d != null && !Bereich.gleicheDatei(installiert, d.optString("name"), d.optString("sha256", ""), d.optLong("groesse", 0))) noetig += d.optLong("groesse", 0);
            }
            try {
                long frei = new StatFs(dir.getAbsolutePath()).getAvailableBytes();
                if (noetig > 0 && frei < noetig + 200L * 1024 * 1024) {
                    call.reject("Zu wenig Speicher: nötig " + (noetig / 1048576) + " MB, frei " + (frei / 1048576) + " MB.");
                    return;
                }
            } catch (Exception e) { /* weiter versuchen */ }
            List<Long> angelegt = new ArrayList<>();
            try {
                JSONArray auftraege = new JSONArray();
                for (int i = 0; i < dateien.length(); i++) {
                    JSONObject d = dateien.getJSONObject(i);
                    String name = d.getString("name");
                    if (!Bereich.sichererName(name) || !d.getString("url").startsWith("https://")) throw new Exception("Ungültige Datei " + name);
                    if (Bereich.gleicheDatei(installiert, name, d.optString("sha256", ""), d.optLong("groesse", 0))
                        && new File(paketOrdner(id), name).isFile()) {
                        JSONObject a = new JSONObject();
                        a.put("dl", -1); a.put("uebernehmen", true); a.put("name", name); a.put("sha256", d.optString("sha256", "")); a.put("groesse", d.optLong("groesse", 0));
                        auftraege.put(a);
                        continue;
                    }
                    DownloadManager.Request r = new DownloadManager.Request(Uri.parse(d.getString("url")))
                        .setTitle("Kartenpaket " + meta.optString("name", id))
                        .setDescription(name)
                        .setDestinationUri(Uri.fromFile(new File(dir, name)))
                        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                        .setAllowedOverMetered(call.getBoolean("mobil", false));
                    long dl = dm.enqueue(r);
                    angelegt.add(dl);
                    JSONObject a = new JSONObject();
                    a.put("dl", dl); a.put("name", name); a.put("sha256", d.optString("sha256", "")); a.put("groesse", d.optLong("groesse", 0));
                    auftraege.put(a);
                }
                JSONObject eintrag = new JSONObject();
                eintrag.put("gen", java.util.UUID.randomUUID().toString());
                eintrag.put("auftraege", auftraege);
                eintrag.put("meta", meta);
                prefs().edit().putString(id, eintrag.toString()).apply();
                call.resolve();
            } catch (Exception e) {
                for (long dl : angelegt) dm.remove(dl);   // halb angelegten Versuch zurückrollen
                ordnerLoeschen(dir);
                call.reject("Download ging nicht: " + e.getMessage());
            }
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        JSArray laufend = new JSArray();
        for (String id : prefs().getAll().keySet()) {
            JSObject s = new JSObject();
            s.put("id", id);
            try {
                JSONObject eintrag = new JSONObject(prefs().getString(id, "{}"));
                s.put("name", eintrag.optJSONObject("meta") != null ? eintrag.getJSONObject("meta").optString("name", id) : id);
                JSONArray auftraege = eintrag.getJSONArray("auftraege");
                long geladen = 0, gesamt = 0;
                boolean alleFertig = true, fehler = false;
                String meldung = "";
                for (int i = 0; i < auftraege.length(); i++) {
                    JSONObject a = auftraege.getJSONObject(i);
                    if (a.optBoolean("uebernehmen")) continue;   // kommt beim Abschluss aus dem installierten Paket
                    try (Cursor c = dm.query(new DownloadManager.Query().setFilterById(a.getLong("dl")))) {
                        if (c == null || !c.moveToFirst()) { fehler = true; meldung = "Download verschwunden"; alleFertig = false; continue; }
                        int st = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                        long so = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                        long ges = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                        geladen += Math.max(0, so);
                        gesamt += ges > 0 ? ges : a.optLong("groesse", 0);
                        if (st == DownloadManager.STATUS_FAILED) {
                            fehler = true;
                            meldung = "Download fehlgeschlagen (Grund " + c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)) + ")";
                        }
                        if (st == DownloadManager.STATUS_PAUSED) meldung = "wartet (WLAN oder Netz)";
                        if (st != DownloadManager.STATUS_SUCCESSFUL) alleFertig = false;
                    }
                }
                s.put("geladen", geladen);
                s.put("gesamt", gesamt);
                if (fehlerJe.has(id)) { s.put("zustand", "fehler"); s.put("meldung", fehlerJe.getString(id)); }
                else if (fehler) { s.put("zustand", "fehler"); s.put("meldung", meldung); }
                else if (alleFertig) { s.put("zustand", "pruefen"); abschliessen(id, eintrag); }
                else { s.put("zustand", "laedt"); s.put("meldung", meldung); }
            } catch (Exception e) {
                s.put("zustand", "fehler");
                s.put("meldung", e.getMessage());
            }
            laufend.put(s);
        }
        JSObject o = new JSObject();
        o.put("laufend", laufend);
        call.resolve(o);
    }

    /** Prüfsummen im Vorbereitungsordner kontrollieren, dann austauschen (im Hintergrund). */
    private void abschliessen(String id, JSONObject eintrag) {
        synchronized (pruefenLaeuft) { if (!pruefenLaeuft.add(id)) return; }
        final String gen = eintrag.optString("gen", "");
        new Thread(() -> {
            try {
                File dir = neuOrdner(id);
                JSONArray auftraege = eintrag.getJSONArray("auftraege");
                for (int i = 0; i < auftraege.length(); i++) {
                    JSONObject a = auftraege.getJSONObject(i);
                    if (a.optBoolean("uebernehmen")) uebernehmen(new File(paketOrdner(id), a.getString("name")), new File(dir, a.getString("name")));
                    String soll = a.optString("sha256", "");
                    if (!soll.isEmpty() && !soll.equalsIgnoreCase(sha256(new File(dir, a.getString("name"))))) {
                        throw new Exception("Prüfsumme von " + a.getString("name") + " stimmt nicht (Download beschädigt). Bitte neu laden.");
                    }
                }
                synchronized (sperre(id)) {
                    // gilt dieser Auftrag noch? (Zwischendurch gelöscht oder neu gestartet: nichts aktivieren)
                    String jetzt = prefs().getString(id, null);
                    if (jetzt == null || !gen.equals(new JSONObject(jetzt).optString("gen", ""))) return;
                    JSONObject meta = eintrag.getJSONObject("meta");
                    meta.put("installiertAm", System.currentTimeMillis());
                    try (FileOutputStream out = new FileOutputStream(new File(dir, "paket.json"))) {
                        out.write(meta.toString().getBytes(StandardCharsets.UTF_8));
                    }
                    File ziel = paketOrdner(id), alt = altOrdner(id);
                    ordnerLoeschen(alt);
                    if (ziel.exists() && !ziel.renameTo(alt)) throw new Exception("alter Stand nicht beiseitelegbar");
                    if (!dir.renameTo(ziel)) {
                        if (alt.exists() && !alt.renameTo(ziel)) Log.w(TAG, "alter Stand nicht zurückholbar");
                        throw new Exception("neuer Stand nicht aktivierbar");
                    }
                    ordnerLoeschen(alt);
                    DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
                    for (int i = 0; i < auftraege.length(); i++) { long dl = auftraege.getJSONObject(i).optLong("dl", -1); if (dl >= 0) dm.remove(dl); }
                    prefs().edit().remove(id).apply();
                }
                notifyListeners("fertig", new JSObject().put("id", id));
            } catch (Exception e) {
                Log.e(TAG, "Paket " + id + " nicht abschließbar", e);
                try { fehlerJe.put(id, e.getMessage()); } catch (Exception ignored) { /* egal */ }
            } finally {
                synchronized (pruefenLaeuft) { pruefenLaeuft.remove(id); }
            }
        }).start();
    }

    /** Datei aus dem installierten Paket in den Vorbereitungsordner: als harter Verweis (sofort), sonst als Kopie. */
    private static void uebernehmen(File von, File nach) throws Exception {
        if (nach.isFile()) return;
        if (!von.isFile()) throw new Exception("Datei " + von.getName() + " fehlt im installierten Paket. Bitte neu laden.");
        try {
            android.system.Os.link(von.getAbsolutePath(), nach.getAbsolutePath());
            return;
        } catch (Exception e) { Log.i(TAG, "kein harter Verweis möglich, kopiere " + von.getName()); }
        File tmp = new File(nach.getParentFile(), nach.getName() + ".teil");
        try (FileInputStream in = new FileInputStream(von); FileOutputStream out = new FileOutputStream(tmp)) {
            byte[] b = new byte[1 << 16];
            int n;
            while ((n = in.read(b)) > 0) out.write(b, 0, n);
        }
        if (!tmp.renameTo(nach)) throw new Exception("Kopie von " + von.getName() + " nicht ablegbar");
    }

    static String sha256(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (FileInputStream in = new FileInputStream(f)) {
            byte[] b = new byte[1 << 16];
            int n;
            while ((n = in.read(b)) > 0) md.update(b, 0, n);
        }
        StringBuilder sb = new StringBuilder();
        for (byte x : md.digest()) sb.append(String.format("%02x", x));
        return sb.toString();
    }

    @PluginMethod
    public void loeschen(PluginCall call) {
        String id = call.getString("id", "");
        if (!Bereich.sichererName(id)) { call.reject("Ungültiges Paket"); return; }
        DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        synchronized (sperre(id)) {
            auftraegeEntfernen(dm, prefs().getString(id, null));
            prefs().edit().remove(id).apply();   // ein laufender Prüfvorgang sieht danach keine gültige Kennung mehr
            fehlerJe.remove(id);
            ordnerLoeschen(neuOrdner(id));
            ordnerLoeschen(altOrdner(id));
            ordnerLoeschen(paketOrdner(id));
        }
        call.resolve();
    }
}
