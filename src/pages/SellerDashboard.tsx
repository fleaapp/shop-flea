import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, AlertTriangle, Info, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { useOrders, isOrderRefunded } from '@/hooks/useOrders';
import { useUnreadOrderMessages } from '@/hooks/useUnreadOrderMessages';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { SettleBalanceSheet } from '@/components/SettleBalanceSheet';
import SellerOnboardingSheet from '@/components/SellerOnboardingSheet';
import EnablePushBanner from '@/components/EnablePushBanner';
import { supabase } from '@/lib/supabase';
import { logError } from '@/lib/errorLogger';
import { INSTANT_PAYOUT_RATE } from '@/utils/feeCalculator';


const BalanceInfo = ({ title, body, tone = 'muted' }: { title: string; body: string; tone?: 'muted' | 'amber' | 'primary' }) => {
  const iconClass =
    tone === 'amber'
      ? 'text-amber-800/70 hover:bg-amber-100'
      : tone === 'primary'
        ? 'text-charcoal/70 hover:bg-black/5'
        : 'text-muted-foreground hover:bg-muted';
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`About ${title}`}
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center justify-center h-5 w-5 rounded-full transition-colors ${iconClass}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4 rounded-2xl z-[100]" side="top" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <p className="text-sm font-semibold mb-2">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{body}</p>
      </PopoverContent>
    </Popover>
  );
};

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type PayoutRow = {
  id: string;
  amount: number;
  status: string;
  arrivalDate: number;
  created: number;
  method: string;
};

type ActivityRow = {
  id: string;
  type: string;
  amount: number;
  net: number;
  fee: number;
  status: string;
  created: number;
  available_on?: number;
  description?: string | null;
};

type HeldRow = {
  orderId: string;
  orderGroupId: string | null;
  title: string | null;
  grossCents: number;
  feeCents: number;
  netCents: number;
  state: 'awaiting' | 'shipped' | 'delivered' | 'refund_requested' | string;
};

type DashboardData = {
  connected: boolean;
  demo?: boolean;
  currency?: string;
  available?: number;
  pending?: number;
  instantAvailable?: number;
  unshippedCents?: number;
  heldBreakdown?: HeldRow[];
  availableToWithdraw?: number;
  instantAvailableToWithdraw?: number;
  negativeBalanceCents?: number;
  isNegative?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  hasSucceededCharge?: boolean;
  instantPayoutEligible?: boolean;
  hasPaidPayout?: boolean;
  hasExternalAccount?: boolean | null;
  externalAccountDue?: boolean;
  nextPayout?: { amount: number; arrivalDate: number; status: string } | null;
  payouts?: PayoutRow[];
  activity?: ActivityRow[];
};

const HELD_STATE_LABEL: Record<string, string> = {
  awaiting: 'Awaiting shipment',
  shipped: 'Shipped',
  delivered: 'Buyer protection',
  refund_requested: 'Refund requested',
};


const fmtMoney = (cents: number, currency = 'aud') =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format((cents ?? 0) / 100);

