package io.github.thomasaurh.gipfelundgasse;

import btools.router.FormatJson;
import btools.router.OsmNodeNamed;
import btools.router.OsmTrack;
import btools.router.RoutingContext;
import btools.router.RoutingEngine;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Routen ohne Netz mit der BRouter-Engine (MIT-Lizenz), ohne Android-Klassen, damit es als JUnit-Test läuft.
 * Liefert dasselbe GeoJSON wie der Server brouter.de (format=geojson), samt Abbiegehinweisen (voicehints);
 * die Oberfläche liest beides mit demselben Code.
 */
public final class Routing {
    private Routing() {}

    /** Abbiegehinweise als JSON-Feld „voicehints“ (Modus 2 von BRouter). */
    public static final int HINWEISE = 2;

    /**
     * @param segmente Ordner mit den Routendaten (*.rd5, je 5°×5°-Kachel, Namen wie E10_N45.rd5)
     * @param profil   Profildatei (*.brf); lookups.dat muss im selben Ordner liegen
     * @param punkte   Wegpunkte als {Länge, Breite}
     * @param maxMs    Rechenzeit höchstens (0 = unbegrenzt)
     */
    public static String route(File segmente, File profil, double[][] punkte, long maxMs) throws Exception {
        if (punkte.length < 2) throw new IllegalArgumentException("mindestens zwei Punkte");
        RoutingContext rc = new RoutingContext();
        rc.localFunction = profil.getAbsolutePath();
        rc.turnInstructionMode = HINWEISE;
        // Kreisverkehre mit Ausfahrt ansagen; das Wanderprofil schaltet das sonst ab (zu Fuß: 0)
        rc.keyValues = new java.util.HashMap<>();
        rc.keyValues.put("turnInstructionRoundabouts", "1");
        List<OsmNodeNamed> wps = new ArrayList<>();
        for (int i = 0; i < punkte.length; i++) {
            OsmNodeNamed n = new OsmNodeNamed();
            n.name = i == 0 ? "from" : i == punkte.length - 1 ? "to" : "via" + i;
            n.ilon = 180000000 + (int) Math.round(punkte[i][0] * 1000000);
            n.ilat = 90000000 + (int) Math.round(punkte[i][1] * 1000000);
            wps.add(n);
        }
        RoutingEngine re = new RoutingEngine(null, null, segmente, wps, rc);
        re.quite = true;
        re.doRun(maxMs);
        if (re.getErrorMessage() != null) throw new Exception(re.getErrorMessage());
        OsmTrack t = re.getFoundTrack();
        if (t == null) throw new Exception("keine Route gefunden");
        return new FormatJson(rc).format(t);
    }

    private static final java.util.regex.Pattern RD5 = java.util.regex.Pattern.compile("routing-([ew])(\\d+)-([ns])(\\d+)\\.rd5");

    /** Routendaten-Kachel aus dem Dateinamen im Paket („routing-e10-n45.rd5“ → „E10_N45“), sonst null. */
    public static String kachelAusName(String name) {
        java.util.regex.Matcher m = RD5.matcher(name);
        if (!m.matches()) return null;
        return m.group(1).toUpperCase() + m.group(2) + "_" + m.group(3).toUpperCase() + m.group(4);
    }

    /** Dateiname im Paket für eine Kachel („E10_N45“ → „routing-e10-n45.rd5“). */
    public static String nameAusKachel(String kachel) { return "routing-" + kachel.toLowerCase().replace('_', '-') + ".rd5"; }

    /** Name der Routendaten-Kachel (5°-Raster), in der ein Punkt liegt, z. B. „E10_N45“. */
    public static String kachel(double lon, double lat) {
        int x = (int) Math.floor(lon / 5) * 5, y = (int) Math.floor(lat / 5) * 5;
        return (x < 0 ? "W" + (-x) : "E" + x) + "_" + (y < 0 ? "S" + (-y) : "N" + y);
    }
}
