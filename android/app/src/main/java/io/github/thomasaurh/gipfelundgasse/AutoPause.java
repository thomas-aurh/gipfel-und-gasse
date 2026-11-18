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
    /** Pause von Hand (⏸): zählt als Pause, bis weiter(); Bewegung beendet sie nicht. */
    public boolean hand;

    public AutoPause(long start, long pauseMs) { this.start = start; this.pauseMs = pauseMs; this.letzteBewegung = start; }

    /** Weg gemacht; liefert true, wenn damit eine Pause endet („Weiter“). */
    public boolean bewegt(long t) {
        if (hand) return false;
        boolean weiter = pausiert;
        // auch ohne Takt dazwischen: wer länger als STILL stand, hat pausiert (sonst hinge es an der Taktphase)
        if (pausiert || t - letzteBewegung > STILL) { pauseMs += Math.max(0, t - letzteBewegung); pausiert = false; }
        letzteBewegung = t;
        return weiter;
    }

    /** Regelmäßig aufrufen (auch ohne GPS-Punkt); liefert true, wenn jetzt eine Pause beginnt („Pause“). */
    public boolean takt(long t) {
        if (hand || pausiert || t - letzteBewegung <= STILL) return false;
        pausiert = true;
        return true;
    }

    /** ⏸ von Hand: läuft schon eine Auto-Pause, gilt deren Beginn, sonst beginnt die Pause jetzt. */
    public void handPause(long t) {
        if (hand) return;
        if (!pausiert) { pausiert = true; letzteBewegung = t; }
        hand = true;
    }

    /** ▶ weiter nach einer Pause von Hand. */
    public void handWeiter(long t) {
        if (!hand) return;
        hand = false;
        pauseMs += Math.max(0, t - letzteBewegung);
        pausiert = false;
        letzteBewegung = t;
    }

    /** Bewegungszeit bis t (eine laufende Pause zählt nicht). */
    public long bewegungMs(long t) {
        return Math.max(0, t - start - pauseMs - (pausiert ? Math.max(0, t - letzteBewegung) : 0));
    }
}
