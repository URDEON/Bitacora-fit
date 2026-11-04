package com.bitacorafit.s20fe;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ScreenAwakePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
