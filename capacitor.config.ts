import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize, KeyboardStyle } from '@capacitor/keyboard';

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
    Keyboard: {
      // `None` keeps the WebView at full height and lets the keyboard float
      // above it. Resizing the WebView caused a black strip to briefly show
      // between the page and the keyboard, and also shifted absolutely
      // positioned elements (logo/form) upward. With `None` the page never
      // moves and no native background is ever revealed.
      resize: KeyboardResize.None,
      resizeOnFullScreen: true,
      // Light chrome for the accessory bar matches the app's cream palette.
      style: KeyboardStyle.Light,
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
    // Cream so any 1-frame gap during keyboard animation blends with the app
    // background instead of flashing the WebView's default black.
    backgroundColor: '#F4F2EB',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
