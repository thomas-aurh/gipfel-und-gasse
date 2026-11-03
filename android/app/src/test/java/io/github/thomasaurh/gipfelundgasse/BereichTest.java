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
    @Test public void gleicheDatei() throws Exception {
        org.json.JSONObject da = new org.json.JSONObject("{\"dateien\":[{\"name\":\"karte.pmtiles\",\"sha256\":\"ab12\",\"groesse\":100},"
            + "{\"name\":\"orte.json.gz\",\"sha256\":\"\",\"groesse\":5}]}");
        assertTrue(Bereich.gleicheDatei(da, "karte.pmtiles", "AB12", 100));
        assertTrue(Bereich.gleicheDatei(da, "karte.pmtiles", "ab12", 0));
        assertFalse(Bereich.gleicheDatei(da, "karte.pmtiles", "cd34", 100));
        assertFalse(Bereich.gleicheDatei(da, "karte.pmtiles", "ab12", 101));
        assertFalse(Bereich.gleicheDatei(da, "orte.json.gz", "", 5));
        assertFalse(Bereich.gleicheDatei(da, "hoehe.pmtiles", "ab12", 100));
        assertFalse(Bereich.gleicheDatei(null, "karte.pmtiles", "ab12", 100));
    }

    @Test public void bereichAusAdresse() {
        assertEquals("bytes=100-199", Bereich.ausAdresse("100", "199"));
        assertEquals("bytes=100-", Bereich.ausAdresse("100", null));
        assertNull(Bereich.ausAdresse(null, "5"));
        assertNull(Bereich.ausAdresse("-1", "5"));
        assertNull(Bereich.ausAdresse("1", "5x"));
        assertEquals(100, Bereich.lesen(Bereich.ausAdresse("100", "199"), 1000).laenge());
    }
    @Test public void stueckMitteUndEnde() throws Exception {
        java.io.File f = java.io.File.createTempFile("karte", ".pmtiles");
        f.deleteOnExit();
        byte[] inhalt = new byte[300000];
        for (int i = 0; i < inhalt.length; i++) inhalt[i] = (byte) (i * 31 + 7);
        java.nio.file.Files.write(f.toPath(), inhalt);
        byte[] mitte = Bereich.stueck(f, 150000, 16384);
        assertEquals(16384, mitte.length);
        for (int i = 0; i < mitte.length; i++) assertEquals(inhalt[150000 + i], mitte[i]);
        assertEquals(100, Bereich.stueck(f, 299900, 16384).length);   // am Ende gekürzt
        assertEquals(inhalt[299999], Bereich.stueck(f, 299900, 16384)[99]);
        assertEquals(0, Bereich.stueck(f, 400000, 10).length);         // hinter dem Ende: leer
        try { Bereich.stueck(f, -1, 10); fail(); } catch (IllegalArgumentException e) { /* gut */ }
        try { Bereich.stueck(f, 0, Bereich.STUECK_MAX + 1); fail(); } catch (IllegalArgumentException e) { /* gut */ }
    }
}
