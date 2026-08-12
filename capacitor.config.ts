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
      // `Body` pads the <body> so WebKit's built-in scroll-to-focused-input
      // keeps the focused field visible above the keyboard, without
      // shrinking the WebView itself (which was previously exposing a black
      // strip). The WebView stays full height; only the body gains a bottom
      // inset equal to the keyboard height.
      resize: KeyboardResize.Body,
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
    SocialLogin: {
      providers: {
        google: true,
        apple: true,
        facebook: false,
        twitter: false,
      },
    },
  },
  ios: {
    // Edge-to-edge: WebView draws under the home indicator so the page's own
    // background (lime on auth, cream in-app) fills the bottom safe area,
    // mirroring the transparent status-bar overlay at the top. No element
    // positions change — only the native strip beneath the WebView goes away.
    contentInset: 'never',
    limitsNavigationsToAppBoundDomains: false,
    // Fully transparent so the page's own background shows through in any
    // area the WebView temporarily exposes (e.g. around the keyboard). A
    // fixed colour here would show as a mismatched strip against non-cream
    // routes (lime auth, dark drawer backdrops).
    backgroundColor: '#00000000',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
