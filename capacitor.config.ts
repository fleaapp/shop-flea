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
      overlaysWebView: true,
      style: 'DARK',
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
  },
  ios: {
    // Edge-to-edge: WebView draws under the home indicator so the page's own
    // background (lime on auth, cream in-app) fills the bottom safe area,
    // mirroring the transparent status-bar overlay at the top. No element
    // positions change — only the native strip beneath the WebView goes away.
    contentInset: 'never',
    limitsNavigationsToAppBoundDomains: false,
    // Transparent so the native layer behind the WebView never paints its own
    // color into the safe-area regions.
    backgroundColor: '#00000000',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
