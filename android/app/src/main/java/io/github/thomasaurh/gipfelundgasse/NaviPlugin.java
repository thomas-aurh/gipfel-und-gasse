package io.github.thomasaurh.gipfelundgasse;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Brücke zwischen Oberfläche (JavaScript) und Navigationsdienst.
 * JS: const Navi = Capacitor.registerPlugin('Navi');
 *   Navi.starten({ pts, stopps, hinweise, ziele, profil, tempo, rad, folgen, aufzeichnen, ansagen })  startet oder ändert die Sitzung
 *   Navi.route()                     → { pts, laenge, umgeplant }: Strecke, der der Dienst folgt (nach dem Umplanen die neue)
 *   Navi.status()                    → Zustand (auch nach einem Neustart der Oberfläche)
 *   Navi.aufzeichnungHolen({ leeren }) → { start, spur: [[lat, lon, ele, zeit], …] }
 *   Navi.teilen({ name, text, mime }) → Datei über das Teilen-Menü von Android weitergeben (z. B. GPX an CoMaps)
 *   Navi.textTeilen({ text })        → Text über das Teilen-Menü (Standort im Notfall)
 *   Navi.drucken({ name })           → Druckdialog von Android für die aktuelle Seite
 *   Navi.fotoInGalerie({ daten, name, mime }) → Foto (Base64) in die Galerie unter Bilder/Gipfel und Gasse (ab Android 10)
 *   Navi.vorlesen({ text }) / Navi.vorlesenStopp() → Text auf Deutsch vorlesen (Wikipedia-Kurzinfo) bzw. abbrechen
 *   Ereignis "position": { lat, lon, gen, rest, abw, abseits, umgeplant, aufz }
 */
