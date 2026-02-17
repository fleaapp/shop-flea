import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { toast } from 'sonner';
import { ChevronRight } from 'lucide-react';

const PaymentMethodsSection = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [localConnected, setLocalConnected] = useState(false);
  const [localAccountId, setLocalAccountId] = useState<string | null>(null);

  // Re-sync localStorage when user ID becomes available (fixes useState initializer race)
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`flea_stripe_connected_${user.id}`) === 'true';
      if (stored) setLocalConnected(true);
    }
  }, [user]);

  const stripeConnected = profile?.stripe_onboarding_complete === true || localConnected;
  const stripeAccountId = profile?.stripe_account_id || localAccountId;
  const stripePending = localStorage.getItem('flea_stripe_pending') === 'true' || (!!stripeAccountId && !stripeConnected);

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

      // Try to save to profile before redirecting
      if (data.accountId) {
        await supabase
          .from('profiles')
          .update({ stripe_account_id: data.accountId } as any)
          .eq('user_id', user.id);
      }

      // Set pending flag for return handling
      localStorage.setItem('flea_stripe_pending', 'true');

      window.location.href = data.url;
    } catch (error: any) {
      console.error('Stripe Connect error:', error);
      toast.error('Failed to start Stripe connection. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Check Stripe status by querying Stripe directly via email
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
        if (user) localStorage.setItem(`flea_stripe_connected_${user.id}`, 'true');
        // Try to persist to DB
        await supabase
          .from('profiles')
          .update({ stripe_onboarding_complete: true, stripe_account_id: data.accountId } as any)
          .eq('user_id', user.id);
        await refreshProfile();
        if (!silent) {
          if (data?.chargesEnabled) {
            toast.success('Stripe account connected successfully!');
          } else {
            toast.success('Stripe onboarding complete! Payments will be enabled shortly.');
          }
        }
      } else if (data?.accountId) {
        setLocalAccountId(data.accountId);
        if (!silent) toast('Stripe onboarding incomplete. Please finish setup.');
      } else {
        if (!silent) toast('No Stripe account found. Please connect Stripe first.');
      }
    } catch (error) {
      console.error('Status check error:', error);
      if (!silent) toast.error('Failed to check Stripe status.');
    } finally {
      setIsChecking(false);
    }
  }, [user, stripeAccountId, refreshProfile]);

  // Only auto-check if returning from Stripe redirect, not on every mount
  useEffect(() => {
    const pending = localStorage.getItem('flea_stripe_pending');
    if (pending && user?.email && !stripeConnected) {
      localStorage.removeItem('flea_stripe_pending');
      handleCheckStatus(true);
    }
  }, [user?.email, stripeConnected, handleCheckStatus]);

  return (
    <div>
      <h2 className="mb-3 max-[375px]:mb-2 text-sm max-[375px]:text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Payment Methods
      </h2>
      <div className="space-y-2 max-[375px]:space-y-1.5">
        {/* Stripe Connect */}
        <div
          className="flex items-center justify-between rounded-2xl p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow bg-card cursor-pointer"
          onClick={stripeConnected ? undefined : handleConnectStripe}
        >
          <div className="flex items-center gap-3 max-[375px]:gap-2">
            <span className="text-base">💳</span>
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
              <span className="text-xs text-green-600 font-medium">Active</span>
            ) : stripePending || isChecking ? (
              <span className="text-xs text-amber-600 font-medium">Verifying</span>
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* PayPal - Coming Soon */}
        <div className="flex items-center justify-between rounded-2xl p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow bg-card opacity-50">
          <div className="flex items-center gap-3 max-[375px]:gap-2">
            <span className="text-base">🅿️</span>
            <div>
              <span className="text-base max-[375px]:text-sm font-medium text-foreground">
                PayPal
              </span>
              <p className="text-xs mt-0.5 text-muted-foreground">Coming soon</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Soon</span>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodsSection;
