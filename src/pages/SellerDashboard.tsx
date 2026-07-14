import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { useOrders } from '@/hooks/useOrders';
import { useUnreadOrderMessages } from '@/hooks/useUnreadOrderMessages';
import { Button } from '@/components/ui/button';

type PayoutRow = {
  id: string;
  amount: number;
  status: string;
  arrivalDate: number;
  created: number;
  method: string;
};

type DashboardData = {
  connected: boolean;
  demo?: boolean;
  currency?: string;
  available?: number;
  pending?: number;
  instantAvailable?: number;
  nextPayout?: { amount: number; arrivalDate: number; status: string } | null;
  payouts?: PayoutRow[];
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
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const notOnboarded =
    !(profile as any)?.stripe_account_id ||
    (profile as any)?.stripe_onboarding_complete !== true;

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
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
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!notOnboarded) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notOnboarded]);

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
            {/* Available balance card */}
            <section className="rounded-2xl bg-primary/60 p-5 mt-2">
              <div className="text-xs font-medium text-charcoal/70 uppercase tracking-wide">
                Available balance
              </div>
              <div className="text-[34px] font-bold text-charcoal leading-tight mt-1">
                {fmtMoney(data?.available ?? 0, data?.currency)}
              </div>
              <div className="text-[13px] text-charcoal/70 mt-1">
                Ready to pay out to your bank.
              </div>
            </section>

            {/* Pending row */}
            <section className="rounded-2xl bg-card border border-border mt-3 p-4 flex items-center justify-between">
              <div>
                <div className="text-[13px] text-muted-foreground">Pending</div>
                <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                  Clearing from recent sales.
                </div>
              </div>
              <div className="text-base font-semibold text-foreground">
                {fmtMoney(data?.pending ?? 0, data?.currency)}
              </div>
            </section>

            {/* Next payout */}
            {data?.nextPayout && (
              <section className="rounded-2xl bg-card border border-border mt-3 p-4">
                <div className="text-[13px] font-medium text-foreground">Next payout</div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="text-[13px] text-muted-foreground">
                    Arriving {fmtDate(data.nextPayout.arrivalDate)}
                  </div>
                  <div className="text-base font-semibold text-foreground">
                    {fmtMoney(data.nextPayout.amount, data?.currency)}
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
                          {fmtMoney(p.amount, data?.currency)}
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
              <p className="text-[11px] text-muted-foreground text-center mt-3 px-6">
                Payouts arrive in your linked bank account. Instant payouts are available from
                your sale details for a 1.5% fee.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default SellerDashboard;
