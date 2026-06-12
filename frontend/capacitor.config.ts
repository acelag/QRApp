import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.qrasystem.app',
  appName: 'QRA System',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // In development, point to your local backend so the native app can call APIs.
    // Comment this out for production builds.
    // url: 'http://10.0.2.2:5173',
    // cleartext: true,
  },
  plugins: {
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#ffffff',
      overlaysWebView: false,
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
