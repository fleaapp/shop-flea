import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { toast } from 'sonner';
import { ChevronRight } from 'lucide-react';
import { clearStripeConnectionState, getStripeConnectedStorageKey } from '@/utils/stripeConnectionState';
import SellerOnboardingSheet from '@/components/SellerOnboardingSheet';
import { openInAppUrl } from '@/lib/openInAppUrl';

const PaymentMethodsSection = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [localConnected, setLocalConnected] = useState(false);
  const [localAccountId, setLocalAccountId] = useState<string | null>(null);
  const [showStripeOnboarding, setShowStripeOnboarding] = useState(false);

  const clearLocalStripeState = useCallback(() => {
    clearStripeConnectionState(user?.id);
    setLocalConnected(false);
    setLocalAccountId(null);
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setLocalConnected(false);
      setLocalAccountId(null);
      return;
    }

    const dbStripeDisconnected = !profile?.stripe_account_id && profile?.stripe_onboarding_complete !== true;
    if (dbStripeDisconnected) {
      clearLocalStripeState();
    } else {
      const stored = localStorage.getItem(getStripeConnectedStorageKey(user.id)) === 'true';
      setLocalConnected(stored);
    }
  }, [clearLocalStripeState, profile?.stripe_account_id, profile?.stripe_onboarding_complete, user]);

  // "Connected" = charges + payouts enabled. "Action required" = charges enabled but payouts paused.
  const [stripeChargesEnabled, setStripeChargesEnabled] = useState(false);
  const [stripePayoutsEnabled, setStripePayoutsEnabled] = useState(false);
  const stripeFullyConnected = (stripeChargesEnabled && stripePayoutsEnabled) || (profile?.stripe_onboarding_complete === true && localConnected);
  const stripeActionRequired = stripeChargesEnabled && !stripePayoutsEnabled && !stripeFullyConnected;
  const stripeAccountId = profile?.stripe_account_id || localAccountId;
  const stripeDetailsSubmitted = !!stripeAccountId && !stripeFullyConnected && !stripeActionRequired;

  // Only show "verifying" if user just returned from Stripe onboarding (URL param)
  // or if a status check is actively running. Never show it just because an account ID exists.
  const returnedFromStripe = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('stripe_success') === 'true';
  const stripePending = !stripeFullyConnected && !stripeDetailsSubmitted && (returnedFromStripe || isChecking);

  const handleConnectStripe = () => {
    if (!user || !user.email) {
      toast.error('You must be logged in to become a seller');
      return;
    }
    setShowStripeOnboarding(true);
  };

  const handleCheckStatus = useCallback(async (silent = false) => {
    if (!user?.email) return;
    setIsChecking(true);

    try {
      const { data, error } = await invokeCloudFunction('stripe-connect-status', {
        stripeAccountId: stripeAccountId || undefined,
      });

      if (error) throw error;

      if (data?.chargesEnabled && data?.payoutsEnabled && data?.accountId) {
        // Fully verified - charges and payouts enabled
        setStripeChargesEnabled(true);
        setStripePayoutsEnabled(true);
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
        if (!silent) toast.success('Your seller account is ready!');
      } else if (data?.chargesEnabled && !data?.payoutsEnabled && data?.accountId) {
        // Charges enabled but payouts paused - action required
        setStripeChargesEnabled(true);
        setStripePayoutsEnabled(false);
        setLocalConnected(false);
        setLocalAccountId(data.accountId);
        localStorage.removeItem(getStripeConnectedStorageKey(user.id));
        await supabase
          .from('profiles')
          .update({ stripe_account_id: data.accountId, stripe_onboarding_complete: false } as any)
          .eq('user_id', user.id);
        await refreshProfile();
        if (!silent) toast('Your seller account needs attention - payouts are paused. Open your seller dashboard to complete verification.');

        // Send a notification if one hasn't been sent recently
        const { data: existing } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'payment_action_required')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        if (!existing?.length) {
          await supabase.from('notifications').insert({
            user_id: user.id,
            type: 'payment_action_required',
            title: 'Seller account needs attention',
            message: '⚠️ Your payouts are paused. Tap here to open your seller dashboard and complete verification.',
          });
          // Fire push notification explicitly
          const { sendPushNotification } = await import('@/utils/pushNotify');
          sendPushNotification(user.id, {
            type: 'payment_action_required',
            title: 'Payment Action Required',
            message: '⚠️ Your payouts are paused. Tap here to open your seller dashboard and complete verification.',
          });
        }
      } else if (data?.detailsSubmitted && data?.accountId) {
        // Details submitted but under review - NOT fully connected yet
        setStripeChargesEnabled(false);
        setLocalConnected(false);
        setLocalAccountId(data.accountId);
        localStorage.removeItem(getStripeConnectedStorageKey(user.id));
        // Persist account ID but NOT onboarding_complete
        await supabase
          .from('profiles')
          .update({ stripe_account_id: data.accountId } as any)
          .eq('user_id', user.id);
        await refreshProfile();
        if (!silent) toast('Your seller account is under review. We\'ll update you when it\'s verified.');
      } else if (data?.accountId) {
        setLocalConnected(false);
        setLocalAccountId(data.accountId);
        localStorage.removeItem(getStripeConnectedStorageKey(user.id));
        if (!silent) toast('Seller setup incomplete. Please finish setup.');
      } else {
        clearLocalStripeState();
        await refreshProfile();
        if (!silent) toast('No seller account found. Please become a seller first.');
      }
    } catch (error) {
      console.error('Status check error:', error);
      if (!silent) toast.error('Failed to check seller status.');
    } finally {
      setIsChecking(false);
    }
  }, [clearLocalStripeState, refreshProfile, stripeAccountId, user]);

  // Auto-verify on return from Stripe (detected via URL param)
  useEffect(() => {
    if (!user?.email || stripeFullyConnected) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_success') === 'true') {
      handleCheckStatus(true);
      // Clean up URL param
      params.delete('stripe_success');
      params.delete('stripe_refresh');
      const newUrl = params.toString()
        ? `${window.location.pathname}?${params}`
        : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [user?.email, stripeFullyConnected, handleCheckStatus]);

  // Also verify if DB has account but not marked complete (e.g. after login)
  useEffect(() => {
    if (!user?.email || stripeFullyConnected || !profile?.stripe_account_id) return;
    handleCheckStatus(true);
  }, [user?.email, stripeFullyConnected, profile?.stripe_account_id, handleCheckStatus]);

  const openSellerDashboard = async () => {
    // In-app browser on native (SFSafariViewController / Chrome Custom Tabs)
    // keeps the user inside Flea. Re-check status when the sheet is dismissed.
    await openInAppUrl('https://dashboard.stripe.com', {
      newTabOnWeb: true,
      onFinished: () => handleCheckStatus(true),
    });
  };

  const handleStripeRowClick = () => {
    if (stripeFullyConnected || stripeDetailsSubmitted || stripeActionRequired) {
      openSellerDashboard();
    } else {
      handleConnectStripe();
    }
  };

  // Determine seller status label and color
  const getStripeStatus = () => {
    if (stripeFullyConnected) return { label: '✅ Connected', color: 'text-green-600' };
    if (stripePending || isChecking) return { label: '⏳ Verifying...', color: 'text-amber-600' };
    if (stripeActionRequired) return { label: '⚠️ Action required', color: 'text-orange-600' };
    if (stripeDetailsSubmitted) return { label: '🔍 Pending review', color: 'text-amber-600' };
    return { label: 'Not connected', color: 'text-muted-foreground' };
  };

  const stripeStatus = getStripeStatus();

  return (
    <>
    <SellerOnboardingSheet
      open={showStripeOnboarding}
      onOpenChange={setShowStripeOnboarding}
      stripeActionRequired={stripeActionRequired}
      returnUrl={typeof window !== 'undefined' ? window.location.origin + '/settings' : undefined}
      onComplete={() => {
        setShowStripeOnboarding(false);
        handleCheckStatus(true);
      }}
    />
    <div>
      <h2 className="mb-3 max-[375px]:mb-2 text-sm max-[375px]:text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Payment Methods
      </h2>
      <div className="space-y-2 max-[375px]:space-y-1.5">
        {/* Seller account */}
        <div
          className="flex items-center justify-between rounded-2xl p-4 pl-6 max-[375px]:p-3 max-[375px]:pl-5 card-shadow bg-card cursor-pointer"
          onClick={handleStripeRowClick}
        >
          <div className="flex items-center gap-3 max-[375px]:gap-2">
            <span aria-hidden className="text-2xl leading-none w-7 h-7 flex items-center justify-center">
              {stripeFullyConnected || stripeDetailsSubmitted || stripeActionRequired ? '📈' : '💸'}
            </span>
            <div>
              <span className="text-base max-[375px]:text-sm font-medium text-foreground">
                {stripeFullyConnected || stripeDetailsSubmitted || stripeActionRequired ? 'Seller Dashboard' : 'Become a Seller'}
              </span>
              <p className={`text-xs mt-0.5 ${stripeStatus.color}`}>
                {stripeStatus.label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stripeFullyConnected ? (
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

        
      </div>
    </div>
    </>
  );
};

export default PaymentMethodsSection;
