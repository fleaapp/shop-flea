import fleaLogoAuth from '@/assets/flea-logo-auth.jpeg';

interface BrandedLoadingScreenProps {
  /** Optional status line shown under the logo. */
  message?: string;
}

/**
 * Branded full-screen wait state. Used for the OAuth callback hand-off and the
 * signed-in route loading state so the app never shows a bare lime rectangle
 * between Google returning and the first real screen.
 */
const BrandedLoadingScreen = ({ message = 'Signing you in' }: BrandedLoadingScreenProps) => (
  <div className="native-safe-top fixed inset-0 bg-primary flex flex-col items-center justify-center px-6">
    <img
      src={fleaLogoAuth}
      alt="FLEA"
      width={232}
      height={84}
      loading="eager"
      className="h-12 max-[375px]:h-10 object-contain"
    />
    <div className="mt-8 flex items-center gap-2">
      <span className="h-2 w-2 rounded-full bg-charcoal/70 animate-bounce [animation-delay:-0.3s]" />
      <span className="h-2 w-2 rounded-full bg-charcoal/70 animate-bounce [animation-delay:-0.15s]" />
      <span className="h-2 w-2 rounded-full bg-charcoal/70 animate-bounce" />
    </div>
    <p className="mt-4 text-sm font-medium text-charcoal/70">{message}</p>
  </div>
);

export default BrandedLoadingScreen;
