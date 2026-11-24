import type { CapacitorConfig } from '@capacitor/cli';

// The app id is permanent once the app is on a store. Change it here (and only here) before the first upload.
const config: CapacitorConfig = {
  appId: 'com.mduduzigwija.z83matcher',
  appName: 'Z83 Auto-Matcher',
  webDir: 'dist',
  backgroundColor: '#f3f8fc',
  plugins: {
    SplashScreen: { launchShowDuration: 0, backgroundColor: '#0369a1' },
  },
};

export default config;
