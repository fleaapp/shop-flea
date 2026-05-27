import type { CapacitorConfig } from '@capacitor/cli';

const liveReloadUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.finditonflea.app',
  appName: 'Flea',
  webDir: 'dist',
  ...(liveReloadUrl
    ? {
        server: {
          url: liveReloadUrl,
          cleartext: true,
        },
      }
    : {}),
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#F5F1EB',
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      launchFadeOutDuration: 0,
      backgroundColor: '#F5F1EB',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
  ios: {
    contentInset: 'never',
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: '#F5F1EB',
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
