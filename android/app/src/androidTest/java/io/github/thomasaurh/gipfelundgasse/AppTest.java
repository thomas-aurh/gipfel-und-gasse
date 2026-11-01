package io.github.thomasaurh.gipfelundgasse;

import static org.junit.Assert.assertEquals;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Läuft auf Gerät oder Emulator: die App hat die erwartete Kennung. */
@RunWith(AndroidJUnit4.class)
public class AppTest {
    @Test
    public void kennung() {
        Context c = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("io.github.thomasaurh.gipfelundgasse", c.getPackageName());
    }
}
