package io.github.thomasaurh.gipfelundgasse;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // eigene Plugins vor dem Start der Brücke anmelden
        registerPlugin(NaviPlugin.class);
        registerPlugin(KartenPlugin.class);
        registerPlugin(RoutingPlugin.class);
        super.onCreate(savedInstanceState);
        // Kartenpakete über einen eigenen Datei-Server mit echten Byte-Bereichen ausliefern
        getBridge().setWebViewClient(new KartenServer(getBridge()));
        // Zurück-Taste: zuerst die Oberfläche fragen (Fenster, Kartenwahl, großes Blatt schließen, zurück zu „Planen“);
        // hat sie nichts mehr zu schließen, geht die App in den Hintergrund statt sich zu beenden
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                getBridge().getWebView().evaluateJavascript("window.gugZurueck ? window.gugZurueck() : false", wert -> {
                    if (!"true".equals(wert)) moveTaskToBack(true);
                });
            }
        });
    }
}
