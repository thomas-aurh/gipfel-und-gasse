package io.github.thomasaurh.gipfelundgasse;

/**
 * Byte-Bereich aus einer HTTP-Range-Kopfzeile („bytes=100-199“, „bytes=100-“, „bytes=-500“), begrenzt auf die
 * Dateilänge. Ohne Android-Klassen, damit es als JUnit-Test läuft. Mehrere Bereiche in einer Anfrage werden nicht
 * unterstützt (die Kartenbibliothek fragt immer einen an).
 */
public final class Bereich {
    public final long von, bis;   // beide einschließlich

    private Bereich(long von, long bis) { this.von = von; this.bis = bis; }

    public long laenge() { return bis - von + 1; }

    /** null = ungültig oder nicht erfüllbar (Antwort 416). */
    public static Bereich lesen(String kopf, long dateiLaenge) {
        if (kopf == null || dateiLaenge <= 0) return null;
        String k = kopf.trim();
        if (!k.startsWith("bytes=") || k.contains(",")) return null;
        String[] t = k.substring(6).trim().split("-", -1);
        if (t.length != 2) return null;
        try {
            if (t[0].isEmpty()) {                       // die letzten n Bytes
                long n = Long.parseLong(t[1].trim());
                if (n <= 0) return null;
                return new Bereich(Math.max(0, dateiLaenge - n), dateiLaenge - 1);
            }
            long von = Long.parseLong(t[0].trim());
            long bis = t[1].trim().isEmpty() ? dateiLaenge - 1 : Long.parseLong(t[1].trim());
            if (von < 0 || von >= dateiLaenge || bis < von) return null;
            return new Bereich(von, Math.min(bis, dateiLaenge - 1));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Bereich aus der Adresse (?von=100&bis=199), für den Fall, dass das WebView die Range-Kopfzeile nicht an
     * shouldInterceptRequest weiterreicht. Als Kopfzeile geschrieben, damit dieselben Grenzen gelten; null ohne Angabe.
     */
    public static String ausAdresse(String von, String bis) {
        if (von == null || !von.matches("\\d{1,15}")) return null;
        if (bis != null && !bis.isEmpty() && !bis.matches("\\d{1,15}")) return null;
        return "bytes=" + von + "-" + (bis == null ? "" : bis);
    }

    /** Größtes Stück, das die Oberfläche auf einmal über die App-Brücke lesen darf (Kacheln und Verzeichnisse sind kleiner). */
    public static final int STUECK_MAX = 8 * 1024 * 1024;

    /**
     * Liest laenge Bytes ab von aus der Datei, am Dateiende gekürzt; leer, wenn von hinter dem Ende liegt.
     * Für die App-Brücke (KartenPlugin.lesen), die das WebView beim Lesen der Kartenpakete umgeht.
     */
    public static byte[] stueck(java.io.File f, long von, int laenge) throws java.io.IOException {
        if (von < 0 || laenge < 0 || laenge > STUECK_MAX) throw new IllegalArgumentException("Bereich ungültig: " + von + "+" + laenge);
        try (java.io.RandomAccessFile r = new java.io.RandomAccessFile(f, "r")) {
            long n = Math.max(0, Math.min((long) laenge, r.length() - von));
            byte[] b = new byte[(int) n];
            r.seek(von);
            r.readFully(b);
            return b;
        }
    }

    /** Erlaubte Pfadteile unter /_karten_/: nur Kleinbuchstaben, Ziffern, Punkt, Bindestrich (kein „..“). */
    public static boolean sichererName(String s) {
        return s != null && s.matches("[a-z0-9][a-z0-9.\\-]{0,80}") && !s.contains("..");
    }

    /**
     * Darf ein Update diese Datei aus dem installierten Paket übernehmen statt sie neu zu laden? Ja, wenn das installierte
     * Paket (Inhalt seiner paket.json) eine Datei gleichen Namens mit derselben Prüfsumme und Größe nennt. Ohne
     * Prüfsumme nie: dann ist nicht sicher, dass es dieselbe Datei ist.
     */
    public static boolean gleicheDatei(org.json.JSONObject installiert, String name, String sha256, long groesse) {
        if (installiert == null || name == null || sha256 == null || sha256.isEmpty()) return false;
        org.json.JSONArray ds = installiert.optJSONArray("dateien");
        if (ds == null) return false;
        for (int i = 0; i < ds.length(); i++) {
            org.json.JSONObject d = ds.optJSONObject(i);
            if (d != null && name.equals(d.optString("name")) && sha256.equalsIgnoreCase(d.optString("sha256"))
                && (groesse <= 0 || groesse == d.optLong("groesse", -1))) return true;
        }
        return false;
    }
}
