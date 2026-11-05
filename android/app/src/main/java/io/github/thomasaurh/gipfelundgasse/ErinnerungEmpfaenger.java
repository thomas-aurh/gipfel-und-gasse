package io.github.thomasaurh.gipfelundgasse;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;

/**
 * Erinnerung „Bist du gut angekommen?“ nach der geplanten Rückkehr („Bescheid geben“ in der App).
 * Der Wecker von Android (AlarmManager) ruft diesen Empfänger auch bei geschlossener App; er zeigt eine Mitteilung,
 * deren Antippen die App öffnet. Gestellt und gelöscht über NaviPlugin.erinnern / erinnernAus.
 */
public class ErinnerungEmpfaenger extends BroadcastReceiver {
    static final String KANAL = "erinnerung";
    static final int NUMMER = 4711;

    @Override
    public void onReceive(Context ctx, Intent intent) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel k = new NotificationChannel(KANAL, "Erinnerung an die Rückkehr", NotificationManager.IMPORTANCE_HIGH);
            k.setDescription("Nach der geplanten Rückkehr: Bist du gut angekommen?");
            nm.createNotificationChannel(k);
        }
        Intent oeffnen = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, NUMMER, oeffnen, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String titel = intent.getStringExtra("titel"), text = intent.getStringExtra("text");
        nm.notify(NUMMER, new NotificationCompat.Builder(ctx, KANAL)
            .setSmallIcon(R.drawable.ic_stat_navi)
            .setContentTitle(titel != null ? titel : "Gipfel & Gasse")
            .setContentText(text != null ? text : "Bist du gut angekommen? Gib kurz Bescheid.")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build());
    }
}
