import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { markAdminTabSeen } from '@/lib/adminLastSeen';

import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { useAdminRefunds, type RefundFilter } from '@/hooks/admin/useAdminRefunds';
import { AdminHeader } from '@/components/admin/shell/AdminHeader';
import { AdminBadge } from '@/components/admin/shell/AdminBadge';
import { AdminChipFilter } from '@/components/admin/shell/AdminChipFilter';
import { AdminEmptyState } from '@/components/admin/shell/AdminEmptyState';

const initials = (s?: string | null) => (s ?? '?').replace('@', '').slice(0, 2).toUpperCase();

export default function AdminRefunds() {
  const navigate = useNavigate();
  const { orders, loading, filter, setFilter } = useAdminRefunds();

  useEffect(() => { markAdminTabSeen('refunds'); }, []);


  const requestedCount = orders.filter((o) => !o.refunded_at && o.status !== 'refunded').length;
  const refundedCount = orders.filter((o) => o.refunded_at || o.status === 'refunded').length;

  const options: { key: RefundFilter; label: string; emoji?: string; count?: number }[] = [
    { key: 'all', label: 'All', count: orders.length },
    { key: 'requested', label: 'Requested', emoji: '⏳', count: requestedCount },
    { key: 'refunded', label: 'Refunded', emoji: '↩️', count: refundedCount },
  ];

  return (
    <div className="admin-scope native-safe-top fixed inset-0 flex flex-col bg-background overflow-hidden">
      <div className="shrink-0">
        <AdminHeader title="Refunds & disputes" emoji="↩️" />
        <AdminChipFilter options={options} value={filter} onChange={(v) => setFilter(v)} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-24">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
          </div>
        ) : orders.length === 0 ? (
          <AdminEmptyState emoji="🎉" title="No refunds to review" description="Refund requests and completed refunds will appear here." />
        ) : (
          <div className="space-y-2">
            {orders.map((o) => {
              const image = o.listing?.images?.[0];
              const isRefunded = Boolean(o.refunded_at || o.status === 'refunded');
              const buyerName = o.buyer_profile?.username ?? 'Deleted user';
              const sellerName = o.seller_profile?.username ?? 'Deleted user';
              return (
                <div key={o.id} className="flex gap-3 rounded-2xl bg-card p-3 card-shadow">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-lg">
                    {image ? (
                      <img
                        src={image}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <span aria-hidden>🧺</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-semibold">{o.listing?.title ?? 'Item'}</p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <AdminBadge tone={isRefunded ? 'warning' : 'danger'}>{isRefunded ? '↩️ Refunded' : '⏳ Requested'}</AdminBadge>
                      {o.listing?.status === 'removed' && <AdminBadge tone="neutral">Deleted listing</AdminBadge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {o.order_number ? `${o.order_number} · ` : ''}${(o.price + o.shipping_price).toFixed(2)} · {format(new Date(o.updated_at || o.created_at), 'MMM d')}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Avatar className="h-4 w-4"><AvatarImage src={o.buyer_profile?.avatar_url ?? undefined} /><AvatarFallback className="text-[8px]">{initials(o.buyer_profile?.username)}</AvatarFallback></Avatar>
                        <span className="truncate">Buyer {buyerName}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Avatar className="h-4 w-4"><AvatarImage src={o.seller_profile?.avatar_url ?? undefined} /><AvatarFallback className="text-[8px]">{initials(o.seller_profile?.username)}</AvatarFallback></Avatar>
                        <span className="truncate">Seller {sellerName}</span>
                      </span>
                    </div>
                    {o.refund_reason && (
                      <p className="mt-1.5 line-clamp-2 rounded-lg bg-muted/60 px-2 py-1 text-xs text-foreground/80">
                        {refundReasonLabel(o.refund_reason)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

