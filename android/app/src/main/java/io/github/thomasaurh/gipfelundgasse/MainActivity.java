package io.github.thomasaurh.gipfelundgasse;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // eigenes Plugin vor dem Start der Brücke anmelden
        registerPlugin(NaviPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
