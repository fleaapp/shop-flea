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
      // `Native` resizes the WebView itself to sit exactly above the keyboard
      // so no native (black) strip is ever visible between our input bar and
      // the keyboard. `resizeOnFullScreen` keeps this behavior when Android
      // apps run in immersive mode.
      resize: KeyboardResize.Native,
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
