import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.1d93444672c7497393780721cb47807c',
  appName: 'Flea',
  webDir: 'dist',
  server: {
    url: 'https://1d934446-72c7-4973-9378-0721cb47807c.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
