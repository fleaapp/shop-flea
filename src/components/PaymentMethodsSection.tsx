import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChevronRight } from 'lucide-react';

const PaymentMethodsSection = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [localConnected, setLocalConnected] = useState(false);
  const [localAccountId, setLocalAccountId] = useState<string | null>(null);

  const stripeConnected = profile?.stripe_onboarding_complete === true || localConnected;
  const stripeAccountId = (profile as any)?.stripe_account_id || localAccountId;

  const handleConnectStripe = async () => {
    if (!user || !user.email) {
      toast.error('You must be logged in to connect Stripe');
      return;
    }

    setIsConnecting(true);
    try {
      const { data, error } = await cloudSupabase.functions.invoke('stripe-connect-onboard', {
        body: {
          userEmail: user.email,
          userId: user.id,
          stripeAccountId: stripeAccountId || undefined,
          returnUrl: window.location.origin + '/settings',
        },
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
      const { data, error } = await cloudSupabase.functions.invoke('stripe-connect-status', {
        body: { 
          stripeAccountId: stripeAccountId || undefined,
          userEmail: user.email,
        },
      });

      if (error) throw error;

      if (data?.chargesEnabled && data?.accountId) {
        setLocalConnected(true);
        setLocalAccountId(data.accountId);
        // Try to persist to DB
        await supabase
          .from('profiles')
          .update({ stripe_onboarding_complete: true, stripe_account_id: data.accountId } as any)
          .eq('user_id', user.id);
        await refreshProfile();
        if (!silent) toast.success('Stripe account connected successfully!');
      } else if (data?.detailsSubmitted) {
        if (data?.accountId) setLocalAccountId(data.accountId);
        if (!silent) toast('Stripe is reviewing your account. Check back soon.');
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

  // Auto-check on mount if not already connected
  useEffect(() => {
    if (user?.email && !stripeConnected) {
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
              <p className={`text-xs mt-0.5 ${stripeConnected ? 'text-green-600' : 'text-muted-foreground'}`}>
                {stripeConnected ? '✅ Connected' : isChecking ? 'Checking...' : 'Not connected'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnecting ? (
              <span className="text-xs text-muted-foreground">Connecting...</span>
            ) : stripeConnected ? (
              <span className="text-xs text-green-600 font-medium">Active</span>
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

        {/* Refresh status button if not connected */}
        {!stripeConnected && (
          <button
            onClick={() => handleCheckStatus(false)}
            disabled={isChecking}
            className="w-full text-center text-sm text-primary underline py-2 disabled:opacity-50"
          >
            {isChecking ? 'Checking...' : 'Refresh connection status'}
          </button>
        )}
      </div>
    </div>
  );
};

export default PaymentMethodsSection;
