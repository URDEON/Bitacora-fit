import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bitacorafit.s20fe',
  appName: 'Bitácora Fit Pro',
  webDir: 'dist',
  android: {
    backgroundColor: '#F5F2EB',
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_timer',
      iconColor: '#AD4E38',
    },
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#F5F2EB',
    },
  },
};

export default config;
