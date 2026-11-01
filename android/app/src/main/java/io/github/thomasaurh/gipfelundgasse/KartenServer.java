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

    public KartenServer(Bridge bridge) {
        super(bridge);
        this.context = bridge.getContext();
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
        try {
            return liefern(pfad.substring(PFAD.length()), request.getRequestHeaders());
        } catch (Exception e) {
            Log.e(TAG, "Kartendatei nicht lieferbar: " + pfad, e);
            return antwort(500, "Internal Server Error", null, null);
        }
    }

    private WebResourceResponse liefern(String rest, Map<String, String> kopf) throws IOException {
        String[] teile = rest.split("/");
        if (teile.length != 2 || !Bereich.sichererName(teile[0]) || !Bereich.sichererName(teile[1])) {
            return antwort(404, "Not Found", null, null);
        }
        File f = new File(new File(ordner(context), teile[0]), teile[1]);
        if (!f.isFile()) return antwort(404, "Not Found", null, null);
        long laenge = f.length();
        String range = null;
        if (kopf != null) for (Map.Entry<String, String> e : kopf.entrySet()) if ("range".equalsIgnoreCase(e.getKey())) range = e.getValue();

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
            return antwort(416, "Range Not Satisfiable", h, null);
        }
        FileInputStream in = new FileInputStream(f);
        in.getChannel().position(b.von);
        h.put("Content-Range", "bytes " + b.von + "-" + b.bis + "/" + laenge);
        h.put("Content-Length", String.valueOf(b.laenge()));
        return antwort(206, "Partial Content", h, new Begrenzt(in, b.laenge()));
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
        if (fs != null) for (File f : fs) if (f.isDirectory() && new File(f, "paket.json").isFile()) out.add(f.getName());
    }
}
