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
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import java.io.File;
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
        long aufzStart;
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
            synchronized (Z) { Z.folgen = false; Z.aufzeichnen = false; }
            beenden();
            if (Z.beiNeuem != null) Z.beiNeuem.run();
            return START_NOT_STICKY;
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
            if (Z.aufzeichnen && Z.aufzStart == 0) { Z.aufzStart = System.currentTimeMillis(); Z.spur.clear(); Z.aufzMeter = 0; }
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
            sagen("Ziel erreicht. Schön war's!");
            Z.folgen = false;
            if (!Z.aufzeichnen) beenden();
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
