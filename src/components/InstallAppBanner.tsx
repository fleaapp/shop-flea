import { APP_STORE_URL, PLAY_STORE_URL } from '@/utils/shareLink';
import { useIsWebSharedPreview } from '@/hooks/useIsWebSharedPreview';

/**
 * Prominent Download-the-App CTA shown on shared listing previews when the
 * viewer is on the mobile web (not inside the native Capacitor app and not
 * running as an installed PWA). Uses the official Apple and Google store
 * badges so proportions and branding are correct.
 */
const InstallAppBanner = () => {
  const visible = useIsWebSharedPreview();
  if (!visible) return null;

  return (
    <div className="mx-4 my-3 rounded-2xl bg-charcoal text-white p-4 flex flex-col items-center gap-3 shadow-sm">
      <p className="text-sm font-semibold text-center">
        Get the Flea app to sell, save & buy your next great find.
      </p>
      <div className="flex items-center gap-3 w-full justify-center flex-wrap">
        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Download Flea on the Apple App Store"
          className="inline-block hover:opacity-90 transition-opacity"
        >
          <img
            src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
            alt="Download on the App Store"
            className="h-11 w-auto"
          />
        </a>
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Get Flea on Google Play"
          className="inline-block hover:opacity-90 transition-opacity"
        >
          <img
            src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
            alt="Get it on Google Play"
            className="h-[62px] w-auto -my-2"
          />
        </a>
      </div>
    </div>
  );
};

export default InstallAppBanner;
