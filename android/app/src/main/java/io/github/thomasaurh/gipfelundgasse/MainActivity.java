package io.github.thomasaurh.gipfelundgasse;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // eigene Plugins vor dem Start der Brücke anmelden
        registerPlugin(NaviPlugin.class);
        registerPlugin(KartenPlugin.class);
        super.onCreate(savedInstanceState);
        // Kartenpakete über einen eigenen Datei-Server mit echten Byte-Bereichen ausliefern
        getBridge().setWebViewClient(new KartenServer(getBridge()));
    }
}
