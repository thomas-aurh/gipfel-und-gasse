package io.github.thomasaurh.gipfelundgasse;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Vordergrunddienst für unterwegs: holt GPS auch bei gesperrtem Bildschirm, rechnet Rest und Abweichung,
 * spricht Ansagen und zeichnet auf. Android verlangt dafür die dauerhafte Benachrichtigung „Navigation läuft“.
 * Die Einstellungen liegen in {@link Zustand}; das Plugin setzt sie, der Dienst liest sie.
 */
public class NaviService extends Service implements LocationListener, TextToSpeech.OnInitListener {
    private static final String TAG = "GipfelGasseNavi";
    private static final String KANAL = "navigation";
    private static final int NR = 4711;
    static final String AKTION_BEENDEN = "io.github.thomasaurh.gipfelundgasse.BEENDEN";

    /** Gemeinsamer Zustand von Plugin und Dienst (beide laufen im selben Prozess). */
    static final class Zustand {
        // Einstellungen
        NaviRechnen.Strecke strecke;
        List<double[]> stopps = new ArrayList<>();   // {d, minuten}
        List<String> stoppNamen = new ArrayList<>();
        double tempo = 1;
        boolean rad, folgen, aufzeichnen, ansagen = true;
        // laufend
        boolean laeuft;
        Location letzte;
        double fortschritt = Double.NaN, abw = Double.NaN;
        long abseitsSeit, folgenSeit;
        boolean abseitsGemeldet, zielGemeldet;
        int naechsterKm = -1;
        boolean[] stoppAngekuendigt = new boolean[0], stoppErreicht = new boolean[0];
        NaviRechnen.Rest rest;
        // Aufzeichnung: {lat, lon, ele, zeit}
        final List<double[]> spur = new ArrayList<>();
        long aufzStart, aufzEnde;
        double aufzMeter;
        Runnable beiNeuem;   // vom Plugin gesetzt: Position an die Oberfläche melden
    }

    static final Zustand Z = new Zustand();

    private LocationManager lm;
    private TextToSpeech tts;
    private boolean ttsBereit;
    private final List<String> ttsWarten = new ArrayList<>();
    private int ungespeichert;

