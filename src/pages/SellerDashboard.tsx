import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { useOrders } from '@/hooks/useOrders';
import { useUnreadOrderMessages } from '@/hooks/useUnreadOrderMessages';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { SettleBalanceSheet } from '@/components/SettleBalanceSheet';
import SellerOnboardingSheet from '@/components/SellerOnboardingSheet';

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

type DashboardData = {
  connected: boolean;
  demo?: boolean;
  currency?: string;
  available?: number;
  pending?: number;
  instantAvailable?: number;
  unshippedCents?: number;
  availableToWithdraw?: number;
  instantAvailableToWithdraw?: number;
  negativeBalanceCents?: number;
  isNegative?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  hasSucceededCharge?: boolean;
  instantPayoutEligible?: boolean;
  nextPayout?: { amount: number; arrivalDate: number; status: string } | null;
  payouts?: PayoutRow[];
  activity?: ActivityRow[];
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

  const instantFee = Math.round(instantAvailableToWithdraw * 0.015);
  const instantNet = Math.max(instantAvailableToWithdraw - instantFee, 0);

  const handlePayout = async (method: 'standard' | 'instant') => {
    setConfirm(null);
    setPayoutLoading(method);
    try {
      const { data: res, error: err } = await invokeCloudFunction(
        'stripe-connect-payout',
        { method }
      );
      if (err) throw new Error(err.message || 'Payout failed');
      if ((res as any)?.error) throw new Error((res as any).error);
      toast.success(
        method === 'instant'
          ? 'Instant payout sent. Funds usually arrive within 30 minutes.'
          : 'Payout on the way. Funds usually arrive in 1-2 business days.'
      );
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'Payout failed. Please try again.');
    } finally {
      setPayoutLoading(null);
    }
  };

  return (
    <div className="min-h-svh bg-background flex flex-col">
      <header className="sticky top-0 z-20 bg-background">
        <div className="relative flex items-center px-4 py-3 pt-safe">
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

      <main className="flex-1 px-4 pb-10">
        {notOnboarded ? (
          <div className="pt-24 text-center text-sm text-muted-foreground max-w-[280px] mx-auto">
            Finish your seller setup to see your balance and payouts here.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center pt-24">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="pt-16 text-center text-sm text-muted-foreground max-w-[280px] mx-auto">
            {error}
          </div>
        ) : (
          <>
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
              <section className="rounded-2xl bg-primary/60 p-5 mt-2">
                <div className="text-xs font-medium text-charcoal/70 uppercase tracking-wide">
                  Available to withdraw
                </div>
                <div className="text-[34px] font-bold text-charcoal leading-tight mt-1">
                  {fmtMoney(availableToWithdraw, currency)}
                </div>
                {unshippedCents > 0 && (
                  <div className="mt-2 text-[12px] text-charcoal/70 leading-relaxed">
                    {fmtMoney(unshippedCents, currency)} is held from sales awaiting shipment. Ship those orders with tracking to release these funds.
                  </div>
                )}
              </section>
            )}

            {/* Pending row — sits directly under Available */}
            <section className="rounded-2xl bg-card border border-border mt-3 p-4 flex items-center justify-between">
              <div>
                <div className="text-[13px] text-muted-foreground">Pending</div>
                <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                  Clearing from recent sales.
                </div>
              </div>
              <div className="text-base font-semibold text-foreground">
                {fmtMoney(data?.pending ?? 0, currency)}
              </div>
            </section>

            {/* Payout actions */}
            <div className="flex flex-col gap-2 mt-3">
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
              <Button
                onClick={() => setConfirm('instant')}
                disabled={!canInstant || payoutLoading !== null}
                variant="outline"
                className="h-11 rounded-xl border-2 border-charcoal bg-transparent text-charcoal hover:bg-charcoal/5 font-semibold disabled:opacity-50"
              >
                {payoutLoading === 'instant' ? (
                  <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Sending...</span>
                ) : (
                  <>Instant payout <span className="ml-1 text-[13px] font-normal">(1.5% fee)</span></>
                )}
              </Button>
              {!canInstant && (
                <div className="mt-3 bg-muted/60 rounded-xl px-4 py-3 text-left w-full space-y-2">
                  <p className="text-xs font-semibold text-foreground">⏱️ Please note</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    You must add valid tracking for your funds to become available.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Due to security checks and verification, your <span className="font-medium text-foreground">first payout may take up to 7 days</span>.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    After that, payouts usually arrive in <span className="font-medium text-foreground">1–2 business days</span>, or via <span className="font-medium text-foreground">Instant Payout (≈30 mins)</span> for a 1.5% fee.
                  </p>
                </div>
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