const fmtDate = (unix: number) => {
  if (!unix) return '—';
  return new Date(unix * 1000).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const statusLabel = (s: string) => {
  switch (s) {
    case 'paid':
      return 'Paid';
    case 'pending':
      return 'Pending';
    case 'in_transit':
      return 'In transit';
    case 'failed':
      return 'Failed';
    case 'canceled':
      return 'Canceled';
    default:
      return s;
  }
};

const statusClass = (s: string) => {
  if (s === 'paid') return 'bg-primary/60 text-charcoal';
  if (s === 'in_transit' || s === 'pending') return 'bg-muted text-charcoal';
  if (s === 'failed' || s === 'canceled') return 'bg-destructive/15 text-destructive';
  return 'bg-muted text-charcoal';
};

const activityMeta = (type: string): { emoji: string; label: string } => {
  switch (type) {
    case 'charge':
    case 'payment':
      return { emoji: '💰', label: 'Sale' };
    case 'refund':
    case 'payment_refund':
      return { emoji: '↩️', label: 'Refund' };
    case 'adjustment':
      return { emoji: '⚖️', label: 'Adjustment' };
    case 'transfer':
      return { emoji: '🔁', label: 'Transfer' };
    case 'topup':
      return { emoji: '⬆️', label: 'Top up' };
    default:
      return { emoji: '•', label: type.replace(/_/g, ' ') };
  }
};

const isTransportError = (error: unknown) => {
  const message = String((error as any)?.message || error || '').toLowerCase();
  return message.includes('load failed') || message.includes('failed to fetch') || message.includes('networkerror');
};

const invokePayoutWithRetry = async (method: 'standard' | 'instant') => {
  let firstResult: Awaited<ReturnType<typeof invokeCloudFunction>> | null = null;
  try {
    firstResult = await invokeCloudFunction('stripe-connect-payout', { method });
    if (!firstResult.error || !isTransportError(firstResult.error)) return firstResult;
  } catch (firstError) {
    if (!isTransportError(firstError)) throw firstError;
    firstResult = {
      data: null,
      error: firstError as Error,
      response: undefined as any,
    };
  }

  try {
    const retry = await supabase.functions.invoke('stripe-connect-payout', {
      body: { method },
    });
    if (!retry.error || !isTransportError(retry.error)) return retry;
    throw retry.error;
  } catch (retryError) {
    void logError({
      title: 'Payout transport failed',
      message: (retryError as any)?.message || firstResult?.error?.message || 'Payout request could not reach the function',
      route: '/seller-dashboard',
      context: {
        function_name: 'stripe-connect-payout',
        payout_method: method,
        first_error: firstResult?.error?.message || 'Unknown transport error',
        retry_error: (retryError as any)?.message || String(retryError),
      },
    });
    throw retryError;
  }
};

const SellerDashboard = () => {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth() as any;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payoutLoading, setPayoutLoading] = useState<null | 'standard' | 'instant'>(null);
  const [confirm, setConfirm] = useState<null | 'standard' | 'instant'>(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [actionRequiredOpen, setActionRequiredOpen] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [verificationError, setVerificationError] = useState<any>(null);
  const [needsIdDocument, setNeedsIdDocument] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<{
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    accountId: string | null;
  } | null>(null);

  const { sellerOrderGroups } = useOrders();
  const { perOrder } = useUnreadOrderMessages();
  const salesBadge = useMemo(() => {
    const toShipCount = sellerOrderGroups.filter((g) => g.status === 'awaiting').length;
    const sellerUnread = sellerOrderGroups.reduce((sum, g) => {
      return sum + g.orders.reduce((s, o) => s + (perOrder.get(o.id) || 0), 0);
    }, 0);
    const count = toShipCount + sellerUnread;
    return count || undefined;
  }, [sellerOrderGroups, perOrder]);

  // Overdue: any awaiting order more than 4 days old — matches the buyer-side
  // "Overdue" threshold in Sales and the overdue alert job. Surfaced as a red
  // banner because push notifications aren't a reliable channel here.
  const overdueGroups = useMemo(() => {
    const threshold = Date.now() - 4 * 24 * 60 * 60 * 1000;
    return sellerOrderGroups.filter(
      (g) => g.status === 'awaiting' && new Date(g.created_at).getTime() < threshold,
    );
  }, [sellerOrderGroups]);

  const hasAccountId = !!(profile as any)?.stripe_account_id;
  const dbOnboardingComplete = (profile as any)?.stripe_onboarding_complete === true;
  // Never gate the dashboard purely on the DB flag — Stripe can reopen
  // requirements after verification. Show the dashboard as soon as an account
  // exists and surface an action-required banner if live status regresses.
  const notOnboarded = !hasAccountId && !dbOnboardingComplete;
  // Action-required banner: only when charges are disabled. Payouts paused
  // is normal during Stripe's initial fraud-hold window and is handled by
  // the "first payout may take around 7 days" note instead.
  const liveActionRequired =
    hasAccountId && stripeStatus != null && !stripeStatus.chargesEnabled;

  const load = async () => {
    setError(null);
    try {
      const { data: res, error: err } = await invokeCloudFunction(
        'stripe-connect-dashboard',
        {}
      );
      if (err) throw new Error(err.message || 'Failed to load');
      setData(res as DashboardData);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const probeStatus = async () => {
    if (!hasAccountId) return;
    try {
      const { data } = await invokeCloudFunction('stripe-connect-status', {
        stripeAccountId: (profile as any).stripe_account_id,
      });
      if (!data) return;
      setStripeStatus({
        chargesEnabled: !!(data as any).chargesEnabled,
        payoutsEnabled: !!(data as any).payoutsEnabled,
        detailsSubmitted: !!(data as any).detailsSubmitted,
        accountId: (data as any).accountId || null,
      });
      setNeedsIdDocument(!!(data as any).needsIdDocument);
      setVerificationError((data as any).verificationError ?? null);
    } catch {
      // Non-blocking. Banner stays hidden if we can't reach Stripe.
    }
  };

  useEffect(() => {
    if (!notOnboarded) {
      load();
      probeStatus();
    } else {
      setLoading(false);
    }
    // Refresh when tab regains focus so balance and status update after a sale.
    const onFocus = () => {
      if (!notOnboarded) {
        load();
        probeStatus();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notOnboarded, hasAccountId]);


  const currency = data?.currency ?? 'aud';
  const available = data?.available ?? 0;
  const instantAvailable = data?.instantAvailable ?? 0;
  const unshippedCents = data?.unshippedCents ?? 0;
  const availableToWithdraw = data?.availableToWithdraw ?? Math.max(available - unshippedCents, 0);
  const instantAvailableToWithdraw = data?.instantAvailableToWithdraw ?? Math.max(instantAvailable - unshippedCents, 0);
  const negativeCents = data?.negativeBalanceCents ?? 0;
  const isNegative = negativeCents > 0;
  const canPayout =
    !isNegative &&
    !!data?.chargesEnabled &&
    !!data?.payoutsEnabled &&
    !!data?.hasSucceededCharge &&
    availableToWithdraw > 0;
  const canInstant =
    canPayout && !!data?.instantPayoutEligible && instantAvailableToWithdraw > 0;

  // Only claim bank details are missing when Stripe explicitly says so. A
  // verified seller always has a bank account (payouts_enabled requires one),
  // so an unknown/undefined value must never trigger this banner.
  const needsBankDetails =
    !!data?.connected &&
    !isNegative &&
    !!data?.chargesEnabled &&
    (data?.hasExternalAccount === false || data?.externalAccountDue === true);

  // One clear reason the payout buttons are disabled.
  const payoutBlockedReason = (() => {
    if (isNegative) return 'Settle your outstanding balance to withdraw.';
    if (needsBankDetails) return 'Add your bank details to withdraw.';
    if (!data?.chargesEnabled) return 'Finish verification to withdraw.';
    if (!data?.hasSucceededCharge) return 'Available once your first sale clears.';
    if (availableToWithdraw <= 0 && unshippedCents > 0)
      return 'Your funds are held until orders are delivered and the 48 hour buyer protection window closes.';
    if (availableToWithdraw <= 0) return 'Nothing to withdraw yet.';
    return null;
  })();

  const instantFee = Math.round(instantAvailableToWithdraw * INSTANT_PAYOUT_RATE);
  const instantNet = Math.max(instantAvailableToWithdraw - instantFee, 0);

  // Instant payout has extra requirements on top of a standard payout, so it
  // gets its own explanation instead of silently greying out.
  const instantBlockedReason = (() => {
    if (payoutBlockedReason) return payoutBlockedReason;
    if (!data?.instantPayoutEligible)
      return 'Instant payouts are not supported by your bank yet - use a standard payout.';
    if (instantAvailableToWithdraw <= 0)
      return 'None of your released funds are eligible for instant payout right now.';
    return null;
  })();


  const handlePayout = async (method: 'standard' | 'instant') => {
    setConfirm(null);
    setPayoutLoading(method);
    try {
      const { data: res, error: err } = await invokePayoutWithRetry(method);
      if (err) throw new Error(err.message || 'Payout failed');
      if ((res as any)?.error) throw new Error((res as any).error);
      toast.success(
        method === 'instant'
          ? 'Instant payout sent. Funds usually arrive within 30 minutes.'
          : 'Payout on the way. Funds usually arrive in 1-2 business days.'
      );
      await load();
    } catch (e: any) {
      toast.error(
        isTransportError(e)
          ? 'Payout request could not reach the payment provider. Please try again.'
          : e?.message || 'Payout failed. Please try again.'
      );
    } finally {
      setPayoutLoading(null);
    }
  };

  return (
    <div className="native-safe-top fixed inset-0 bg-background flex flex-col overflow-hidden">
      <header className="shrink-0 bg-background">
        <div className="relative flex items-center px-4 py-3">
          <button
            onClick={() => navigate('/settings')}
            aria-label="Back"
            className="w-9 h-9 flex items-center justify-center -ml-2 rounded-full hover:bg-muted/60 active:bg-muted"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold text-foreground">
            Seller Dashboard
          </h1>
          <div className="ml-auto relative">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/sales')}
              aria-label="Sales"
              className="h-12 w-12 max-[375px]:h-10 max-[375px]:w-10 rounded-xl border-2 border-border bg-card hover:bg-secondary text-lg max-[375px]:text-base"
            >
              💸
            </Button>
            {salesBadge && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                {salesBadge}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-10">
        <div className="pt-3">
          <EnablePushBanner />
        </div>

        {overdueGroups.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('/sales')}
            className="w-full mt-2 rounded-2xl bg-destructive/10 border-2 border-destructive/40 p-4 text-left active:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-2 text-[11px] font-semibold text-destructive uppercase tracking-wide">
              <AlertTriangle className="h-3.5 w-3.5" /> Overdue shipments
            </div>
            <p className="text-[13px] text-charcoal mt-1.5 leading-relaxed">
              You have <span className="font-bold">{overdueGroups.length}</span> order{overdueGroups.length === 1 ? '' : 's'} that {overdueGroups.length === 1 ? 'is' : 'are'} more than 3 days old and still awaiting shipment. Ship them now to avoid auto-refunds and keep your seller rating.
            </p>
          </button>
        )}
        {notOnboarded ? (
          <div className="pt-24 text-center text-sm text-muted-foreground max-w-[280px] mx-auto">
            Finish your seller setup to see your balance and payouts here.
          </div>
        ) : loading ? (
          <div className="space-y-3 pt-2">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : error ? (
          <div className="pt-16 text-center text-sm text-muted-foreground max-w-[280px] mx-auto">
            {error}
          </div>
        ) : (
          <>
            {needsBankDetails && (
              <section className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 mt-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-amber-700 uppercase tracking-wide">
                  <AlertTriangle className="h-3.5 w-3.5" /> Bank details needed
                </div>
                <p className="text-[13px] text-charcoal mt-1.5 leading-relaxed">
                  You can take sales, but we can't pay you out yet - there's no bank account on file. Add your account details and any money you've earned will be released to you.
                </p>
                <Button
                  onClick={() => setActionRequiredOpen(true)}
                  className="w-full mt-3 h-11 rounded-xl bg-amber-600 text-white hover:bg-amber-700 font-semibold"
                >
                  Add bank details
                </Button>
              </section>
            )}

            {liveActionRequired && (
              <section className="rounded-2xl bg-orange-50 border-2 border-orange-300 p-4 mt-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-orange-700 uppercase tracking-wide">
                  <AlertTriangle className="h-3.5 w-3.5" /> Action required
                </div>
                <p className="text-[13px] text-charcoal mt-1.5 leading-relaxed">
                  Our payment processor needs a few more details to keep your payouts running. This can happen when extra verification is needed after your first sales. Complete it in the app to keep listing and getting paid.
                </p>
                <Button
                  onClick={() => setActionRequiredOpen(true)}
                  className="w-full mt-3 h-11 rounded-xl bg-orange-600 text-white hover:bg-orange-700 font-semibold"
                >
                  Complete verification
                </Button>
              </section>
            )}

            {/* Balance breakdown: Held for unshipped → Clearing → First payout hold */}
            {!isNegative && (() => {
              const pendingCents = data?.pending ?? 0;
              const hasPaidPayout =
                data?.hasPaidPayout ?? (data?.payouts ?? []).some((p) => p.status === 'paid');

              // Seller-net for a pending Stripe balance transaction (gross minus
              // the Secure Checkout Fee that Flea collects as application_fee).
              const netCents = (a: ActivityRow) =>
                Math.max(
                  typeof a.net === 'number' ? a.net : (a.amount ?? 0) - (a.fee ?? 0),
                  0,
                );

              // 1. Actual first sale = earliest pending payment by created timestamp
              const pendingPayments = (data?.activity ?? [])
                .filter((a) => a.status === 'pending' && a.type === 'payment')
                .slice()
                .sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
              const firstSale = !hasPaidPayout && pendingPayments.length > 0 ? pendingPayments[0] : null;
              const firstHoldCents = firstSale ? netCents(firstSale) : 0;

              // 2. First sale is almost always also the first (still-unshipped) order — subtract from unshipped first
              const unshippedRemaining = Math.max(unshippedCents - firstHoldCents, 0);
              const unshippedInAvailable = Math.min(unshippedRemaining, available);
              const unshippedInPending = Math.max(unshippedRemaining - available, 0);

              // 3. Clearing = remaining pending after first hold + unshipped
              const clearing = Math.max(pendingCents - firstHoldCents - unshippedInPending, 0);

              // 4. Earliest available_on among the non-first-sale pending items
              const clearingPending = firstSale
                ? pendingPayments.filter((a) => a.id !== firstSale.id)
                : pendingPayments;
              const earliestClearing = clearingPending
                .filter((a) => a.available_on)
                .reduce<number>((min, a) => (min === 0 ? (a.available_on as number) : Math.min(min, a.available_on as number)), 0);

              return (
                <>
                  {(unshippedRemaining > 0 || clearing > 0) && (() => {
                    const pendingTotal = unshippedRemaining + clearing;
                    // Every order whose money is still held, straight from the
                    // backend so the rows always add up to the same rule the
                    // held total uses. Grouped so a bundle reads as one sale.
                    const held = data?.heldBreakdown ?? [];
                    const groupMap = new Map<string, HeldRow[]>();
                    held.forEach((h) => {
                      const key = h.orderGroupId ?? h.orderId;
                      groupMap.set(key, [...(groupMap.get(key) ?? []), h]);
                    });
                    const heldGroups = Array.from(groupMap.entries()).map(([key, rows]) => ({
                      key,
                      rows,
                      gross: rows.reduce((s, r) => s + r.grossCents, 0),
                      fee: rows.reduce((s, r) => s + r.feeCents, 0),
                      net: rows.reduce((s, r) => s + r.netCents, 0),
                      title: rows.length > 1 ? `Bundle (${rows.length} items)` : rows[0].title ?? 'Item',
                      state: rows[0].state,
                    }));
                    const grossTotal = heldGroups.reduce((s, g) => s + g.gross, 0);
                    const feeTotal = heldGroups.reduce((s, g) => s + g.fee, 0);
                    const heldNetTotal = heldGroups.reduce((s, g) => s + g.net, 0);

                    // Money that has left the held buckets (order completed) but
                    // is still moving through the payment provider. It is part of
                    // the Pending header, so it needs its own row.
                    const rows: Array<{
                      key: string;
                      title: string;
                      subtitle: string;
                      net: number;
                      gross?: number;
                      fee?: number;
                    }> = heldGroups.map((g) => ({
                      key: g.key,
                      title: g.title,
                      subtitle: HELD_STATE_LABEL[g.state] ?? 'In progress',
                      net: g.net,
                      gross: g.gross,
                      fee: g.fee,
                    }));

                    const residual = Math.max(pendingTotal - heldNetTotal, 0);
                    if (residual > 0) {
                      rows.push({
                        key: 'clearing',
                        title: 'Clearing from completed sales',
                        subtitle: earliestClearing
                          ? `Releases ${fmtDate(earliestClearing)}`
                          : 'On its way to Available',
                        net: residual,
                      });
                    }


                    return (
                      <section className="rounded-2xl bg-card border border-border mt-2 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div className="text-[13px] font-medium text-foreground">Pending</div>
                            <BalanceInfo
                              title="Pending"
                              body={
                                'Funds waiting to be released. Amounts shown are what you receive, after the Transaction Fee.\n\n• Add a valid tracking number - it must be approved by Flea before it counts.\n• Once the parcel is marked delivered, a 48-hour buyer protection window starts.\n• Funds move to Available once that window closes with no issues raised.'
                              }
                            />
                          </div>
                          <div className="text-base font-semibold text-foreground">
                            {fmtMoney(pendingTotal, currency)}
                          </div>
                        </div>
                        {feeTotal > 0 && (
                          <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                            Sale total {fmtMoney(grossTotal, currency)} - fees {fmtMoney(feeTotal, currency)} = {fmtMoney(grossTotal - feeTotal, currency)} to you.
                          </div>
                        )}
                        {earliestClearing > 0 && (
                          <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                            Next release {fmtDate(earliestClearing)}.
                          </div>
                        )}
                        {heldGroups.length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => setPendingOpen((v) => !v)}
                              className="mt-3 w-full flex items-center justify-between text-[12px] font-medium text-charcoal/80"
                            >
                              <span>Sales in progress ({heldGroups.length})</span>
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${pendingOpen ? 'rotate-180' : ''}`}
                              />
                            </button>
                            {pendingOpen && (
                              <ul className="mt-2 divide-y divide-border">
                                {heldGroups.map((g) => (
                                  <li key={g.key} className="py-2 flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[13px] text-foreground truncate">{g.title}</div>
                                      <div className="text-[11px] text-muted-foreground">
                                        {HELD_STATE_LABEL[g.state] ?? 'In progress'}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-[13px] font-medium text-foreground tabular-nums">
                                        {fmtMoney(g.net, currency)}
                                      </div>
                                      {g.fee > 0 && (
                                        <div className="text-[11px] text-muted-foreground tabular-nums">
                                          {fmtMoney(g.gross, currency)} - {fmtMoney(g.fee, currency)} fee
                                        </div>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        )}
                      </section>
                    );
                  })()}



                  {firstHoldCents > 0 && (
                    <section className="rounded-2xl bg-amber-50 border border-amber-200 mt-3 p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 uppercase tracking-wide">
                          <span>🕒 First payout hold</span>
                          <BalanceInfo
                            tone="amber"
                            title="First payout hold"
                            body="A one-off security check applied to your very first sale. Usually clears within 7 days. After this, future sales only go through the standard 1 to 2 day clearing window."
                          />
                        </div>
                        <div className="text-base font-semibold text-charcoal">
                          {fmtMoney(firstHoldCents, currency)}
                        </div>
                      </div>
                      <p className="text-[12px] text-charcoal/80 mt-1.5 leading-relaxed">
                        Your first sale is being verified by our payment processor. This is a one-off security check on new seller accounts.
                      </p>
                      <div className="mt-2 text-[12px] font-medium text-charcoal">
                        Usually within 7 days.
                      </div>
                    </section>
                  )}
                </>
              );
            })()}


            {/* Available balance or Balance owed */}
            {isNegative ? (
              <section className="rounded-2xl bg-destructive/10 border-2 border-destructive/40 p-5 mt-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-destructive uppercase tracking-wide">
                  <AlertTriangle className="h-3.5 w-3.5" /> Balance owed
                </div>
                <div className="text-[34px] font-bold text-destructive leading-tight mt-1">
                  {fmtMoney(negativeCents, currency)}
                </div>
                <p className="text-[12px] text-charcoal/80 mt-2 leading-relaxed">
                  Refunds or disputes brought your balance below zero. Settle this before you can buy, list, or receive payouts.
                </p>
                <Button
                  onClick={() => setSettleOpen(true)}
                  className="w-full mt-3 h-11 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
                >
                  Settle balance
                </Button>
              </section>
            ) : (
              <section className="rounded-2xl bg-primary/60 p-5 mt-3">
                <div className="flex items-center gap-1.5">
                  <div className="text-xs font-medium text-charcoal/70 uppercase tracking-wide">
                    Available to withdraw
                  </div>
                  <BalanceInfo
                    tone="primary"
                    title="Available to withdraw"
                    body="Ready to pay out. Standard payout lands in your bank in about 24 hours. Instant Payout arrives in around 30 minutes for a 1.5% fee."
                  />
                </div>
                <div className="text-[34px] font-bold text-charcoal leading-tight mt-1">
                  {fmtMoney(availableToWithdraw, currency)}
                </div>
              </section>
            )}



            {/* Payout actions */}
            <div className="flex flex-col mt-3">
              <Button
                onClick={() => setConfirm('standard')}
                disabled={!canPayout || payoutLoading !== null}
                className="h-12 rounded-xl bg-charcoal text-white hover:bg-charcoal/90 font-semibold disabled:opacity-50"
              >
                {payoutLoading === 'standard' ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Paying out...</span>
                ) : (
                  'Pay out to bank'
                )}
              </Button>

              {payoutBlockedReason && (
                <p className="text-[11px] text-muted-foreground mt-2 text-center leading-relaxed px-1">
                  {payoutBlockedReason}
                </p>
              )}

              <p className="text-[11px] text-muted-foreground mt-4 text-center leading-relaxed px-1">
                <span className="font-semibold text-foreground">Need the funds faster?</span>
                <br />
                Use <span className="font-semibold text-foreground">Instant Payout</span> (≈30 minutes) for a 1.5% fee.
                <br />
                Available once your funds are released.
              </p>

              <Button
                onClick={() => setConfirm('instant')}
                disabled={!canInstant || payoutLoading !== null}
                className="mt-5 h-12 rounded-xl bg-muted/60 border border-border text-charcoal hover:bg-muted font-semibold disabled:opacity-50"
              >
                {payoutLoading === 'instant' ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Sending...</span>
                ) : (
                  'Instant Payout 1.5% fee'
                )}
              </Button>

              {instantBlockedReason && instantBlockedReason !== payoutBlockedReason && (
                <p className="text-[11px] text-muted-foreground mt-2 text-center leading-relaxed px-1">
                  {instantBlockedReason}
                </p>
              )}

            </div>


            {/* Next payout */}
            {data?.nextPayout && (
              <section className="rounded-2xl bg-card border border-border mt-3 p-4">
                <div className="text-[13px] font-medium text-foreground">Next payout</div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="text-[13px] text-muted-foreground">
                    Arriving {fmtDate(data.nextPayout.arrivalDate)}
                  </div>
                  <div className="text-base font-semibold text-foreground">
                    {fmtMoney(data.nextPayout.amount, currency)}
                  </div>
                </div>
              </section>
            )}

            {/* Payout history */}
            <section className="mt-6">
              <h2 className="text-[13px] font-semibold text-foreground px-1 mb-2">
                Payout history
              </h2>
              {(!data?.payouts || data.payouts.length === 0) ? (
                <div className="rounded-2xl bg-card border border-border p-6 text-center text-[13px] text-muted-foreground">
                  No payouts yet.
                </div>
              ) : (
                <ul className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
                  {data.payouts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium text-foreground">
                          {fmtMoney(p.amount, currency)}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {fmtDate(p.arrivalDate || p.created)}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-medium rounded-full px-2.5 py-1 ${statusClass(
                          p.status
                        )}`}
                      >
                        {statusLabel(p.status)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Recent activity — sales, refunds, fees, adjustments */}
            {data?.activity && data.activity.length > 0 && (() => {
              // Show each Stripe balance transaction as-is. Merging refunds with
              // their fee reversals looks tidy but silently combines unrelated
              // events (Stripe does not link them in the ledger payload), so we
              // now render every row and let the amounts speak for themselves.
              const visible = [...data.activity]
                .filter((a) => !['application_fee', 'application_fee_refund', 'stripe_fee'].includes(a.type))
                .sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
              if (visible.length === 0) return null;

              return (
                <section className="mt-6">
                  <h2 className="text-[13px] font-semibold text-foreground px-1 mb-2">
                    Recent activity
                  </h2>
                  <ul className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
                    {visible.map((a) => {
                      const displayAmount = a.net ?? (a.amount - (a.fee || 0));
                      const isOut = displayAmount < 0;
                      const meta = activityMeta(a.type);
                      return (
                        <li key={a.id} className="flex items-center justify-between px-4 py-3">
                          <div className="min-w-0 flex-1 pr-3">
                            <div className="text-[13px] font-medium text-foreground flex items-center gap-1.5">
                              <span>{meta.emoji}</span>
                              <span className="truncate">{meta.label}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                              {fmtDate(a.created)}
                              {a.status === 'pending' && a.available_on ? ` · Available ${fmtDate(a.available_on)}` : ''}
                            </div>
                          </div>
                          <div className={`text-[14px] font-semibold ${isOut ? 'text-destructive' : 'text-foreground'}`}>
                            {isOut ? '−' : '+'}{fmtMoney(Math.abs(displayAmount), currency)}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })()}
          </>
        )}
      </main>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="max-w-[320px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === 'instant' ? 'Send instant payout?' : 'Pay out to your bank?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              {confirm === 'instant' ? (
                <>
                  {fmtMoney(instantAvailableToWithdraw, currency)} available for instant payout.
                  {' '}A 1.5% Flea fee ({fmtMoney(instantFee, currency)}) will be deducted.
                  <br />
                  <span className="font-medium text-foreground">You'll receive {fmtMoney(instantNet, currency)}</span>, usually within 30 minutes.
                </>
              ) : (
                <>
                  {fmtMoney(availableToWithdraw, currency)} will be sent to your linked bank account. No fees. Funds usually arrive in 1-2 business days.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2">
            <AlertDialogCancel className="flex-1 h-9 rounded-lg mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="flex-1 h-9 rounded-lg bg-charcoal text-white hover:bg-charcoal/90"
              onClick={() => confirm && handlePayout(confirm)}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SettleBalanceSheet
        open={settleOpen}
        onOpenChange={setSettleOpen}
        amountCents={negativeCents}
        onSettled={async () => {
          // Refresh both dashboard and profile so gates in Checkout /
          // CreateListing / EditProfile lift immediately.
          await Promise.all([load(), refreshProfile?.()]);
        }}
      />

      <SellerOnboardingSheet
        open={actionRequiredOpen}
        onOpenChange={setActionRequiredOpen}
        stripeActionRequired={true}
        needsIdVerification={needsIdDocument}
        verificationError={verificationError}
        onComplete={async () => {
          setActionRequiredOpen(false);
          await Promise.all([refreshProfile?.(), probeStatus(), load()]);
        }}
      />
    </div>

  );
};

export default SellerDashboard;