    @Override
    public void onCreate() {
        super.onCreate();
        tts = new TextToSpeech(this, this);
        kanalAnlegen();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && AKTION_BEENDEN.equals(intent.getAction())) {
            synchronized (Z) {
                if (Z.aufzeichnen) Z.aufzEnde = System.currentTimeMillis();
                Z.folgen = false; Z.aufzeichnen = false;
            }
            sitzungSichern(this);
            beenden();
            if (Z.beiNeuem != null) Z.beiNeuem.run();
            return START_NOT_STICKY;
        }
        if (intent == null && !Z.folgen && !Z.aufzeichnen) {
            sitzungLaden(this);
            if (!Z.folgen && !Z.aufzeichnen) { stopSelf(); return START_NOT_STICKY; }
            Log.i(TAG, "Sitzung nach Neustart wiederhergestellt");
        }
        Notification n = benachrichtigung();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NR, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NR, n);
        }
        if (!Z.laeuft) gpsAn();
        synchronized (Z) {
            Z.laeuft = true;
            if (Z.folgen && Z.folgenSeit == 0) {
                Z.folgenSeit = System.currentTimeMillis();
                Z.fortschritt = Double.NaN;
                Z.zielGemeldet = false;
                Z.naechsterKm = -1;
                int n2 = Z.stopps.size();
                Z.stoppAngekuendigt = new boolean[n2];
                Z.stoppErreicht = new boolean[n2];
                if (Z.ansagen && Z.strecke != null) {
                    NaviRechnen.Rest r = NaviRechnen.rest(Z.strecke, 0, Z.tempo, Z.rad);
                    sagen("Los geht's. " + NaviRechnen.kmSprache(r.meter) + ", etwa " + NaviRechnen.zeitSprache(r.stunden) + ".");
                }
            }
            if (Z.aufzeichnen && Z.aufzStart == 0) { Z.aufzStart = System.currentTimeMillis(); Z.aufzEnde = 0; Z.spur.clear(); Z.aufzMeter = 0; }
        }
        return START_STICKY;
    }

    @SuppressLint("MissingPermission")   // das Plugin startet den Dienst erst nach erteilter Standort-Erlaubnis
    private void gpsAn() {
        lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        try {
            lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 2000, 3, this, Looper.getMainLooper());
        } catch (Exception e) {
            Log.e(TAG, "GPS nicht verfügbar", e);
        }
    }

    @Override
    public void onLocationChanged(@NonNull Location loc) {
        synchronized (Z) {
            Z.letzte = loc;
            if (Z.folgen && Z.strecke != null && Z.strecke.groesse() > 1) folgen(loc);
            if (Z.aufzeichnen) aufzeichnen(loc);
        }
        benachrichtigungAktualisieren();
        if (Z.beiNeuem != null) Z.beiNeuem.run();
    }

    private void folgen(Location loc) {
        NaviRechnen.Lage lage = NaviRechnen.aufStrecke(Z.strecke, loc.getLatitude(), loc.getLongitude(), Z.fortschritt);
        Z.abw = lage.abw;
        if (lage.abw < 80) Z.fortschritt = lage.d;
        double d = Double.isNaN(Z.fortschritt) ? lage.d : Z.fortschritt;
        Z.rest = NaviRechnen.rest(Z.strecke, d, Z.tempo, Z.rad);
        // noch offene Besichtigungen zur Restzeit
        double min = 0;
        for (int i = 0; i < Z.stopps.size(); i++) if (Z.stopps.get(i)[0] > d + 20) min += Z.stopps.get(i)[1];
        if (min > 0) Z.rest = NaviRechnen.restMit(Z.rest.meter, Z.rest.auf, Z.rest.ab, Z.rest.stunden + min / 60);

        long jetzt = System.currentTimeMillis();
        double grenze = Math.max(50, loc.getAccuracy() * 1.5);
        if (lage.abw > grenze) {
            if (Z.abseitsSeit == 0) Z.abseitsSeit = jetzt;
            if (jetzt - Z.abseitsSeit > 15000 && !Z.abseitsGemeldet) {
                Z.abseitsGemeldet = true;
                vibrieren();
                if (Z.ansagen) sagen("Achtung, du bist " + NaviRechnen.kmSprache(lage.abw) + " neben der Route.");
            }
        } else {
            if (Z.abseitsGemeldet && Z.ansagen) sagen("Wieder auf der Route.");
            Z.abseitsSeit = 0;
            Z.abseitsGemeldet = false;
        }
        if (!Z.ansagen || lage.abw > 80) return;
        // Stopps: in 150 m ankündigen, bei 30 m „erreicht“
        for (int i = 0; i < Z.stopps.size(); i++) {
            double bis = Z.stopps.get(i)[0] - d;
            String name = Z.stoppNamen.get(i);
            if (!Z.stoppAngekuendigt[i] && bis > 30 && bis < 150) { Z.stoppAngekuendigt[i] = true; sagen("In " + NaviRechnen.kmSprache(bis) + ": " + name + "."); }
            if (!Z.stoppErreicht[i] && Math.abs(bis) <= 30) { Z.stoppErreicht[i] = true; Z.stoppAngekuendigt[i] = true; sagen(name + " erreicht."); }
        }
        // jeder volle Kilometer: Rest und Zeit
        int km = (int) Math.floor(d / 1000);
        if (Z.naechsterKm < 0) Z.naechsterKm = km + 1;
        if (km >= Z.naechsterKm && Z.rest.meter > 300) {
            Z.naechsterKm = km + 1;
            sagen("Noch " + NaviRechnen.kmSprache(Z.rest.meter) + ", etwa " + NaviRechnen.zeitSprache(Z.rest.stunden) + ".");
        }
        if (!Z.zielGemeldet && Z.rest.meter < 30 && lage.abw < 40 && d > Z.strecke.laenge() / 2 && jetzt - Z.folgenSeit > 60000) {
            Z.zielGemeldet = true;
            vibrieren();
            Z.folgen = false;
            sitzungSichern(this);
            if (Z.aufzeichnen) sagen("Ziel erreicht. Schön war's!");
            else {
                if (lm != null) lm.removeUpdates(this);
                sagenDannBeenden("Ziel erreicht. Schön war's!");
            }
        }
    }

    private void aufzeichnen(Location loc) {
        if (loc.hasAccuracy() && loc.getAccuracy() > 40) return;   // zu ungenau
        double[] p = { loc.getLatitude(), loc.getLongitude(), loc.hasAltitude() ? loc.getAltitude() : Double.NaN, loc.getTime() };
        if (!Z.spur.isEmpty()) {
            double[] l = Z.spur.get(Z.spur.size() - 1);
            double m = NaviRechnen.abstand(l[0], l[1], p[0], p[1]);
            if (m < Math.max(8, loc.getAccuracy() / 2)) return;    // stehen bleiben zählt nicht als Weg
            Z.aufzMeter += m;
        }
        Z.spur.add(p);
        // regelmäßig sichern, damit nichts verloren geht, wenn Android die App beendet
        if (++ungespeichert >= 20) { ungespeichert = 0; spurSichern(this); }
    }

    /**
     * Sitzung (Route, Stopps, Einstellungen, Schalter) als JSON sichern, damit der Dienst nach einem Neustart durch
     * Android weitermachen kann. Die Aufzeichnung selbst steht in aufzeichnung.json.
     */
    static void sitzungSichern(Context c) {
        try {
            JSONObject o = new JSONObject();
            synchronized (Z) {
                o.put("folgen", Z.folgen); o.put("aufzeichnen", Z.aufzeichnen); o.put("ansagen", Z.ansagen);
                o.put("tempo", Z.tempo); o.put("rad", Z.rad); o.put("aufzStart", Z.aufzStart); o.put("aufzEnde", Z.aufzEnde);
                JSONArray pts = new JSONArray();
                if (Z.strecke != null) for (int i = 0; i < Z.strecke.groesse(); i++) {
                    JSONArray p = new JSONArray();
                    p.put(Z.strecke.lat[i]); p.put(Z.strecke.lon[i]);
                    p.put(Double.isNaN(Z.strecke.ele[i]) ? JSONObject.NULL : Z.strecke.ele[i]);
                    p.put(Z.strecke.luecke[i] ? 1 : 0);
                    pts.put(p);
                }
                o.put("pts", pts);
                JSONArray st = new JSONArray();
                for (int i = 0; i < Z.stopps.size(); i++) {
                    JSONObject s = new JSONObject();
                    s.put("d", Z.stopps.get(i)[0]); s.put("min", Z.stopps.get(i)[1]); s.put("name", Z.stoppNamen.get(i));
                    st.put(s);
                }
                o.put("stopps", st);
            }
            try (FileOutputStream out = new FileOutputStream(new File(c.getFilesDir(), "sitzung.json"))) {
                out.write(o.toString().getBytes(StandardCharsets.UTF_8));
            }
        } catch (Exception e) {
            Log.e(TAG, "Sitzung nicht gesichert", e);
        }
    }

    static String dateiLesen(File f) throws Exception {
        byte[] b = new byte[(int) f.length()];
        int n = 0;
        try (FileInputStream in = new FileInputStream(f)) {
            while (n < b.length) { int r = in.read(b, n, b.length - n); if (r < 0) break; n += r; }
        }
        return new String(b, 0, n, StandardCharsets.UTF_8);
    }

    static void sitzungLaden(Context c) {
        try {
            File f = new File(c.getFilesDir(), "sitzung.json");
            if (!f.exists()) return;
            JSONObject o = new JSONObject(dateiLesen(f));
            synchronized (Z) {
                JSONArray pts = o.optJSONArray("pts");
                if (pts != null && pts.length() > 1) {
                    int n = pts.length();
                    double[] lat = new double[n], lon = new double[n], ele = new double[n];
                    boolean[] lu = new boolean[n];
                    for (int i = 0; i < n; i++) {
                        JSONArray p = pts.optJSONArray(i);
                        lat[i] = p.optDouble(0); lon[i] = p.optDouble(1);
                        ele[i] = p.isNull(2) ? Double.NaN : p.optDouble(2, Double.NaN);
                        lu[i] = p.optInt(3, 0) == 1;
                    }
                    Z.strecke = new NaviRechnen.Strecke(lat, lon, ele, lu);
                }
                Z.stopps = new ArrayList<>(); Z.stoppNamen = new ArrayList<>();
                JSONArray st = o.optJSONArray("stopps");
                if (st != null) for (int i = 0; i < st.length(); i++) {
                    JSONObject s = st.optJSONObject(i);
                    Z.stopps.add(new double[] { s.optDouble("d", 0), s.optDouble("min", 0) });
                    Z.stoppNamen.add(s.optString("name", "Stopp"));
                }
                Z.tempo = o.optDouble("tempo", 1); Z.rad = o.optBoolean("rad", false); Z.ansagen = o.optBoolean("ansagen", true);
                Z.folgen = o.optBoolean("folgen", false) && Z.strecke != null;
                Z.aufzeichnen = o.optBoolean("aufzeichnen", false);
                Z.aufzStart = o.optLong("aufzStart", 0); Z.aufzEnde = o.optLong("aufzEnde", 0);
                Z.folgenSeit = Z.folgen ? System.currentTimeMillis() : 0;   // ohne neue Begrüßung weiter
                Z.stoppAngekuendigt = new boolean[Z.stopps.size()];
                Z.stoppErreicht = new boolean[Z.stopps.size()];
                // bisherige Aufzeichnung zurückholen
                Z.spur.clear(); Z.aufzMeter = 0;
                File a = new File(c.getFilesDir(), "aufzeichnung.json");
                if (a.exists()) {
                    JSONArray sp = new JSONObject(dateiLesen(a)).optJSONArray("spur");
                    if (sp != null) for (int i = 0; i < sp.length(); i++) {
                        JSONArray p = sp.optJSONArray(i);
                        double[] q = { p.optDouble(0), p.optDouble(1), p.isNull(2) ? Double.NaN : p.optDouble(2, Double.NaN), p.optLong(3, 0) };
                        if (!Z.spur.isEmpty()) { double[] l = Z.spur.get(Z.spur.size() - 1); Z.aufzMeter += NaviRechnen.abstand(l[0], l[1], q[0], q[1]); }
                        Z.spur.add(q);
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Sitzung nicht lesbar", e);
        }
    }

    /** Aufzeichnung als JSON in den App-Speicher (wird beim nächsten Start wiedergefunden). */
    static void spurSichern(Context c) {
        try {
            JSONArray a = new JSONArray();
            synchronized (Z) {
                for (double[] p : Z.spur) {
                    JSONArray q = new JSONArray();
                    q.put(p[0]); q.put(p[1]); q.put(Double.isNaN(p[2]) ? JSONObject.NULL : p[2]); q.put((long) p[3]);
                    a.put(q);
                }
            }
            JSONObject o = new JSONObject();
            o.put("start", Z.aufzStart);
            o.put("ende", Z.aufzEnde);
            o.put("spur", a);
            File f = new File(c.getFilesDir(), "aufzeichnung.json");
            try (FileOutputStream out = new FileOutputStream(f)) { out.write(o.toString().getBytes(StandardCharsets.UTF_8)); }
        } catch (Exception e) {
            Log.e(TAG, "Aufzeichnung nicht gesichert", e);
        }
    }

    private void beenden() {
        if (Z.aufzStart != 0) spurSichern(this);
        if (lm != null) lm.removeUpdates(this);
        synchronized (Z) { Z.laeuft = false; Z.folgenSeit = 0; }
        sitzungSichern(this);
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (lm != null) lm.removeUpdates(this);
        if (Z.aufzStart != 0) spurSichern(this);
        synchronized (Z) { Z.laeuft = false; }
        if (tts != null) { tts.stop(); tts.shutdown(); }
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onProviderEnabled(@NonNull String provider) {}
    @Override public void onProviderDisabled(@NonNull String provider) { if (Z.ansagen) sagen("GPS ist ausgeschaltet."); }
    @Override public void onStatusChanged(String provider, int status, Bundle extras) {}

    // ---------- Sprache ----------
    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            int r = tts.setLanguage(Locale.GERMANY);
            ttsBereit = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED;
            if (ttsBereit) { for (String s : ttsWarten) tts.speak(s, TextToSpeech.QUEUE_ADD, null, "gug"); ttsWarten.clear(); }
        }
    }

    private void sagen(String text) {
        if (ttsBereit) tts.speak(text, TextToSpeech.QUEUE_ADD, null, "gug");
        else ttsWarten.add(text);
    }

    /** Letzte Ansage zu Ende sprechen lassen, dann den Dienst beenden (spätestens nach 10 s). */
    private void sagenDannBeenden(String text) {
        Handler h = new Handler(Looper.getMainLooper());
        Runnable ende = new Runnable() {
            boolean erledigt;
            @Override public void run() { if (!erledigt) { erledigt = true; beenden(); } }
        };
        if (ttsBereit) {
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) {}
                @Override public void onDone(String id) { if ("ende".equals(id)) h.post(ende); }
                @Override public void onError(String id) { if ("ende".equals(id)) h.post(ende); }
            });
            tts.speak(text, TextToSpeech.QUEUE_ADD, null, "ende");
        }
        h.postDelayed(ende, 10000);
    }

    private void vibrieren() {
        Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (v == null) return;
        long[] muster = { 0, 250, 150, 250 };
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) v.vibrate(VibrationEffect.createWaveform(muster, -1));
        else v.vibrate(muster, -1);
    }

    // ---------- Benachrichtigung ----------
    private void kanalAnlegen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel k = new NotificationChannel(KANAL, "Navigation", NotificationManager.IMPORTANCE_LOW);
            k.setDescription("Route folgen und Aufzeichnen");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(k);
        }
    }

    private Notification benachrichtigung() {
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
        PendingIntent oeffnen = PendingIntent.getActivity(this, 0,
            new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), flags);
        PendingIntent stopp = PendingIntent.getService(this, 1,
            new Intent(this, NaviService.class).setAction(AKTION_BEENDEN), flags);
        String titel, text;
        synchronized (Z) {
            if (Z.folgen && Z.rest != null) {
                titel = "Noch " + NaviRechnen.kmText(Z.rest.meter) + " · " + NaviRechnen.zeitText(Z.rest.stunden);
                text = (Z.abseitsGemeldet ? "Abseits der Route · " : "") + "↑ " + Math.round(Z.rest.auf) + " m"
                    + (Z.aufzeichnen ? " · Aufzeichnung " + NaviRechnen.kmText(Z.aufzMeter) : "");
            } else if (Z.folgen) {
                titel = "Route folgen"; text = "Warte auf GPS …";
            } else if (Z.aufzeichnen) {
                titel = "Aufzeichnung läuft";
                text = NaviRechnen.kmText(Z.aufzMeter) + " · seit " + NaviRechnen.zeitText((System.currentTimeMillis() - Z.aufzStart) / 3600e3);
            } else {
                titel = "Gipfel & Gasse"; text = "unterwegs";
            }
        }
        return new NotificationCompat.Builder(this, KANAL)
            .setSmallIcon(R.drawable.ic_stat_navi)
            .setContentTitle(titel)
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_NAVIGATION)
            .setContentIntent(oeffnen)
            .addAction(0, "Beenden", stopp)
            .build();
    }

    private long zuletztBenachrichtigt;

    private void benachrichtigungAktualisieren() {
        long jetzt = System.currentTimeMillis();
        if (jetzt - zuletztBenachrichtigt < 5000) return;   // nicht öfter als alle 5 s
        zuletztBenachrichtigt = jetzt;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && Z.laeuft) nm.notify(NR, benachrichtigung());
    }
}
