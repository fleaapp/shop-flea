import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChevronRight } from 'lucide-react';

const PaymentMethodsSection = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);

  const stripeConnected = profile?.stripe_onboarding_complete === true;
  const stripeAccountId = (profile as any)?.stripe_account_id;
  
  console.log('[PaymentMethodsSection] profile:', JSON.stringify({ stripeConnected, stripeAccountId, stripe_onboarding_complete: profile?.stripe_onboarding_complete, stripe_account_id: (profile as any)?.stripe_account_id }));

  const handleConnectStripe = async () => {
    if (!user || !user.email) {
      toast.error('You must be logged in to connect Stripe');
      return;
    }

    setIsConnecting(true);
    try {
      // Check localStorage for a previously saved Stripe account ID
      const savedAccountId = localStorage.getItem('flea_stripe_account_id');
      
      const { data, error } = await cloudSupabase.functions.invoke('stripe-connect-onboard', {
        body: {
          userEmail: user.email,
          userId: user.id,
          stripeAccountId: stripeAccountId || savedAccountId || undefined,
          returnUrl: window.location.origin + '/settings',
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('No onboarding URL returned');

      // Save state to localStorage before redirecting
      if (data.accountId) {
        localStorage.setItem('flea_stripe_account_id', data.accountId);
      }
      localStorage.setItem('flea_stripe_pending', 'true');

      // Also try to save to profile (may fail silently on external DB)
      if (data.accountId && data.accountId !== stripeAccountId) {
        await supabase
          .from('profiles')
          .update({ stripe_account_id: data.accountId } as any)
          .eq('user_id', user.id);
      }

      // Redirect to Stripe onboarding
      window.location.href = data.url;
    } catch (error: any) {
      console.error('Stripe Connect error:', error);
      toast.error('Failed to start Stripe connection. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Check Stripe status on return from onboarding
  const handleCheckStatus = async () => {
    const accountId = stripeAccountId || localStorage.getItem('flea_stripe_account_id');
    console.log('[PaymentMethodsSection] handleCheckStatus called', { accountId, user: !!user });
    if (!accountId || !user) return;

    try {
      console.log('[PaymentMethodsSection] Invoking stripe-connect-status...');
      const { data, error } = await cloudSupabase.functions.invoke('stripe-connect-status', {
        body: { stripeAccountId: accountId },
      });

      if (error) throw error;
      console.log('[PaymentMethodsSection] Status response:', data);

      if (data?.chargesEnabled) {
        localStorage.removeItem('flea_stripe_pending');
        await supabase
          .from('profiles')
          .update({ stripe_onboarding_complete: true, stripe_account_id: accountId } as any)
          .eq('user_id', user.id);
        await refreshProfile();
        toast.success('Stripe account connected successfully!');
      } else if (data?.detailsSubmitted) {
        toast('Stripe is reviewing your account. Check back soon.');
      } else {
        toast('Stripe onboarding incomplete. Please finish setup.');
      }
    } catch (error) {
      console.error('Status check error:', error);
    }
  };

  // Auto-check on mount if returning from Stripe onboarding
  useEffect(() => {
    const savedAccountId = localStorage.getItem('flea_stripe_account_id');
    const isPending = localStorage.getItem('flea_stripe_pending') === 'true';
    const hasAccountId = stripeAccountId || savedAccountId;
    console.log('[PaymentMethodsSection] useEffect check', { stripeAccountId, savedAccountId, isPending, stripeConnected });
    
    // Check status if we have an account and are pending (returning from Stripe)
    if (hasAccountId && isPending && !stripeConnected && user) {
      console.log('[PaymentMethodsSection] Pending return detected, calling handleCheckStatus');
      handleCheckStatus();
    }
  }, [stripeAccountId, stripeConnected, user]);

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
                {stripeConnected ? '✅ Connected' : 'Not connected'}
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

        {/* Refresh status button if account exists but not complete */}
        {(stripeAccountId || localStorage.getItem('flea_stripe_account_id')) && !stripeConnected && (
          <button
            onClick={handleCheckStatus}
            className="w-full text-center text-sm text-primary underline py-2"
          >
            Refresh connection status
          </button>
        )}
      </div>
    </div>
  );
};

export default PaymentMethodsSection;
