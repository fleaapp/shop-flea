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
    },
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      launchFadeOutDuration: 300,
      backgroundColor: '#DDFED7',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    // Native Google Sign-In via @codetrix-studio/capacitor-google-auth.
    // These IDs come from Google Cloud → APIs & Services → Credentials.
    //   - iosClientId: iOS OAuth 2.0 Client ID (bundle: com.finditonflea.app).
    //   - serverClientId: Web OAuth 2.0 Client ID (used to mint the ID token
    //     that Supabase's `signInWithIdToken` verifies).
    // Also add the REVERSED iOS client ID as a URL scheme in
    // ios/App/App/Info.plist under CFBundleURLTypes.
    GoogleAuth: {
      iosClientId: process.env.GOOGLE_IOS_CLIENT_ID || '',
      serverClientId: process.env.GOOGLE_SERVER_CLIENT_ID || '',
      scopes: ['profile', 'email'],
      forceCodeForRefreshToken: false,
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
