package io.github.thomasaurh.gipfelundgasse;

import static org.junit.Assert.*;
import org.junit.Test;

/** Gleiche Erwartungen wie web/test/einheit.js, damit App und Web gleich rechnen. */
public class NaviRechnenTest {
    private static final double N = Double.NaN;

    @Test public void abstandEinBreitengrad() {
        assertEquals(111195, NaviRechnen.abstand(47, 11, 48, 11), 50);
    }

    @Test public void gehzeitDin() {
        assertEquals(4.7, NaviRechnen.gehzeit(12000, 600, 600, 1), 1e-9);
        assertTrue(NaviRechnen.gehzeit(12000, 600, 600, 0.7) > 6.7);
        assertEquals(2.0, NaviRechnen.fahrzeit(16000, 600, 1), 1e-9);
    }

    @Test public void hoehenmeterMitSchwelle() {
        double[] hm = NaviRechnen.hoehenmeter(new double[] { 600, 602, 601, 603, 650, 640, 700, 600 }, 0, N, 5);
        assertEquals(110, hm[0], 0);
        assertEquals(110, hm[1], 0);
    }

    @Test public void restZwischenPunkten() {
        NaviRechnen.Strecke s = new NaviRechnen.Strecke(new double[] { 47, 47.01 }, new double[] { 11, 11 }, new double[] { 600, 800 });
        NaviRechnen.Rest r = NaviRechnen.rest(s, s.laenge() / 2, 1, false);
        assertEquals(100, r.auf, 0);
        assertEquals(s.laenge() / 2, r.meter, 1);
    }

    @Test public void rundtourSpringtNichtAnsEnde() {
        NaviRechnen.Strecke s = new NaviRechnen.Strecke(new double[] { 47.75, 47.76, 47.75 }, new double[] { 11.37, 11.37, 11.37 }, new double[] { N, N, N });
        NaviRechnen.Lage amStart = NaviRechnen.aufStrecke(s, 47.7501, 11.37, 0);
        assertTrue(amStart.d < 50);
        NaviRechnen.Lage amEnde = NaviRechnen.aufStrecke(s, 47.7501, 11.37, s.laenge() - 100);
        assertTrue(amEnde.d > s.laenge() - 50);
    }

    @Test public void abweichungGemessen() {
        NaviRechnen.Strecke s = new NaviRechnen.Strecke(new double[] { 47.75, 47.76 }, new double[] { 11.37, 11.37 }, new double[] { N, N });
        NaviRechnen.Lage l = NaviRechnen.aufStrecke(s, 47.755, 11.3710, N);
        assertEquals(75, l.abw, 3);   // 0,001° Länge bei 47,75° Breite ≈ 75 m
    }

    @Test public void lueckeZaehltNichtUndVerbindetNicht() {
        // zwei Abschnitte, 1 km auseinander; eine Position zwischen ihnen liegt auf keinem Weg
        NaviRechnen.Strecke s = new NaviRechnen.Strecke(new double[] { 47.75, 47.751, 47.76, 47.761 }, new double[] { 11.37, 11.37, 11.37, 11.37 },
            new double[] { N, N, N, N }, new boolean[] { false, false, true, false });
        assertTrue(s.laenge() < 250);
        NaviRechnen.Lage l = NaviRechnen.aufStrecke(s, 47.7555, 11.37, Double.NaN);
        assertTrue(l.abw > 400);
        NaviRechnen.Strecke t = new NaviRechnen.Strecke(new double[] { 47.75, 47.751, 47.76, 47.761 }, new double[] { 11.37, 11.37, 11.37, 11.37 },
            new double[] { 1, 2, 3, 4 }, new boolean[] { false, false, true, false });
        assertTrue(s.gleich(t));
    }

    @Test public void abbiegehinweise() {
        assertEquals("In 100 Metern links abbiegen.", NaviRechnen.hinweisVorab(98, 2, 0));
        assertEquals("Jetzt leicht rechts.", NaviRechnen.hinweisJetzt(6, 0));
        assertEquals("In 200 Metern im Kreisverkehr die 2. Ausfahrt.", NaviRechnen.hinweisVorab(205, 13, 2));
        assertEquals("1,5 Kilometern", NaviRechnen.kmDativ(1500));
        assertEquals("einem Kilometer", NaviRechnen.kmDativ(1000));
        assertNull(NaviRechnen.hinweisText(1, 0));    // geradeaus: keine Ansage
        assertNull(NaviRechnen.hinweisVorab(100, 16, 0));
    }

    @Test public void texte() {
        assertEquals("4:40 h", NaviRechnen.zeitText(4.7));
        assertEquals("20 min", NaviRechnen.zeitText(0.3));
        assertEquals("5,4 km", NaviRechnen.kmText(5432));
        assertEquals("250 m", NaviRechnen.kmText(250));
        assertEquals("300 Meter", NaviRechnen.kmSprache(310));
        assertEquals("2,5 Kilometer", NaviRechnen.kmSprache(2480));
        assertEquals("3 Kilometer", NaviRechnen.kmSprache(3020));
        assertEquals("eine Stunde 10 Minuten", NaviRechnen.zeitSprache(70 / 60.0));
    }

    @Test public void laufzeitMitHoehe() {
        // 10 km und 200 m bergauf bei 6:00 min/km: 12 Leistungs-km = 72 min (wie R.laufzeit)
        assertEquals(1.2, NaviRechnen.laufzeit(10000, 200, 6), 1e-9);
        NaviRechnen.Strecke s = new NaviRechnen.Strecke(new double[] { 47, 47.01 }, new double[] { 11, 11 }, new double[] { 600, 700 });
        assertEquals(NaviRechnen.laufzeit(s.laenge(), 100, 5), NaviRechnen.rest(s, 0, 5, false, true).stunden, 1e-9);
    }

    @Test public void kmAnsageText() {
        assertEquals("3 Kilometer. Zeit 17 Minuten 5 Sekunden. Letzter Kilometer 5:42.", NaviRechnen.kmAnsage(3, 1025000, 342000));
        assertEquals("12 Kilometer. Zeit 1 Stunde 8 Minuten. Letzter Kilometer 5:05.", NaviRechnen.kmAnsage(12, 4100000, 305000));
    }

    @Test public void kmGrenzzeitAusDerSpur() {
        // nach Norden je 0,005° (~556 m) alle 3 Minuten: der 1. km fällt auf Punkt 2 (1112 m), der 2. auf Punkt 4 (2224 m)
        java.util.List<double[]> spur = new java.util.ArrayList<>();
        for (int i = 0; i <= 5; i++) spur.add(new double[] { 47 + i * 0.005, 11, Double.NaN, 1000000 + i * 180000 });
        assertEquals(1000000 + 4 * 180000, NaviRechnen.kmGrenzzeit(spur, 1000000));
        assertEquals(7, NaviRechnen.kmGrenzzeit(spur.subList(0, 2), 7));   // noch kein voller Kilometer
    }

    @Test public void gewitterInDenNaechstenStunden() {
        long jetzt = 1783684800000L;   // volle Stunde
        long[] z = { jetzt / 1000, jetzt / 1000 + 3600, jetzt / 1000 + 7200, jetzt / 1000 + 10800 };
        assertEquals(jetzt + 7200000, NaviRechnen.gewitterAb(z, new int[] { 1, 3, 95, 96 }, jetzt, 3 * 3600000L));
        assertEquals(-1, NaviRechnen.gewitterAb(z, new int[] { 1, 3, 61, 95 }, jetzt, 2 * 3600000L));
    }
}
