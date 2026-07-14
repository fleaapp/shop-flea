import { useEffect, useState } from 'react';
import { ConnectComponentsProvider } from '@stripe/react-connect-js';
import type { StripeConnectInstance } from '@stripe/connect-js';
import { createFleaConnectInstance } from '@/lib/stripe/connect';
import { Loader2 } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

/**
 * Wraps children in a ConnectComponentsProvider bound to the current seller's
 * AccountSession. Renders a spinner while the instance boots.
 */
const FleaConnectProvider = ({ children }: Props) => {
  const [instance, setInstance] = useState<StripeConnectInstance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const inst = createFleaConnectInstance();
      if (!cancelled) setInstance(inst);
    } catch (e: any) {
      if (!cancelled) setError(e?.message || 'Failed to initialize Stripe Connect');
    }
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <ConnectComponentsProvider connectInstance={instance}>
      {children}
    </ConnectComponentsProvider>
  );
};

export default FleaConnectProvider;
