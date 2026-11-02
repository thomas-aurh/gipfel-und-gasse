package io.github.thomasaurh.gipfelundgasse;

import static org.junit.Assert.*;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.Test;

public class UmplanenTest {
    private static List<double[]> ziele() {
        // Ziel 1 bei 1000 m, Ziel 2 bei 2500 m, Ende bei 4000 m
        return new ArrayList<>(Arrays.asList(
            new double[] { 47.76, 11.38, 1000, 0 }, new double[] { 47.77, 11.39, 2500, 30 }, new double[] { 47.75, 11.37, 4000, 0 }));
    }

    @Test public void naechstesOffenesZiel() {
        assertEquals(0, Umplanen.naechstes(ziele(), Double.NaN));    // nie auf der Route: alle offen
        assertEquals(0, Umplanen.naechstes(ziele(), 500));
        assertEquals(1, Umplanen.naechstes(ziele(), 980));           // 20 m davor gilt als erreicht
        assertEquals(2, Umplanen.naechstes(ziele(), 2600));
        assertEquals(-1, Umplanen.naechstes(ziele(), 3990));         // am Ende: nichts mehr umzuplanen
    }

    @Test public void punkteAbStandort() {
        double[][] p = Umplanen.punkte(47.761, 11.385, ziele(), 1);
        assertEquals(3, p.length);
        assertArrayEquals(new double[] { 11.385, 47.761 }, p[0], 0);   // Länge, Breite
        assertArrayEquals(new double[] { 11.39, 47.77 }, p[1], 0);
        assertArrayEquals(new double[] { 11.37, 47.75 }, p[2], 0);
    }

    @Test public void anfrageWieDieWebApp() {
        String u = Umplanen.url("https://brouter.de/brouter", new double[][] { { 11.385, 47.761 }, { 11.39, 47.77 } }, "hiking-mountain");
        assertEquals("https://brouter.de/brouter?lonlats=11.385000,47.761000|11.390000,47.770000&profile=hiking-mountain"
            + "&alternativeidx=0&format=geojson&timode=2&profile:turnInstructionRoundabouts=1", u);
    }

    @Test public void antwortLesen() throws Exception {
        // vier Punkte nach Norden, Ziel A liegt auf Punkt 2, Ende auf Punkt 3; Hinweis „links“ an Punkt 1, Kreisverkehr links an Punkt 2
        String gj = "{\"type\":\"FeatureCollection\",\"features\":[{\"type\":\"Feature\",\"properties\":{\"voicehints\":"
            + "[[1,2,0,100,-90],[2,14,-2,50,30]]},\"geometry\":{\"type\":\"LineString\",\"coordinates\":"
            + "[[11.0,47.000,600],[11.0,47.001,610],[11.0,47.002],[11.0,47.003,630]]}}]}";
        List<double[]> offen = new ArrayList<>(Arrays.asList(new double[] { 47.002, 11.0, 0, 0 }, new double[] { 47.003, 11.0, 0, 0 }));
        Umplanen.Neu n = Umplanen.lesen(gj, offen);
        assertEquals(4, n.strecke.groesse());
        assertTrue(Double.isNaN(n.strecke.ele[2]));
        assertEquals(2, n.hinweise.size());
        assertEquals(n.strecke.d[1], n.hinweise.get(0)[0], 1e-9);
        assertEquals(2, n.hinweise.get(0)[1], 0);
        assertEquals(2, n.hinweise.get(1)[2], 0);            // Ausfahrt positiv
        assertEquals(n.strecke.d[2], n.zielMeter[0], 1e-9);
        assertEquals(n.strecke.laenge(), n.zielMeter[1], 1e-9);
    }

    @Test public void zieleDerReiheNachAuchBeiHinUndZurueck() throws Exception {
        // hin und zurück: Ziel A (Wendepunkt) bei Punkt 2, Ende wieder am Anfang; A darf nicht am Rückweg gesucht werden
        String gj = "{\"features\":[{\"geometry\":{\"coordinates\":[[11,47.000],[11,47.001],[11,47.002],[11,47.001],[11,47.0005]]}}]}";
        List<double[]> offen = new ArrayList<>(Arrays.asList(new double[] { 47.002, 11, 0, 0 }, new double[] { 47.0005, 11, 0, 0 }));
        Umplanen.Neu n = Umplanen.lesen(gj, offen);
        assertEquals(n.strecke.d[2], n.zielMeter[0], 1e-9);
        assertEquals(n.strecke.laenge(), n.zielMeter[1], 1e-9);
        assertTrue(n.hinweise.isEmpty());
    }

    @Test(expected = Exception.class) public void fehlermeldungStattRoute() throws Exception {
        Umplanen.lesen("position not mapped in existing datafile", ziele());
    }
}
