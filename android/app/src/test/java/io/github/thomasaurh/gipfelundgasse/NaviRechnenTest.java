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
}