@CapacitorPlugin(
    name = "Navi",
    permissions = {
        @Permission(alias = "standort", strings = { Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION }),
        @Permission(alias = "mitteilungen", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class NaviPlugin extends Plugin {

    private Runnable beiNeuem;
    // eine unterbrochene Navigation setzt die App beim Öffnen nur fort, wenn die Unterbrechung so kurz zurückliegt
    private static final long UNTERBROCHEN_HOECHSTENS = 3 * 3600000L;

    @Override
    public void load() {
        beiNeuem = () -> getBridge().executeOnMainThread(() -> notifyListeners("position", stand()));
        NaviService.Z.beiNeuem = beiNeuem;
    }

    @PluginMethod
    public void starten(PluginCall call) {
        if (getPermissionState("standort") != PermissionState.GRANTED) {
            requestPermissionForAlias("standort", call, "nachStandort");
            return;
        }
        nachStandort(call);
    }

    @PermissionCallback
    private void nachStandort(PluginCall call) {
        if (getPermissionState("standort") != PermissionState.GRANTED) {
            call.reject("Ohne Standort-Erlaubnis geht es nicht. In den Android-Einstellungen unter Apps › Gipfel & Gasse › Berechtigungen freigeben.", "KEIN_STANDORT");
            return;
        }
        // Mitteilungen (ab Android 13): ohne sie läuft der Dienst trotzdem, nur unsichtbar
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("mitteilungen") != PermissionState.GRANTED) {
            requestPermissionForAlias("mitteilungen", call, "nachMitteilungen");
            return;
        }
        nachMitteilungen(call);
    }

    @PermissionCallback
    private void nachMitteilungen(PluginCall call) {
        NaviService.Zustand z = NaviService.Z;
        synchronized (z) {
            JSArray pts = call.getArray("pts", null);
            boolean neueGeometrie = false;
            if (pts != null && pts.length() > 1) {
                int n = pts.length();
                double[] lat = new double[n], lon = new double[n], ele = new double[n];
                boolean[] lu = new boolean[n];
                for (int i = 0; i < n; i++) {
                    JSONArray p = pts.optJSONArray(i);
                    lat[i] = p.optDouble(0); lon[i] = p.optDouble(1);
                    ele[i] = p.isNull(2) ? Double.NaN : p.optDouble(2, Double.NaN);
                    lu[i] = p.optInt(3, 0) == 1;   // Beginn eines neuen Abschnitts
                }
                NaviRechnen.Strecke neu = new NaviRechnen.Strecke(lat, lon, ele, lu);
                neueGeometrie = !neu.gleich(z.strecke);
                // gleiche Strecke: das alte Objekt behalten, sonst verwürfe eine laufende Umplanung ihr Ergebnis
                // (sie prüft, ob noch dieselbe Strecke gilt)
                if (neueGeometrie) z.strecke = neu;
            }
            JSArray stopps = call.getArray("stopps", null);
            int stoppsVorher = z.stopps.size();
            if (stopps != null) {
                // neue Navigation: Texte der vorigen weg (sonst läse die Führung sie weiter, auch wenn sie jetzt aus ist)
                if (call.getBoolean("folgen", z.folgen) && !z.folgen) z.stoppTexte = new java.util.HashMap<>();
                z.stopps = new ArrayList<>();
                z.stoppNamen = new ArrayList<>();
                z.stoppOrte = new ArrayList<>();
                for (int i = 0; i < stopps.length(); i++) {
                    JSONObject s = stopps.optJSONObject(i);
                    if (s == null) continue;
                    String name = s.optString("name", "Stopp");
                    z.stopps.add(new double[] { s.optDouble("d", 0), s.optDouble("min", 0) });
                    z.stoppNamen.add(name);
                    String ort = s.has("lat") && s.has("lon") ? NaviService.ortSchluessel(s.optDouble("lat"), s.optDouble("lon")) : "";
                    z.stoppOrte.add(ort);
                    // Führung: höchstens rund 4000 Zeichen nimmt die Sprachausgabe auf einmal. Ohne Text bleibt ein schon
                    // bekannter stehen (die App nach einem Neustart kennt die Texte nicht mehr, der Dienst schon)
                    String text = s.optString("text", "");
                    if (!text.isEmpty() && !ort.isEmpty()) z.stoppTexte.put(ort, text.length() > 3800 ? text.substring(0, 3800) : text);
                }
            }
            JSArray hinweise = call.getArray("hinweise", null);
            if (hinweise != null) {
                // neue Liste; Merker („schon angesagt“) für gleiche Hinweise übernehmen, alle anderen frisch
                List<double[]> alt = z.hinweise;
                boolean[] altVorab = z.hinweisVorab, altJetzt = z.hinweisJetzt;
                z.hinweise = new ArrayList<>();
                for (int i = 0; i < hinweise.length(); i++) {
                    JSONArray h = hinweise.optJSONArray(i);
                    if (h != null) z.hinweise.add(new double[] { h.optDouble(0), h.optInt(1), h.optInt(2) });
                }
                z.hinweisVorab = new boolean[z.hinweise.size()];
                z.hinweisJetzt = new boolean[z.hinweise.size()];
                for (int i = 0; i < z.hinweise.size(); i++) {
                    double[] n = z.hinweise.get(i);
                    for (int j = 0; j < alt.size() && j < altVorab.length; j++) {
                        double[] o = alt.get(j);
                        if (Math.abs(o[0] - n[0]) < 5 && o[1] == n[1]) { z.hinweisVorab[i] = altVorab[j]; z.hinweisJetzt[i] = altJetzt[j]; break; }
                    }
                }
            }
            // Ziele und Profil fürs Umplanen unterwegs (nur mit neuer Route; fehlen sie, wird nicht umgeplant)
            if (pts != null && pts.length() > 1) {
                NaviService.zieleLesen(call.getArray("ziele", null));
                String profil = call.getString("profil", null);
                z.profil = profil != null && BRouterDateien.PROFILE.contains(profil) ? profil : null;
                if (neueGeometrie) { z.umgeplant = 0; z.umplanVersuch = 0; }
            }
            z.tempo = call.getDouble("tempo", z.tempo);
            z.rad = call.getBoolean("rad", z.rad);
            z.lauf = call.getBoolean("lauf", z.lauf);
            z.kmAnsage = call.getBoolean("kmAnsage", z.kmAnsage);
            z.ansagen = call.getBoolean("ansagen", z.ansagen);
            boolean warFolgen = z.folgen;
            z.folgen = call.getBoolean("folgen", z.folgen) && z.strecke != null;
            if (!z.folgen || !warFolgen) z.folgenSeit = 0;   // neu gestartet: Begrüßung und Ansagen von vorn
            else if (neueGeometrie) {
                // Route während der Fahrt geändert: ohne neue Begrüßung weiter, Fortschritt und Stopps neu
                z.fortschritt = Double.NaN;
                z.stoppAngekuendigt = new boolean[z.stopps.size()];
                z.stoppErreicht = new boolean[z.stopps.size()];
                z.hinweisVorab = new boolean[z.hinweise.size()];
                z.hinweisJetzt = new boolean[z.hinweise.size()];
                z.zielGemeldet = false;
            } else if (z.stopps.size() != stoppsVorher) {
                // gleiche Route (z. B. nur anderes Tempo): Fortschritt bleibt, nur die Stopp-Merker passend groß
                z.stoppAngekuendigt = java.util.Arrays.copyOf(z.stoppAngekuendigt, z.stopps.size());
                z.stoppErreicht = java.util.Arrays.copyOf(z.stoppErreicht, z.stopps.size());
            }
            z.unterbrochen = false;   // ein neuer Start aus der App ersetzt eine unterbrochene Sitzung
            boolean warAufz = z.aufzeichnen;
            z.aufzeichnen = call.getBoolean("aufzeichnen", z.aufzeichnen);
            if (z.aufzeichnen && !warAufz) z.aufzStart = 0;    // neue Aufzeichnung
            if (!z.aufzeichnen && warAufz) z.aufzEnde = System.currentTimeMillis();
        }
        // Aufzeichnung beendet: sofort sichern, auch wenn die Navigation weiterläuft
        if (!z.aufzeichnen && z.aufzStart != 0) NaviService.spurSichern(getContext());
        NaviService.sitzungSichern(getContext());
        Context c = getContext();
        Intent i = new Intent(c, NaviService.class);
        if (z.folgen || z.aufzeichnen) {
            ContextCompat.startForegroundService(c, i);
        } else if (z.laeuft) {
            c.startService(new Intent(c, NaviService.class).setAction(NaviService.AKTION_BEENDEN));
        }
        call.resolve(stand());
    }

    /** Strecke, der der Dienst gerade folgt (nach dem Umplanen eine andere als die geplante): { pts: [[lat, lon], …] }. */
    @PluginMethod
    public void route(PluginCall call) {
        NaviService.Zustand z = NaviService.Z;
        JSObject o = new JSObject();
        JSONArray pts = new JSONArray();
        synchronized (z) {
            if (z.strecke != null) for (int i = 0; i < z.strecke.groesse(); i++) {
                JSONArray p = new JSONArray();
                try { p.put(z.strecke.lat[i]); p.put(z.strecke.lon[i]); } catch (org.json.JSONException e) { continue; }
                pts.put(p);
            }
            o.put("umgeplant", z.umgeplant);
            o.put("laenge", z.strecke != null ? z.strecke.laenge() : 0);
        }
        o.put("pts", pts);
        call.resolve(o);
    }

    @PluginMethod
    public void status(PluginCall call) {
        // Android hat die App unterwegs beendet und der Dienst durfte im Hintergrund nicht neu starten: jetzt, mit
        // offener App, die gesicherte Sitzung fortsetzen (aus dem Vordergrund ist der Start erlaubt)
        NaviService.Zustand z = NaviService.Z;
        Context c = getContext();
        long seit = z.laeuft ? 0 : NaviService.unterbrochenSeit(c);
        String wie = null;
        if (seit > 0 && getPermissionState("standort") == PermissionState.GRANTED) {
            NaviService.sitzungLaden(c);
            long jetzt = System.currentTimeMillis();
            synchronized (z) {
                z.unterbrochen = false;
                if (jetzt - seit > UNTERBROCHEN_HOECHSTENS) {
                    // zu lange her: nicht ungefragt weiter, die Aufzeichnung endet an der Unterbrechung und wartet aufs Speichern
                    if (z.aufzeichnen) z.aufzEnde = seit;
                    z.folgen = false; z.aufzeichnen = false;
                    wie = "alt";
                } else if (z.folgen || z.aufzeichnen) {
                    // die Zeit, in der die App nicht lief, ist keine Bewegungszeit
                    if (z.pause != null) z.pause.pauseMs += Math.max(0, jetzt - seit);
                    wie = "fortgesetzt";
                }
            }
            if ("alt".equals(wie) && z.aufzStart != 0) NaviService.spurSichern(c);
            // gleich in die Datei: ein zweiter Aufruf (Neuladen der Seite) setzt sonst noch einmal fort
            NaviService.sitzungSichern(c);
            if ("fortgesetzt".equals(wie)) ContextCompat.startForegroundService(c, new Intent(c, NaviService.class));
        }
        JSObject st = stand();
        if ("fortgesetzt".equals(wie)) st.put("fortgesetzt", true);
        if ("alt".equals(wie)) st.put("unterbrochenAlt", true);
        call.resolve(st);
    }

    @PluginMethod
    public void aufzeichnungHolen(PluginCall call) {
        NaviService.Zustand z = NaviService.Z;
        JSObject o = new JSObject();
        JSArray a = new JSArray();
        long start;
        synchronized (z) {
            List<double[]> spur = z.spur;
            start = z.aufzStart;
            if (spur.isEmpty()) {
                // nach einem Neustart: die gesicherte Datei lesen
                try {
                    File f = new File(getContext().getFilesDir(), "aufzeichnung.json");
                    if (f.exists()) {
                        JSONObject g = new JSONObject(NaviService.dateiLesen(f));
                        start = g.optLong("start", 0);
                        JSONArray s = g.optJSONArray("spur");
                        if (s != null) for (int i = 0; i < s.length(); i++) a.put(s.optJSONArray(i));
                    }
                } catch (Exception e) { /* nichts gesichert */ }
            } else {
                for (double[] p : spur) {
                    JSONArray q = new JSONArray();
                    try { q.put(p[0]); q.put(p[1]); q.put(Double.isNaN(p[2]) ? JSONObject.NULL : p[2]); q.put((long) p[3]); } catch (Exception e) { continue; }
                    a.put(q);
                }
            }
            if (call.getBoolean("leeren", false) && !z.aufzeichnen) {
                z.spur.clear(); z.aufzStart = 0; z.aufzEnde = 0; z.aufzMeter = 0; z.pause = null;
                new File(getContext().getFilesDir(), "aufzeichnung.json").delete();
            }
        }
        o.put("start", start);
        o.put("spur", a);
        call.resolve(o);
    }

    /** Datei über das Teilen-Menü weitergeben (WebView kann keine Downloads). */
    @PluginMethod
    public void teilen(PluginCall call) {
        String name = call.getString("name", "tour.gpx").replaceAll("[^\\w.\\- äöüÄÖÜß]", "_");
        // entwurf: die Datei liegt schon (in Stücken über dateiStueck geschrieben, z. B. die Sicherung als ZIP)
        boolean entwurf = Boolean.TRUE.equals(call.getBoolean("entwurf", false));
        String text = call.getString("text", "");
        String mime = call.getString("mime", "application/gpx+xml");
        // daten (Base64): Bild oder andere Binärdatei, z. B. ein Foto aus dem Tagebuch; text ist dann der Begleittext
        String daten = call.getString("daten", null);
        try {
            // je Freigabe ein eigener Ordner: der Empfänger liest die Datei erst später, eine zweite Freigabe gleichen
            // Namens darf sie nicht überschreiben
            File ordner = new File(new File(getContext().getCacheDir(), "teilen"), String.valueOf(System.nanoTime()));
            if (!ordner.exists() && !ordner.mkdirs()) throw new Exception("Ordner nicht anlegbar");
            File f = new File(ordner, name);
            if (entwurf) {
                File quelle = new File(new File(new File(getContext().getCacheDir(), "teilen"), "entwurf"), name);
                if (!quelle.exists() || !quelle.renameTo(f)) throw new Exception("Datei fehlt");
            } else {
                byte[] inhalt = daten != null ? android.util.Base64.decode(daten, android.util.Base64.DEFAULT) : text.getBytes(StandardCharsets.UTF_8);
                try (FileOutputStream out = new FileOutputStream(f)) { out.write(inhalt); }
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent senden = new Intent(Intent.ACTION_SEND).setType(mime).putExtra(Intent.EXTRA_STREAM, uri)
                .putExtra(Intent.EXTRA_SUBJECT, name).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if ((daten != null || entwurf) && !text.isEmpty()) senden.putExtra(Intent.EXTRA_TEXT, text);
            Intent wahl = Intent.createChooser(senden, "Weitergeben an …");
            wahl.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(wahl);
            call.resolve();
        } catch (Exception e) {
            call.reject("Teilen ging nicht: " + e.getMessage());
        }
    }

    /** Stück einer großen Datei (Base64) anhängen; erstes = true beginnt sie neu. Danach teilen mit entwurf = true. */
    @PluginMethod
    public void dateiStueck(PluginCall call) {
        String name = call.getString("name", "datei").replaceAll("[^\\w.\\- äöüÄÖÜß]", "_");
        String daten = call.getString("daten", "");
        boolean erstes = Boolean.TRUE.equals(call.getBoolean("erstes", false));
        try {
            File ordner = new File(new File(getContext().getCacheDir(), "teilen"), "entwurf");
            if (!ordner.exists() && !ordner.mkdirs()) throw new Exception("Ordner nicht anlegbar");
            try (FileOutputStream out = new FileOutputStream(new File(ordner, name), !erstes)) {
                out.write(android.util.Base64.decode(daten, android.util.Base64.DEFAULT));
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Datei nicht geschrieben: " + e.getMessage());
        }
    }

    // ---------- Erinnerung nach der geplanten Rückkehr („Bescheid geben“) ----------
    private android.app.PendingIntent erinnerungsWecker(String titel, String text) {
        Intent i = new Intent(getContext(), ErinnerungEmpfaenger.class);
        if (titel != null) i.putExtra("titel", titel);
        if (text != null) i.putExtra("text", text);
        return android.app.PendingIntent.getBroadcast(getContext(), ErinnerungEmpfaenger.NUMMER, i,
            android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE);
    }

    /** Erinnerung zur Zeit zeit (ms seit 1970) stellen; ersetzt eine frühere. Fragt ab Android 13 nach Mitteilungen. */
    @PluginMethod
    public void erinnern(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("mitteilungen") != PermissionState.GRANTED) {
            requestPermissionForAlias("mitteilungen", call, "nachErinnernErlaubnis");
            return;
        }
        nachErinnernErlaubnis(call);
    }

    @PermissionCallback
    private void nachErinnernErlaubnis(PluginCall call) {
        Long zeit = call.getLong("zeit");
        if (zeit == null) { call.reject("Zeit fehlt"); return; }
        android.app.AlarmManager am = (android.app.AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        if (am == null) { call.reject("Wecker von Android nicht verfügbar"); return; }
        // ohne genaue Wecker-Erlaubnis: Android darf ein paar Minuten verschieben, weckt aber auch im Ruhezustand
        am.setAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, zeit, erinnerungsWecker(call.getString("titel"), call.getString("text")));
        JSObject r = new JSObject();
        r.put("mitteilungen", Build.VERSION.SDK_INT < 33 || getPermissionState("mitteilungen") == PermissionState.GRANTED);
        call.resolve(r);
    }

    /** Gestellte Erinnerung löschen (Ankunft gemeldet, ausgeschaltet). */
    @PluginMethod
    public void erinnernAus(PluginCall call) {
        android.app.AlarmManager am = (android.app.AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(erinnerungsWecker(null, null));
        android.app.NotificationManager nm = (android.app.NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(ErinnerungEmpfaenger.NUMMER);
        call.resolve();
    }

    /** Taschenlampe (Blitz der Kamera) an oder aus, für das alpine Notsignal; braucht keine Kamera-Erlaubnis. */
    @PluginMethod
    public void lampe(PluginCall call) {
        boolean an = Boolean.TRUE.equals(call.getBoolean("an", false));
        try {
            android.hardware.camera2.CameraManager cm = (android.hardware.camera2.CameraManager) getContext().getSystemService(Context.CAMERA_SERVICE);
            if (cm == null) { call.reject("Keine Kamera"); return; }
            for (String id : cm.getCameraIdList()) {
                Boolean blitz = cm.getCameraCharacteristics(id).get(android.hardware.camera2.CameraCharacteristics.FLASH_INFO_AVAILABLE);
                if (Boolean.TRUE.equals(blitz)) { cm.setTorchMode(id, an); call.resolve(); return; }
            }
            call.reject("Keine Taschenlampe");
        } catch (Exception e) {
            call.reject("Taschenlampe geht nicht: " + e.getMessage());
        }
    }

    // ---------- Vorlesen (Wikipedia-Kurzinfo): eigene Sprachausgabe, unabhängig vom Navigationsdienst ----------
    private android.speech.tts.TextToSpeech sprache;
    private boolean spracheBereit;
    private String spracheWartet;

    /** Text auf Deutsch vorlesen; ersetzt, was gerade gelesen wird. Beim ersten Mal startet die Sprachausgabe erst. */
    @PluginMethod
    public void vorlesen(PluginCall call) {
        String text = call.getString("text", "");
        if (text.isEmpty()) { call.reject("Kein Text"); return; }
        if (sprache == null) {
            spracheWartet = text;
            sprache = new android.speech.tts.TextToSpeech(getContext(), status -> {
                if (status != android.speech.tts.TextToSpeech.SUCCESS) return;
                int r = sprache.setLanguage(java.util.Locale.GERMANY);
                spracheBereit = r != android.speech.tts.TextToSpeech.LANG_MISSING_DATA && r != android.speech.tts.TextToSpeech.LANG_NOT_SUPPORTED;
                if (spracheBereit && spracheWartet != null) sprache.speak(spracheWartet, android.speech.tts.TextToSpeech.QUEUE_FLUSH, null, "vorlesen");
                spracheWartet = null;
            });
        } else if (spracheBereit) sprache.speak(text, android.speech.tts.TextToSpeech.QUEUE_FLUSH, null, "vorlesen");
        else spracheWartet = text;
        call.resolve();
    }

    @PluginMethod
    public void vorlesenStopp(PluginCall call) {
        spracheWartet = null;
        if (sprache != null) sprache.stop();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (sprache != null) { sprache.shutdown(); sprache = null; }
        // der Dienst läuft weiter, wenn die Activity geht: er darf sie samt WebView nicht über den Rückruf festhalten
        if (NaviService.Z.beiNeuem == beiNeuem) NaviService.Z.beiNeuem = null;
        super.handleOnDestroy();
    }

    /** Text über das Teilen-Menü weitergeben (z. B. den Standort im Notfall per SMS oder Messenger). */
    @PluginMethod
    public void textTeilen(PluginCall call) {
        String text = call.getString("text", "");
        if (text.isEmpty()) { call.reject("Kein Text"); return; }
        try {
            Intent senden = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
            Intent wahl = Intent.createChooser(senden, "Standort senden an …");
            wahl.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(wahl);
            call.resolve();
        } catch (Exception e) {
            call.reject("Teilen ging nicht: " + e.getMessage());
        }
    }

    /**
     * Foto aus dem Reisetagebuch als Original in die Galerie (Bilder/Gipfel und Gasse). Über MediaStore, ab Android 10
     * ohne Speicher-Erlaubnis; die EXIF-Daten der Kamera (Ort, Ausrichtung) bleiben erhalten.
     */
    @PluginMethod
    @android.annotation.TargetApi(Build.VERSION_CODES.Q)   // unter Android 10 bricht die Methode vorher ab (siehe unten)
    public void fotoInGalerie(PluginCall call) {
        String daten = call.getString("daten", "");
        String name = call.getString("name", "Gipfel-und-Gasse.jpg").replaceAll("[^\\w.-]", "_");
        String mime = call.getString("mime", "image/jpeg");
        if (daten.isEmpty() || !mime.startsWith("image/")) { call.reject("Kein Foto"); return; }
        if (Build.VERSION.SDK_INT < 29) { call.reject("In die Galerie speichern geht erst ab Android 10."); return; }
        new Thread(() -> {
            ContentResolver cr = getContext().getContentResolver();
            Uri uri = null;
            try {
                byte[] b = Base64.decode(daten, Base64.DEFAULT);
                ContentValues v = new ContentValues();
                v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                v.put(MediaStore.Images.Media.MIME_TYPE, mime);
                v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Gipfel und Gasse");
                v.put(MediaStore.Images.Media.IS_PENDING, 1);
                uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new Exception("die Galerie nimmt nichts an");
                try (OutputStream out = cr.openOutputStream(uri)) {
                    if (out == null) throw new Exception("nicht schreibbar");
                    out.write(b);
                }
                v.clear();
                v.put(MediaStore.Images.Media.IS_PENDING, 0);
                cr.update(uri, v, null, null);
                call.resolve();
            } catch (Throwable e) {
                if (uri != null) try { cr.delete(uri, null, null); } catch (Exception ignoriert) { /* halb angelegt, Android räumt auf */ }
                call.reject("Foto nicht in der Galerie gespeichert: " + e.getMessage());
            }
        }).start();
    }

    /** Druckdialog von Android (dort auch „Als PDF speichern“). */
    @PluginMethod
    public void drucken(PluginCall call) {
        String name = call.getString("name", "Gipfel und Gasse");
        getBridge().executeOnMainThread(() -> {
            try {
                PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                PrintDocumentAdapter innen = getBridge().getWebView().createPrintDocumentAdapter(name);
                pm.print(name, new FertigMelder(innen, call), new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            } catch (Exception e) {
                call.reject("Drucken ging nicht: " + e.getMessage());
            }
        });
    }

    /** Reicht alles an den Druck-Adapter der WebView weiter und meldet, wenn der Dialog fertig ist. */
    private static final class FertigMelder extends PrintDocumentAdapter {
        private final PrintDocumentAdapter innen;
        private final PluginCall call;
        FertigMelder(PrintDocumentAdapter innen, PluginCall call) { this.innen = innen; this.call = call; }
        @Override public void onStart() { innen.onStart(); }
        @Override public void onLayout(PrintAttributes alt, PrintAttributes neu, android.os.CancellationSignal abbruch,
                                       LayoutResultCallback cb, android.os.Bundle extras) { innen.onLayout(alt, neu, abbruch, cb, extras); }
        @Override public void onWrite(android.print.PageRange[] seiten, android.os.ParcelFileDescriptor ziel,
                                      android.os.CancellationSignal abbruch, WriteResultCallback cb) { innen.onWrite(seiten, ziel, abbruch, cb); }
        @Override public void onFinish() { innen.onFinish(); call.resolve(); }
    }

    private JSObject stand() {
        NaviService.Zustand z = NaviService.Z;
        JSObject o = new JSObject();
        synchronized (z) {
            o.put("laeuft", z.laeuft);
            o.put("folgen", z.folgen);
            o.put("aufzeichnen", z.aufzeichnen);
            if (z.gewitter != null && z.laeuft && (z.folgen || z.aufzeichnen)) o.put("gewitter", z.gewitter);
            if (z.gpsFehler != null && z.laeuft) o.put("gpsFehler", z.gpsFehler);
            if (z.spracheFehlt && z.laeuft && z.ansagen) o.put("spracheFehlt", true);
            Location l = z.letzte;
            if (l != null) {
                o.put("lat", l.getLatitude());
                o.put("lon", l.getLongitude());
                o.put("gen", l.hasAccuracy() ? l.getAccuracy() : null);
                o.put("t", l.getTime());
                // Bewegungsrichtung nur, wenn man sich bewegt (im Stehen ist sie Zufall)
                if (l.hasBearing() && l.hasSpeed() && l.getSpeed() > 0.7f) o.put("richtung", (double) l.getBearing());
            }
            if (z.folgen && z.rest != null) {
                JSObject r = new JSObject();
                r.put("meter", z.rest.meter);
                r.put("auf", z.rest.auf);
                r.put("stunden", z.rest.stunden);
                o.put("rest", r);
                o.put("abw", Double.isNaN(z.abw) ? null : z.abw);
                o.put("abseits", z.abseitsGemeldet);
                o.put("umgeplant", z.umgeplant);
                // nächster Abbiegehinweis innerhalb von 1 km für die Anzeige
                double d = Double.isNaN(z.fortschritt) ? 0 : z.fortschritt;
                for (double[] h : z.hinweise) {
                    if (h[0] <= d + 5) continue;
                    String t = NaviRechnen.hinweisText((int) h[1], (int) h[2]);
                    if (t == null) continue;
                    if (h[0] - d < 1000) { JSObject n = new JSObject(); n.put("bis", h[0] - d); n.put("text", t); o.put("naechster", n); }
                    break;
                }
            }
            if (z.aufzStart != 0) {
                JSObject a = new JSObject();
                a.put("meter", z.aufzMeter);
                a.put("start", z.aufzStart);
                a.put("punkte", z.spur.size());
                if (z.aufzEnde != 0) a.put("ende", z.aufzEnde);
                // Bewegungszeit (Auto-Pause: Stehen zählt nicht) und ob gerade Pause ist
                if (z.pause != null) { a.put("bewegung", z.pause.bewegungMs(z.aufzEnde != 0 ? z.aufzEnde : System.currentTimeMillis())); a.put("pause", z.pause.pausiert && z.aufzEnde == 0); }
                double[] hm = NaviRechnen.hoehenmeter(eles(z.spur), 0, Double.NaN, 8);
                a.put("auf", hm[0]);
                o.put("aufz", a);
            }
        }
        return o;
    }

    private static double[] eles(List<double[]> spur) {
        double[] e = new double[spur.size()];
        for (int i = 0; i < e.length; i++) e[i] = spur.get(i)[2];
        return e;
    }
}
