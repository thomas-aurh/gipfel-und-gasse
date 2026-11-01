package io.github.thomasaurh.gipfelundgasse;

import static org.junit.Assert.*;
import static org.junit.Assume.assumeTrue;

import java.io.File;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;

/**
 * Routing mit echten BRouter-Routendaten. Die Daten (Testgebiet Dreieich aus dem BRouter-Kartengenerator) und Profile
 * liegen nicht im Repo: Pfade über die Umgebungsvariablen GUG_SEGMENTE und GUG_PROFILE, sonst wird der Test übersprungen.
 */
public class RoutingTest {
    private static File ordner(String var) { String v = System.getenv(var); return v == null ? null : new File(v); }

    @Test public void kachelnamen() {
        assertEquals("E10_N45", Routing.kachel(11.57, 48.13));
        assertEquals("E5_N50", Routing.kachel(8.72, 50.0));
        assertEquals("W5_S10", Routing.kachel(-3.2, -7.5));
    }

    @Test public void kachelAusDateiname() {
        assertEquals("E10_N45", Routing.kachelAusName("routing-e10-n45.rd5"));
        assertEquals("W5_S10", Routing.kachelAusName("routing-w5-s10.rd5"));
        assertNull(Routing.kachelAusName("karte.pmtiles"));
        assertNull(Routing.kachelAusName("routing-e10-n45.rd5.teil"));
        assertEquals("routing-e10-n45.rd5", Routing.nameAusKachel("E10_N45"));
    }

    @Test public void routeWieDerServer() throws Exception {
        File seg = ordner("GUG_SEGMENTE"), prof = ordner("GUG_PROFILE");
        assumeTrue(seg != null && seg.isDirectory() && prof != null && prof.isDirectory());
        String json = Routing.route(seg, new File(prof, "hiking-mountain.brf"), new double[][] { { 8.723037, 50.000491 }, { 8.712737, 50.002899 } }, 30000);
        JSONObject f = new JSONObject(json).getJSONArray("features").getJSONObject(0);
        JSONArray coords = f.getJSONObject("geometry").getJSONArray("coordinates");
        assertTrue("Route hat Punkte", coords.length() > 10);
        assertEquals(3, coords.getJSONArray(0).length());   // Länge, Breite, Höhe
        JSONArray msgs = f.getJSONObject("properties").getJSONArray("messages");
        assertEquals("WayTags", msgs.getJSONArray(0).getString(9));
        assertTrue("Abbiegehinweise", f.getJSONObject("properties").has("voicehints"));
        assertTrue(Integer.parseInt(f.getJSONObject("properties").getString("track-length")) > 500);
    }

    @Test public void punktOhneWegMeldetFehler() {
        File seg = ordner("GUG_SEGMENTE"), prof = ordner("GUG_PROFILE");
        assumeTrue(seg != null && seg.isDirectory() && prof != null && prof.isDirectory());
        try {
            Routing.route(seg, new File(prof, "hiking-mountain.brf"), new double[][] { { 8.723037, 50.000491 }, { 11.5, 48.1 } }, 30000);
            fail("ohne Routendaten für München muss es einen Fehler geben");
        } catch (Exception e) {
            assertNotNull(e.getMessage());
        }
    }
}
