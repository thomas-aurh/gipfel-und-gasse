package io.github.thomasaurh.gipfelundgasse;

import static org.junit.Assert.*;
import org.junit.Test;

public class BereichTest {
    @Test public void normal() {
        Bereich b = Bereich.lesen("bytes=100-199", 1000);
        assertEquals(100, b.von); assertEquals(199, b.bis); assertEquals(100, b.laenge());
    }
    @Test public void offenesEnde() {
        Bereich b = Bereich.lesen("bytes=900-", 1000);
        assertEquals(900, b.von); assertEquals(999, b.bis);
    }
    @Test public void ueberDasEnde() {
        Bereich b = Bereich.lesen("bytes=0-16383", 1000);
        assertEquals(0, b.von); assertEquals(999, b.bis);
    }
    @Test public void letzteBytes() {
        Bereich b = Bereich.lesen("bytes=-100", 1000);
        assertEquals(900, b.von); assertEquals(999, b.bis);
    }
    @Test public void grosseDatei() {
        long dreiGB = 3L * 1024 * 1024 * 1024;
        Bereich b = Bereich.lesen("bytes=3000000000-3000000099", dreiGB);
        assertEquals(3000000000L, b.von); assertEquals(100, b.laenge());
    }
    @Test public void ungueltig() {
        assertNull(Bereich.lesen("bytes=1000-", 1000));
        assertNull(Bereich.lesen("bytes=5-3", 1000));
        assertNull(Bereich.lesen("bytes=0-1,5-9", 1000));
        assertNull(Bereich.lesen("items=0-1", 1000));
        assertNull(Bereich.lesen("bytes=a-b", 1000));
        assertNull(Bereich.lesen(null, 1000));
    }
    @Test public void namen() {
        assertTrue(Bereich.sichererName("oberbayern"));
        assertTrue(Bereich.sichererName("karte.pmtiles"));
        assertFalse(Bereich.sichererName(".."));
        assertFalse(Bereich.sichererName("a..b"));
        assertFalse(Bereich.sichererName("../etc"));
        assertFalse(Bereich.sichererName("Ober Bayern"));
        assertFalse(Bereich.sichererName(""));
    }
}
