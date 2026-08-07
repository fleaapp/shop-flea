import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { callAdminData } from '@/hooks/admin/useAdminData';
import { AdminHeader } from '@/components/admin/shell/AdminHeader';
import { AdminEmptyState } from '@/components/admin/shell/AdminEmptyState';

interface PayoutReview {
  user_id: string;
  username?: string | null;
  display_name?: string | null;
  payout_review_reason?: string | null;
  payout_failure_count?: number | null;
  payout_failure_reason?: string | null;
  payout_failure_at?: string | null;
  bank_status?: string | null;
  bank_last_changed_at?: string | null;
  bank_change_count_30d?: number | null;
}

export default function AdminPayoutReviews() {
  const [rows, setRows] = useState<PayoutReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callAdminData<{ reviews: PayoutReview[] }>('listPayoutReviews');
      setRows(res.reviews ?? []);
    } catch (e: any) {
      toast.error(e?.message || 'Could not load payout reviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const clearFlag = async (userId: string) => {
    setClearing(userId);
    try {
      await callAdminData('clearPayoutReview', { userId });
      setRows((prev) => prev.filter((r) => r.user_id !== userId));
      toast.success('Payout review cleared.');
    } catch (e: any) {
      toast.error(e?.message || 'Could not clear the flag.');
    } finally {
      setClearing(null);
    }
  };

  return (
    <div className="admin-scope native-safe-top fixed inset-0 flex flex-col bg-background overflow-hidden pb-24">
      <AdminHeader title="Payout review" emoji="🔎" />

      <div className="flex-1 px-4 pt-2 overflow-y-auto">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <AdminEmptyState emoji="🔎" title="No accounts under review" />
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.user_id} className="rounded-2xl bg-card card-shadow p-4">
                <p className="text-sm font-semibold text-foreground">
                  {r.display_name || r.username || r.user_id}
                </p>
                <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
                  {r.payout_review_reason || 'Flagged for review.'}
                </p>
                <div className="mt-2 space-y-0.5 text-[12px] text-muted-foreground">
                  <p>Failed payouts: {r.payout_failure_count ?? 0}</p>
                  {r.payout_failure_reason && <p>Last failure: {r.payout_failure_reason}</p>}
                  {r.payout_failure_at && (
                    <p>Failed at: {format(new Date(r.payout_failure_at), 'd MMM yyyy, h:mma')}</p>
                  )}
                  <p>Bank status: {r.bank_status ?? 'unknown'}</p>
                  <p>Bank changes (30d): {r.bank_change_count_30d ?? 0}</p>
                  {r.bank_last_changed_at && (
                    <p>Last change: {format(new Date(r.bank_last_changed_at), 'd MMM yyyy, h:mma')}</p>
                  )}
                </div>
                <Button
                  onClick={() => clearFlag(r.user_id)}
                  disabled={clearing === r.user_id}
                  className="w-full mt-3 h-10 rounded-lg font-medium"
                >
                  {clearing === r.user_id ? 'Clearing...' : 'Clear flag'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
