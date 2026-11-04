import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bitacorafit.s20fe',
  appName: 'Bitácora Fit Pro',
  webDir: 'dist',
  android: {
    backgroundColor: '#141416',
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_timer',
      iconColor: '#D94E28',
    },
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#141416',
    },
  },
};

export default config;
