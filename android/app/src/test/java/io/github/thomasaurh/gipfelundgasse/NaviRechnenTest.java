package io.github.thomasaurh.gipfelundgasse;

import static org.junit.Assert.*;
import org.junit.Test;

/** Gleiche Erwartungen wie web/test/einheit.js, damit App und Web gleich rechnen. */
public class NaviRechnenTest {
    private static final double N = Double.NaN;

    @Test public void uhrTextOhnePunktUndKurz() {
        assertEquals("In 80 Metern links abbiegen", NaviRechnen.uhrText("In 80 Metern links abbiegen."));
        assertEquals("Ziel erreicht", NaviRechnen.uhrText(" Ziel erreicht. "));
        String lang = NaviRechnen.uhrText(new String(new char[300]).replace('\0', 'a'));
        assertEquals(120, lang.length());
        assertTrue(lang.endsWith("…"));
        assertEquals("", NaviRechnen.uhrText(null));
    }

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

    @Test public void gpsSprungErkannt() {
        // 300 m in 2 s bei ± 10 m: Sprung; 300 m in 60 s (5 m/s, Laufen): kein Sprung; 3 km in 10 min Lücke (Tunnel): keiner
        assertTrue(NaviRechnen.gpsSprung(300, 2000, 10, false));
        assertFalse(NaviRechnen.gpsSprung(300, 60000, 10, false));
        assertFalse(NaviRechnen.gpsSprung(3000, 600000, 10, false));
        // 100 m in 4 s: zu Fuß ein Sprung, mit dem Rad (25 m/s) nicht
        assertTrue(NaviRechnen.gpsSprung(100, 4000, 5, false));
        assertFalse(NaviRechnen.gpsSprung(100, 4000, 5, true));
    }

    @Test public void sprungFilterHaeltAusreisserZurueck() {
        NaviRechnen.SprungFilter f = new NaviRechnen.SprungFilter();
        double[] a = { 47, 11, Double.NaN, 0 };
        double[] weg = { 47.003, 11, Double.NaN, 1000 };      // 334 m in 1 s: Ausreißer
        double[] b = { 47.00003, 11, Double.NaN, 2000 };      // wieder beim alten Ort
        assertEquals(0, f.pruefen(a, weg, 10, false).size());
        assertEquals(1, f.pruefen(a, b, 10, false).size());
        assertSame(b, f.pruefen(a, b, 10, false).get(0));
        // zweimal in Folge am neuen Ort (z. B. aus der Bahn gestiegen): beide kommen in die Spur
        double[] c1 = { 47.05, 11, Double.NaN, 3000 }, c2 = { 47.05003, 11, Double.NaN, 4000 };
        assertEquals(0, f.pruefen(b, c1, 10, false).size());
        java.util.List<double[]> beide = f.pruefen(b, c2, 10, false);
        assertEquals(2, beide.size());
        assertSame(c1, beide.get(0));
        assertSame(c2, beide.get(1));
        assertEquals(1, f.pruefen(null, a, 10, false).size());
    }

    @Test public void zielAnsageText() {
        assertEquals("Streckenziel 8 Kilometer erreicht. Zeit 47 Minuten.", NaviRechnen.zielAnsage(8, 47 * 60000 + 20000));
        assertEquals("Streckenziel 21,1 Kilometer erreicht. Zeit 1 Stunde 52 Minuten.", NaviRechnen.zielAnsage(21.1, 112 * 60000));
        assertEquals("Streckenziel 1 Kilometer erreicht. Zeit 1 Minute.", NaviRechnen.zielAnsage(1, 61000));
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

    // ---------- Umkehrzeit, Ausstiege, Akku: gleiche Fälle wie web/test/einheit.js ----------
    @Test public void dunkelLage() {
        long t = 1_000_000_000_000L, umkehr = t + 3600000L, dunkel = t + 3 * 3600000L;
        assertEquals(0, NaviRechnen.dunkelLage(t, t + 7200000L, dunkel, 5000, umkehr, 3000));
        assertEquals(NaviRechnen.UMKEHR_BALD, NaviRechnen.dunkelLage(umkehr - 600000L, t, dunkel, 5000, umkehr, 3000));
        assertEquals(NaviRechnen.UMKEHR | NaviRechnen.KNAPP, NaviRechnen.dunkelLage(umkehr + 60000L, dunkel + 600000L, dunkel, 5000, umkehr, 3000));
        assertEquals(0, NaviRechnen.dunkelLage(umkehr + 60000L, t, dunkel, 5000, umkehr, 6000));
        assertEquals(0, NaviRechnen.dunkelLage(umkehr + 60000L, dunkel + 1, 0, 5000, umkehr, 3000));
    }

    @Test public void dunkelTextMitAusstieg() {
        java.util.TimeZone utc = java.util.TimeZone.getTimeZone("UTC");
        long untergang = 1_763_393_400_000L;   // 2025-11-17 15:30 UTC
        assertEquals("15 Uhr 30", NaviRechnen.uhrSprache(untergang, utc));
        String s = NaviRechnen.dunkelText(NaviRechnen.UMKEHR, 0, 0, 0, untergang, "Bushaltestelle Au in 1,2 Kilometern", utc);
        assertTrue(s, s.startsWith("Umkehrzeit erreicht.") && s.endsWith("Nächster Ausstieg: Bushaltestelle Au in 1,2 Kilometern."));
    }

    @Test public void naechsterAusstieg() {
        java.util.List<Double> m = java.util.Arrays.asList(3000.0, 6000.0);
        assertEquals(1, NaviRechnen.naechsterAusstieg(m, 4000));
        assertEquals(-1, NaviRechnen.naechsterAusstieg(m, 7000));
    }

    @Test public void akku() {
        long t0 = 1_000_000_000_000L;
        long[] t = new long[4]; double[] l = new double[4];
        for (int i = 0; i < 4; i++) { t[i] = t0 + i * 600000L; l[i] = 0.8 - i * 10 / 300.0; }
        assertEquals(3.5, NaviRechnen.akkuStunden(t, l), 1e-6);
        assertTrue(Double.isNaN(NaviRechnen.akkuStunden(new long[] { t0 }, new double[] { 0.8 })));
        assertTrue(Double.isNaN(NaviRechnen.akkuStunden(new long[] { t0, t0 + 3600000L }, new double[] { 0.8, 0.79 })));
        long[] lt = { t0, t0 + 1800000L, t0 + 5400000L, t0 + 9000000L };
        assertEquals(0.7 / 0.05, NaviRechnen.akkuStunden(lt, new double[] { 1, 0.8, 0.75, 0.7 }), 1e-6);
        assertEquals(2, NaviRechnen.akkuWarnung(40, 2, 1.8));
        assertEquals(0, NaviRechnen.akkuWarnung(40, 4, 1.8));
        assertEquals(1, NaviRechnen.akkuWarnung(12, Double.NaN, 1));
    }
}
