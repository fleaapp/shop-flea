import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { toast } from 'sonner';
import { ChevronRight } from 'lucide-react';
import stripeLogo from '@/assets/logo-stripe.png';
import paypalLogo from '@/assets/logo-paypal.png';
import { clearStripeConnectionState, getStripeConnectedStorageKey } from '@/utils/stripeConnectionState';

const PaymentMethodsSection = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [localConnected, setLocalConnected] = useState(false);
  const [localAccountId, setLocalAccountId] = useState<string | null>(null);

  // PayPal state
  const [isConnectingPayPal, setIsConnectingPayPal] = useState(false);
  const [isCheckingPayPal, setIsCheckingPayPal] = useState(false);
  const [localPayPalConnected, setLocalPayPalConnected] = useState(false);

  const clearLocalStripeState = useCallback(() => {
    clearStripeConnectionState(user?.id);
    setLocalConnected(false);
    setLocalAccountId(null);
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setLocalConnected(false);
      setLocalAccountId(null);
      setLocalPayPalConnected(false);
      return;
    }

    const dbStripeDisconnected = !profile?.stripe_account_id && profile?.stripe_onboarding_complete !== true;
    if (dbStripeDisconnected) {
      clearLocalStripeState();
    } else {
      const stored = localStorage.getItem(getStripeConnectedStorageKey(user.id)) === 'true';
      setLocalConnected(stored);
    }

    const paypalStored = localStorage.getItem(`flea_paypal_connected_${user.id}`) === 'true';
    setLocalPayPalConnected(paypalStored);
  }, [clearLocalStripeState, profile?.stripe_account_id, profile?.stripe_onboarding_complete, user]);

  const stripeConnected = profile?.stripe_onboarding_complete === true || localConnected;
  const stripeAccountId = profile?.stripe_account_id || localAccountId;

  // Only show "verifying" if user just returned from Stripe onboarding (URL param)
  // or if a status check is actively running. Never show it just because an account ID exists.
  const returnedFromStripe = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('stripe_success') === 'true';
  const stripePending = !stripeConnected && (returnedFromStripe || isChecking);

  const paypalConnected = (profile as any)?.paypal_onboarding_complete === true || localPayPalConnected;
  const returnedFromPayPal = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('paypal_return') === 'true';
  const paypalPending = !paypalConnected && (returnedFromPayPal || isCheckingPayPal);

  const handleConnectStripe = async () => {
    if (!user || !user.email) {
      toast.error('You must be logged in to connect Stripe');
      return;
    }

    setIsConnecting(true);
    try {
      const { data, error } = await invokeCloudFunction('stripe-connect-onboard', {
        stripeAccountId: stripeAccountId || undefined,
        returnUrl: window.location.origin + '/settings',
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No onboarding URL returned');

      if (data.accountId) {
        await supabase
          .from('profiles')
          .update({ stripe_account_id: data.accountId } as any)
          .eq('user_id', user.id);
      }

      // Don't set pending flag — ?stripe_success=true param handles it on return
      window.location.href = data.url;
    } catch (error: any) {
      console.error('Stripe Connect error:', error);
      toast.error('Failed to start Stripe connection. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectPayPal = async () => {
    if (!user || !user.email) {
      toast.error('You must be logged in to connect PayPal');
      return;
    }

    setIsConnectingPayPal(true);
    try {
      const { data, error } = await invokeCloudFunction('paypal-connect-onboard', {
        returnUrl: window.location.origin + '/settings',
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No onboarding URL returned');

      localStorage.setItem('flea_paypal_pending', 'true');
      window.location.href = data.url;
    } catch (error: any) {
      console.error('PayPal Connect error:', error);
      toast.error('Failed to start PayPal connection. Please try again.');
    } finally {
      setIsConnectingPayPal(false);
    }
  };

  const handleCheckStatus = useCallback(async (silent = false) => {
    if (!user?.email) return;
    setIsChecking(true);

    try {
      const { data, error } = await invokeCloudFunction('stripe-connect-status', {
        stripeAccountId: stripeAccountId || undefined,
      });

      if (error) throw error;

      if ((data?.chargesEnabled || data?.detailsSubmitted) && data?.accountId) {
        setLocalConnected(true);
        setLocalAccountId(data.accountId);
        localStorage.setItem(getStripeConnectedStorageKey(user.id), 'true');

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ stripe_onboarding_complete: true, stripe_account_id: data.accountId } as any)
          .eq('user_id', user.id);
        if (updateError) {
          console.error('Failed to persist Stripe status to DB:', updateError);
        }
        await refreshProfile();
        if (!silent) {
          if (data?.chargesEnabled) {
            toast.success('Stripe account connected successfully!');
          } else {
            toast.success('Stripe onboarding complete! Payments will be enabled shortly.');
          }
        }
      } else if (data?.accountId) {
        setLocalConnected(false);
        setLocalAccountId(data.accountId);
        localStorage.removeItem(getStripeConnectedStorageKey(user.id));
        if (!silent) toast('Stripe onboarding incomplete. Please finish setup.');
      } else {
        clearLocalStripeState();
        await refreshProfile();
        if (!silent) toast('No Stripe account found. Please connect Stripe first.');
      }
    } catch (error) {
      console.error('Status check error:', error);
      if (!silent) toast.error('Failed to check Stripe status.');
    } finally {
      setIsChecking(false);
    }
  }, [clearLocalStripeState, refreshProfile, stripeAccountId, user]);

  const handleCheckPayPalStatus = useCallback(async (silent = false) => {
    if (!user?.email) return;
    setIsCheckingPayPal(true);

    try {
      const { data, error } = await invokeCloudFunction('paypal-connect-status', {});

      if (error) throw error;

      if (data?.connected && data?.merchantId) {
        setLocalPayPalConnected(true);
        localStorage.setItem(`flea_paypal_connected_${user.id}`, 'true');
        await refreshProfile();
        if (!silent) toast.success('PayPal account connected successfully!');
      } else {
        setLocalPayPalConnected(false);
        localStorage.removeItem(`flea_paypal_connected_${user.id}`);
        if (!silent) toast('PayPal onboarding incomplete. Please finish setup.');
      }
    } catch (error) {
      console.error('PayPal status check error:', error);
      if (!silent) toast.error('Failed to check PayPal status.');
    } finally {
      setIsCheckingPayPal(false);
    }
  }, [refreshProfile, user]);

  useEffect(() => {
    const pending = localStorage.getItem('flea_stripe_pending');
    const missingFromDb = stripeConnected && !profile?.stripe_account_id;
    if ((pending && user?.email && !stripeConnected) || missingFromDb) {
      handleCheckStatus(true);
    }
  }, [user?.email, stripeConnected, profile?.stripe_account_id, handleCheckStatus]);

  useEffect(() => {
    const paypalPendingFlag = localStorage.getItem('flea_paypal_pending');
    if (paypalPendingFlag && user?.email && !paypalConnected) {
      handleCheckPayPalStatus(true);
    }
  }, [user?.email, paypalConnected, handleCheckPayPalStatus]);

  useEffect(() => {
    if (stripeConnected) {
      localStorage.removeItem('flea_stripe_pending');
    }
  }, [stripeConnected]);

  useEffect(() => {
    if (paypalConnected) {
      localStorage.removeItem('flea_paypal_pending');
    }
  }, [paypalConnected]);

  return (
    <div>
      <h2 className="mb-3 max-[375px]:mb-2 text-sm max-[375px]:text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Payment Methods
      </h2>
      <div className="space-y-2 max-[375px]:space-y-1.5">
        {/* Stripe */}
        <div
          className="flex items-center justify-between rounded-2xl p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow bg-card cursor-pointer"
          onClick={stripeConnected ? undefined : handleConnectStripe}
        >
          <div className="flex items-center gap-3 max-[375px]:gap-2">
            <img src={stripeLogo} alt="Stripe" className="h-7 w-7 object-contain" />
            <div>
              <span className="text-base max-[375px]:text-sm font-medium text-foreground">
                Stripe
              </span>
              <p className={`text-xs mt-0.5 ${stripeConnected ? 'text-green-600' : stripePending || isChecking ? 'text-amber-600' : 'text-muted-foreground'}`}>
                {stripeConnected ? '✅ Connected' : stripePending || isChecking ? '⏳ Verifying...' : 'Not connected'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnecting ? (
              <span className="text-xs text-muted-foreground">Connecting...</span>
            ) : stripeConnected ? (
              <button
                onClick={(e) => { e.stopPropagation(); handleCheckStatus(false); }}
                disabled={isChecking}
                className="text-xs text-green-600 font-medium hover:text-green-700 disabled:opacity-50"
              >
                {isChecking ? 'Syncing...' : 'Active ↻'}
              </button>
            ) : stripePending || isChecking ? (
              <span className="text-xs text-amber-600 font-medium">Verifying</span>
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* PayPal */}
        <div
          className="flex items-center justify-between rounded-2xl p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow bg-card cursor-pointer"
          onClick={paypalConnected ? undefined : handleConnectPayPal}
        >
          <div className="flex items-center gap-3 max-[375px]:gap-2">
            <img src={paypalLogo} alt="PayPal" className="h-7 w-7 object-contain" />
            <div>
              <span className="text-base max-[375px]:text-sm font-medium text-foreground">
                PayPal
              </span>
              <p className={`text-xs mt-0.5 ${paypalConnected ? 'text-green-600' : paypalPending || isCheckingPayPal ? 'text-amber-600' : 'text-muted-foreground'}`}>
                {paypalConnected ? '✅ Connected' : paypalPending || isCheckingPayPal ? '⏳ Verifying...' : 'Not connected'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnectingPayPal ? (
              <span className="text-xs text-muted-foreground">Connecting...</span>
            ) : paypalConnected ? (
              <button
                onClick={(e) => { e.stopPropagation(); handleCheckPayPalStatus(false); }}
                disabled={isCheckingPayPal}
                className="text-xs text-green-600 font-medium hover:text-green-700 disabled:opacity-50"
              >
                {isCheckingPayPal ? 'Syncing...' : 'Active ↻'}
              </button>
            ) : paypalPending || isCheckingPayPal ? (
              <span className="text-xs text-amber-600 font-medium">Verifying</span>
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodsSection;
