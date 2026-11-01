import io.github.thomasaurh.gipfelundgasse.Routing;
import java.io.File;
import org.json.JSONObject;

/**
 * Probe-Routing auf den gebauten Routendaten mit der App-eigenen Routing-Klasse und den App-Profilen.
 * Aufruf: java RoutingProbe <ordner mit E10_N45.rd5 …> <profilordner> <lon,lat;lon,lat;profil> …
 * Schlägt fehl, wenn eine Route fehlt, zu kurz ist oder keine Abbiegehinweise hat.
 */
public class RoutingProbe {
    public static void main(String[] a) throws Exception {
        int fehler = 0;
        for (int i = 2; i < a.length; i++) {
            String[] t = a[i].split(";");
            String[] p0 = t[0].split(","), p1 = t[1].split(",");
            double[][] pts = { { Double.parseDouble(p0[0]), Double.parseDouble(p0[1]) }, { Double.parseDouble(p1[0]), Double.parseDouble(p1[1]) } };
            long start = System.currentTimeMillis();
            try {
                JSONObject f = new JSONObject(Routing.route(new File(a[0]), new File(a[1], t[2] + ".brf"), pts, 120000)).getJSONArray("features").getJSONObject(0);
                JSONObject pr = f.getJSONObject("properties");
                int laenge = Integer.parseInt(pr.getString("track-length"));
                int hinweise = pr.has("voicehints") ? pr.getJSONArray("voicehints").length() : 0;
                int punkte = f.getJSONObject("geometry").getJSONArray("coordinates").length();
                boolean ok = laenge > 1000 && punkte > 20 && hinweise > 0;
                System.out.println((ok ? "✓ " : "✗ ") + t[2] + " " + t[0] + " → " + t[1] + ": " + laenge + " m, " + punkte + " Punkte, " + hinweise
                    + " Abbiegehinweise, " + (System.currentTimeMillis() - start) + " ms");
                if (!ok) fehler++;
            } catch (Exception e) {
                System.out.println("✗ " + t[2] + " " + t[0] + " → " + t[1] + ": " + e.getMessage());
                fehler++;
            }
        }
        System.exit(fehler == 0 ? 0 : 1);
    }
}
