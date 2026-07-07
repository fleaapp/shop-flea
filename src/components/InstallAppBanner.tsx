import { useEffect, useState } from 'react';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/utils/shareLink';

/**
 * Prominent Download-the-App CTA shown on shared listing previews when the
 * viewer is on the mobile web (not inside the native Capacitor app and not
 * running as an installed PWA). Encourages installation so future deep links
 * open directly inside the app via Universal Links / App Links.
 */
const InstallAppBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      // Hide inside the native Capacitor app.
      const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
      if (cap?.isNativePlatform?.()) return;

      // Hide when running as an installed PWA (already "in the app").
      const standalone =
        window.matchMedia?.('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      if (standalone) return;

      setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="mx-4 my-3 rounded-2xl bg-charcoal text-white p-4 flex flex-col items-center gap-3 shadow-sm">
      <p className="text-sm font-semibold text-center">
        Get the Flea app to sell, save & buy your next great find.
      </p>
      <div className="flex items-center gap-3 w-full justify-center">
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Download on the App Store"
          className="flex items-center gap-2 bg-white text-charcoal rounded-xl px-3 py-2 min-w-[140px] justify-center"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" fill="currentColor">
            <path d="M16.365 1.43c0 1.14-.42 2.23-1.17 3.03-.8.86-2.1 1.53-3.18 1.44-.14-1.12.42-2.28 1.13-3.02.79-.83 2.15-1.45 3.22-1.45zM20.5 17.36c-.56 1.24-.82 1.79-1.55 2.88-1.02 1.53-2.46 3.44-4.25 3.45-1.6.02-2.01-1.04-4.18-1.03-2.17.01-2.62 1.05-4.22 1.03-1.79-.02-3.15-1.74-4.17-3.27C-.86 17.14-1.16 12.79.94 10.5 2.42 8.87 4.77 7.9 6.97 7.9c2.24 0 3.65 1.05 5.5 1.05 1.79 0 2.88-1.05 5.47-1.05 1.96 0 4.04 1.07 5.52 2.91-4.85 2.66-4.05 9.57-2.96 6.55z"/>
          </svg>
          <div className="text-left leading-tight">
            <div className="text-[9px] uppercase tracking-wide">Download on the</div>
            <div className="text-sm font-semibold -mt-0.5">App Store</div>
          </div>
        </a>
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Get it on Google Play"
          className="flex items-center gap-2 bg-white text-charcoal rounded-xl px-3 py-2 min-w-[140px] justify-center"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <path fill="#00d7fe" d="M3.6 1.8c-.4.4-.6 1-.6 1.8v16.8c0 .8.2 1.4.6 1.8l11-11-11-9.4z"/>
            <path fill="#ffce00" d="M17.5 8.7l-3-2.6-11 9.4 11 9.4 3-2.6c1.6-.9 1.6-3.7 0-4.6z"/>
            <path fill="#ff3946" d="M14.5 6.1L3.6 1.8c-.3.3-.5.7-.5 1.3l11 9.4 3-2.6c-.5-.3-1.6-.9-2.6-1.5v-.1z"/>
            <path fill="#00f076" d="M3.1 20.9c0 .6.2 1 .5 1.3l10.9-4.3v-.1l-11-9.4v12.5z"/>
          </svg>
          <div className="text-left leading-tight">
            <div className="text-[9px] uppercase tracking-wide">Get it on</div>
            <div className="text-sm font-semibold -mt-0.5">Google Play</div>
          </div>
        </a>
      </div>
    </div>
  );
};

export default InstallAppBanner;
