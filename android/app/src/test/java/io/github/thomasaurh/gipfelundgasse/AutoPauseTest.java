package io.github.thomasaurh.gipfelundgasse;

import static org.junit.Assert.*;
import org.junit.Test;

/** Gleiche Erwartungen wie die Auto-Pause in web/test/einheit.js. */
public class AutoPauseTest {
    /** GPS meldet alle 5 s Bewegung bis bis. */
    private static void gehen(AutoPause p, long bis) { for (long t = 5000; t <= bis; t += 5000) p.bewegt(t); }

    @Test public void ampelZaehltNicht() {
        AutoPause p = new AutoPause(0, 0);
        gehen(p, 60000);                       // eine Minute gelaufen
        assertFalse(p.takt(65000));            // 5 s Stehen: noch keine Pause
        assertTrue(p.takt(71000));             // nach 11 s: Pause, beginnt bei der letzten Bewegung (60 s)
        assertFalse(p.takt(80000));            // nur einmal melden
        assertEquals(60000, p.bewegungMs(90000));
        assertTrue(p.bewegt(120000));          // weiter nach einer Minute Ampel
        assertEquals(60000, p.pauseMs);
        assertEquals(120000, p.bewegungMs(180000));
    }

    @Test public void pauseVonHand() {
        AutoPause p = new AutoPause(0, 0);
        gehen(p, 60000);
        p.handPause(60000);
        assertFalse(p.bewegt(70000));          // Bewegung beendet die Pause von Hand nicht
        assertFalse(p.takt(90000));
        assertEquals(60000, p.bewegungMs(120000));
        p.handWeiter(120000);
        assertFalse(p.hand);
        assertEquals(60000, p.pauseMs);
        gehen(p, 0); p.bewegt(125000);
        assertEquals(65000, p.bewegungMs(125000));
        // während einer Auto-Pause gedrückt: die Pause beginnt bei der letzten Bewegung
        AutoPause q = new AutoPause(0, 0);
        gehen(q, 60000);
        assertTrue(q.takt(75000));
        q.handPause(80000);
        q.handWeiter(100000);
        assertEquals(40000, q.pauseMs);
    }

    @Test public void schwelleAuchOhneTaktDazwischen() {
        // letzte Bewegung 60 s, Takte bei 65 und 70 s (noch unter der Schwelle), weiter bei 72 s: 12 s Stehen zählen nicht
        AutoPause p = new AutoPause(0, 0);
        gehen(p, 60000);
        assertFalse(p.takt(65000));
        assertFalse(p.takt(70000));
        assertFalse(p.bewegt(72000));          // keine angesagte Pause, also auch kein „Weiter“
        assertEquals(12000, p.pauseMs);
        assertEquals(60000, p.bewegungMs(72000));
    }

    @Test public void kurzesStehenBleibtBewegung() {
        AutoPause p = new AutoPause(1000, 0);
        p.bewegt(5000);
        assertFalse(p.bewegt(12000));          // 7 s ohne Weg, aber kein Takt dazwischen über der Schwelle
        assertEquals(11000, p.bewegungMs(12000));
    }
}
