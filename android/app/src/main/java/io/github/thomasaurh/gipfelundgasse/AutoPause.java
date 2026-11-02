package io.github.thomasaurh.gipfelundgasse;

/**
 * Auto-Pause für die Aufzeichnung (wie R.autoPause in der Web-App): wer länger als STILL Millisekunden keinen Weg macht,
 * pausiert; die Pause beginnt bei der letzten Bewegung und endet mit der nächsten. Bewegungszeit = Dauer ohne Pausen.
 * Ohne Android-Klassen, damit es als JUnit-Test läuft.
 */
public final class AutoPause {
    public static final long STILL = 10000;

    public long start, pauseMs, letzteBewegung;
    public boolean pausiert;

    public AutoPause(long start, long pauseMs) { this.start = start; this.pauseMs = pauseMs; this.letzteBewegung = start; }

    /** Weg gemacht; liefert true, wenn damit eine Pause endet („Weiter“). */
    public boolean bewegt(long t) {
        boolean weiter = pausiert;
        if (pausiert) { pauseMs += Math.max(0, t - letzteBewegung); pausiert = false; }
        letzteBewegung = t;
        return weiter;
    }

    /** Regelmäßig aufrufen (auch ohne GPS-Punkt); liefert true, wenn jetzt eine Pause beginnt („Pause“). */
    public boolean takt(long t) {
        if (pausiert || t - letzteBewegung <= STILL) return false;
        pausiert = true;
        return true;
    }

    /** Bewegungszeit bis t (eine laufende Pause zählt nicht). */
    public long bewegungMs(long t) {
        return Math.max(0, t - start - pauseMs - (pausiert ? Math.max(0, t - letzteBewegung) : 0));
    }
}
