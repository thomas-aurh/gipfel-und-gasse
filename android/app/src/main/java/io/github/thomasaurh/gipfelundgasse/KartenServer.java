package io.github.thomasaurh.gipfelundgasse;

import android.content.Context;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;
import java.io.File;
import java.io.FileInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Liefert heruntergeladene Kartenpakete an die Oberfläche: https://localhost/_karten_/&lt;paket&gt;/&lt;datei&gt;.
 * Die Kartenbibliothek liest daraus mit Range-Anfragen nur die Kacheln, die sie braucht. Capacitors eigener
 * lokaler Server taugt dafür nicht: er meldet zwar einen Bereich, liefert aber die Datei ab dem Anfang und
 * rechnet mit int (höchstens 2 GB). Alles andere geht unverändert an Capacitor.
 */
public class KartenServer extends BridgeWebViewClient {
    private static final String TAG = "GipfelGasseKarten";
    static final String PFAD = "/_karten_/";

    private final Context context;
    private final Bridge bridge;

    public KartenServer(Bridge bridge) {
        super(bridge);
        this.context = bridge.getContext();
        this.bridge = bridge;
    }

    /** Ordner der Kartenpakete (App-eigener Speicher, wird beim Deinstallieren gelöscht). */
    static File ordner(Context c) {
        File f = c.getExternalFilesDir("karten");
        if (f == null) f = new File(c.getFilesDir(), "karten");
        if (!f.exists() && !f.mkdirs()) Log.w(TAG, "Ordner nicht anlegbar: " + f);
        return f;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        String pfad = request.getUrl().getPath();
        if (pfad == null || !pfad.startsWith(PFAD)) return super.shouldInterceptRequest(view, request);
        // nur für die eigene App-Adresse (https://localhost), nicht für eine fremde Seite mit demselben Pfad
        if (!Bereich.eigeneAdresse(request.getUrl().getScheme(), request.getUrl().getHost(), bridge.getScheme(), bridge.getHost())) {
            return text(403, "Forbidden", "Kartenserver: nur für die App");
        }
        try {
            return liefern(pfad.substring(PFAD.length()), request.getRequestHeaders(),
                Bereich.ausAdresse(request.getUrl().getQueryParameter("von"), request.getUrl().getQueryParameter("bis")));
        } catch (Throwable e) {
            // mit Text statt leerem Körper: ein leerer Körper kommt in der Oberfläche nur als „Failed to fetch“ an
            Log.e(TAG, "Kartendatei nicht lieferbar: " + pfad, e);
            return text(500, "Internal Server Error", "Kartenserver: " + e);
        }
    }

    /** @param ausAdresse Bereich aus ?von=&bis= (gilt, wenn keine Range-Kopfzeile ankommt) */
    private WebResourceResponse liefern(String rest, Map<String, String> kopf, String ausAdresse) throws IOException {
        String[] teile = rest.split("/");
        if (teile.length != 2 || !Bereich.sichererName(teile[0]) || !Bereich.sichererName(teile[1])) {
            return text(404, "Not Found", "Kartenserver: unbekannter Pfad");
        }
        File f = new File(new File(ordner(context), teile[0]), teile[1]);
        if (!f.isFile()) return text(404, "Not Found", "Kartenserver: Datei fehlt");
        long laenge = f.length();
        String range = null;
        if (kopf != null) for (Map.Entry<String, String> e : kopf.entrySet()) if ("range".equalsIgnoreCase(e.getKey())) range = e.getValue();
        if (range == null) range = ausAdresse;

        Map<String, String> h = new HashMap<>();
        h.put("Accept-Ranges", "bytes");
        h.put("Cache-Control", "no-cache");
        h.put("Access-Control-Allow-Origin", "*");
        h.put("Access-Control-Expose-Headers", "Content-Range, Content-Length, ETag");
        h.put("ETag", "\"" + Long.toHexString(f.lastModified()) + "-" + Long.toHexString(laenge) + "\"");
        if (range == null) {
            h.put("Content-Length", String.valueOf(laenge));
            return antwort(200, "OK", h, new FileInputStream(f));
        }
        Bereich b = Bereich.lesen(range, laenge);
        if (b == null) {
            h.put("Content-Range", "bytes */" + laenge);
            return antwort(416, "Range Not Satisfiable", h, new java.io.ByteArrayInputStream(("Kartenserver: Bereich " + range + " passt nicht zu " + laenge + " Bytes").getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        }
        FileInputStream in = new FileInputStream(f);
        in.getChannel().position(b.von);
        h.put("Content-Range", "bytes " + b.von + "-" + b.bis + "/" + laenge);
        h.put("Content-Length", String.valueOf(b.laenge()));
        return antwort(206, "Partial Content", h, new Begrenzt(in, b.laenge()));
    }

    private static WebResourceResponse text(int code, String grund, String text) {
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");
        h.put("Cache-Control", "no-cache");
        return new WebResourceResponse("text/plain", "utf-8", code, grund, h, new java.io.ByteArrayInputStream(text.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    }

    private static WebResourceResponse antwort(int code, String text, Map<String, String> h, InputStream inhalt) {
        return new WebResourceResponse("application/octet-stream", null, code, text, h != null ? h : new HashMap<>(), inhalt);
    }

    /** Liest höchstens n Bytes aus dem Strom. */
    static final class Begrenzt extends FilterInputStream {
        private long rest;
        Begrenzt(InputStream in, long n) { super(in); rest = n; }
        @Override public int read() throws IOException {
            if (rest <= 0) return -1;
            int b = super.read();
            if (b >= 0) rest--;
            return b;
        }
        @Override public int read(byte[] buf, int off, int len) throws IOException {
            if (rest <= 0) return -1;
            int n = super.read(buf, off, (int) Math.min(len, rest));
            if (n > 0) rest -= n;
            return n;
        }
        @Override public long skip(long n) throws IOException {
            long s = super.skip(Math.min(n, rest));
            rest -= s;
            return s;
        }
        @Override public int available() throws IOException { return (int) Math.min(super.available(), rest); }
    }

    /** Für Tests und das Plugin: welche Pakete liegen da (Ordnernamen). */
    static void pakete(Context c, List<String> out) {
        File[] fs = ordner(c).listFiles();
        // nur fertige Pakete: Vorbereitungs- und Reserveordner (.neu-*, .alt-*) zählen nicht
        if (fs != null) for (File f : fs) if (f.isDirectory() && Bereich.sichererName(f.getName()) && new File(f, "paket.json").isFile()) out.add(f.getName());
    }
}
