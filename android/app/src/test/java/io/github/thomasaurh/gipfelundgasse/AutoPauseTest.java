package io.github.thomasaurh.gipfelundgasse;

import static org.junit.Assert.*;
import org.junit.Test;

/** Gleiche Erwartungen wie die Auto-Pause in web/test/einheit.js. */
public class AutoPauseTest {
    @Test public void ampelZaehltNicht() {
        AutoPause p = new AutoPause(0, 0);
        p.bewegt(60000);                       // eine Minute gelaufen
        assertFalse(p.takt(65000));            // 5 s Stehen: noch keine Pause
        assertTrue(p.takt(71000));             // nach 11 s: Pause, beginnt bei der letzten Bewegung (60 s)
        assertFalse(p.takt(80000));            // nur einmal melden
        assertEquals(60000, p.bewegungMs(90000));
        assertTrue(p.bewegt(120000));          // weiter nach einer Minute Ampel
        assertEquals(60000, p.pauseMs);
        assertEquals(120000, p.bewegungMs(180000));
    }

    @Test public void kurzesStehenBleibtBewegung() {
        AutoPause p = new AutoPause(1000, 0);
        p.bewegt(5000);
        assertFalse(p.bewegt(12000));          // 7 s ohne Weg, aber kein Takt dazwischen über der Schwelle
        assertEquals(11000, p.bewegungMs(12000));
    }
}
