import fleaLogoAuth from '@/assets/flea-logo-auth.jpeg';

/**
 * Logo-only brand splash. Used for ordinary app-open / session-hydration waits.
 * No status copy — "Signing you in" is reserved for the actual sign-in flow
 * (see BrandedLoadingScreen).
 */
const SplashScreen = () => (
  <div className="fixed inset-0 bg-primary flex items-center justify-center px-6">
    <img
      src={fleaLogoAuth}
      alt="FLEA"
      width={232}
      height={84}
      loading="eager"
      className="h-20 max-[375px]:h-16 object-contain"
    />
  </div>
);

export default SplashScreen;
