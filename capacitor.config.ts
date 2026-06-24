import type { CapacitorConfig } from '@capacitor/cli';

// The iOS app ALWAYS loads the bundled `dist/` folder. We deliberately do
// NOT support a remote `server.url` here — Apple rejects App Store builds
// that load remote web content, and a stray CAP_SERVER_URL env var was
// causing the device to show stale code instead of the freshly built bundle.
const config: CapacitorConfig = {
  appId: 'com.finditonflea.app',
  appName: 'Flea',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#DDFED7',
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      launchFadeOutDuration: 0,
      backgroundColor: '#DDFED7',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
      logLevel: 1,
    },
  },
  ios: {
    contentInset: 'never',
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: '#DDFED7',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
