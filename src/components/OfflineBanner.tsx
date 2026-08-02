import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Thin app-wide bar shown whenever the device loses connectivity, so a failed
 * action reads as "no internet" rather than "the app is broken".
 */
const OfflineBanner = () => {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="native-safe-top fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-charcoal px-4 py-2 text-xs font-medium text-white"
    >
      <WifiOff size={13} aria-hidden="true" />
      You're offline. We'll reconnect as soon as you're back.
    </div>
  );
};

export default OfflineBanner;
