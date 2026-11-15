package io.github.thomasaurh.gipfelundgasse;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Routing-Profile der App: Name → Profildatei von BRouter und die Werte, die darin überschrieben werden. Ein eigenes
 * Profil wie „laufen-trail“ ist das Wanderprofil mit anderen Werten (online als „profile:Name=Wert“ an brouter.de, ohne
 * Netz über die keyValues von BRouter), so bleibt die Profildatei die von BRouter. Dieselbe Tabelle steht in
 * web/src/10-dienste.js (PROFIL_WERTE); beide müssen übereinstimmen.
 */
public final class Profile {
    private Profile() {}

    private static final Map<String, String> DATEI = new LinkedHashMap<>();
    private static final Map<String, Map<String, String>> WERTE = new LinkedHashMap<>();
    static {
        DATEI.put("hiking-mountain", "hiking-mountain");
        DATEI.put("trekking", "trekking");
        DATEI.put("shortest", "shortest");
        // Trail-Laufen: Pfade und Forstwege vor Asphalt, höchstens SAC T2, markierte Wanderwege ohne Vorzug
        DATEI.put("laufen-trail", "hiking-mountain");
        Map<String, String> lauf = new LinkedHashMap<>();
        lauf.put("SAC_scale_limit", "2");
        lauf.put("SAC_scale_preferred", "1");
        lauf.put("hiking_routes_preference", "0");
        lauf.put("path_preference", "2");
        WERTE.put("laufen-trail", Collections.unmodifiableMap(lauf));
    }

    /** Alle Profilnamen, die Oberfläche und Dienst schicken dürfen. */
    public static final Set<String> NAMEN = Collections.unmodifiableSet(DATEI.keySet());

    public static boolean bekannt(String name) { return name != null && DATEI.containsKey(name); }

    /** Name der Profildatei ohne „.brf“. */
    public static String datei(String name) { return DATEI.get(name); }

    /** Überschriebene Werte (leer bei den Profilen von BRouter). */
    public static Map<String, String> werte(String name) {
        Map<String, String> w = WERTE.get(name);
        return w != null ? w : Collections.<String, String>emptyMap();
    }

    /** Teil der Anfrage an brouter.de: „&profile=Datei“ und je Wert „&profile:Name=Wert“. */
    public static String anfrage(String name) {
        StringBuilder s = new StringBuilder("&profile=").append(datei(name));
        for (Map.Entry<String, String> e : werte(name).entrySet()) s.append("&profile:").append(e.getKey()).append('=').append(e.getValue());
        return s.toString();
    }
}
