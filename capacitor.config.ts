import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.a4050037f32b465a9f1aeb19276ecfa1',
  appName: 'protokoll-klippare-sverige',
  webDir: 'dist',
  server: {
    url: 'https://a4050037-f32b-465a-9f1a-eb19276ecfa1.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#2563eb',
      showSpinner: false
    }
  }
};

export default config;