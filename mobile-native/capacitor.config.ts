import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ir.platereader.shahrak.mobile',
  appName: 'شهرک من',
  webDir: '../ui/dist',
  bundledWebRuntime: false,
  server: {
    // Load bundled offline-ready UI from https://localhost inside Android WebView / capacitor:// on iOS,
    // routing initial view to the dedicated mobile shell (`/m`).
    androidScheme: 'https',
    iosScheme: 'capacitor',
    allowNavigation: ['*'],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#31537a',
    },
  },
};

export default config;
