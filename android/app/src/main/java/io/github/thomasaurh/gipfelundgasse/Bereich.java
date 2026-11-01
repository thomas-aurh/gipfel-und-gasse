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

    /** Erlaubte Pfadteile unter /_karten_/: nur Kleinbuchstaben, Ziffern, Punkt, Bindestrich (kein „..“). */
    public static boolean sichererName(String s) {
        return s != null && s.matches("[a-z0-9][a-z0-9.\\-]{0,80}") && !s.contains("..");
    }
}
