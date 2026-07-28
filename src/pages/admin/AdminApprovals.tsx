import { useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminHeader } from '@/components/admin/shell/AdminHeader';
import { AdminBadge } from '@/components/admin/shell/AdminBadge';
import { AdminChipFilter } from '@/components/admin/shell/AdminChipFilter';
import { AdminEmptyState } from '@/components/admin/shell/AdminEmptyState';
import { openTrackingUrl } from '@/lib/tracking';
import { useAdminApprovals, type ApprovalKind, type AdminApprovalOrder } from '@/hooks/admin/useAdminApprovals';

const initials = (s?: string | null) => (s ?? '?').replace('@', '').slice(0, 2).toUpperCase();

export default function AdminApprovals() {
  const [tab, setTab] = useState<ApprovalKind>('tracking');
  const {
    orders,
    loading,
    approveTracking,
    rejectTracking,
    markDelivered,
    completeOrder,
    forceRefund,
    dismissDispute,
    approveUntrackedDelivery,
    rejectUntrackedDelivery,
  } = useAdminApprovals(tab);

  const options = [
    { key: 'tracking' as const, label: 'Tracking', emoji: '📮' },
    { key: 'delivery' as const, label: 'Delivery', emoji: '📬' },
    { key: 'untracked' as const, label: 'Untracked', emoji: '📦' },
    { key: 'dispute' as const, label: 'Dispute', emoji: '⚖️' },
  ];

  return (
    <div className="admin-scope native-safe-top fixed inset-0 flex flex-col bg-background overflow-hidden pb-24">
      <AdminHeader title="Approvals" emoji="✅" />
      <AdminChipFilter options={options} value={tab} onChange={(v) => setTab(v as ApprovalKind)} />
      <div className="flex-1 overflow-y-auto px-4 pt-2">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <AdminEmptyState
            emoji="🎉"
            title={
              tab === 'tracking'
                ? 'No tracking to approve'
                : tab === 'delivery'
                  ? 'No deliveries to review'
                  : tab === 'untracked'
                    ? 'No untracked deliveries'
                    : 'No disputes open'
            }
            description="Nothing pending right now."
          />
        ) : (
          <div className="space-y-2">
            {orders.map((o) => (
              <ApprovalRow
                key={o.id}
                order={o}
                kind={tab}
                onApproveTracking={() => approveTracking(o.id)}
                onRejectTracking={(reason) => rejectTracking(o.id, reason)}
                onMarkDelivered={() => markDelivered(o.id, o.order_group_id)}
                onComplete={() => completeOrder(o.id, o.order_group_id)}
                onForceRefund={() => forceRefund(o.id)}
                onDismissDispute={() => dismissDispute(o.id)}
                onApproveUntracked={() => approveUntrackedDelivery(o.id)}
                onRejectUntracked={(reason) => rejectUntrackedDelivery(o.id, reason)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function ApprovalRow({
  order,
  kind,
  onApproveTracking,
  onRejectTracking,
  onMarkDelivered,
  onComplete,
  onForceRefund,
  onDismissDispute,
}: {
  order: AdminApprovalOrder;
  kind: ApprovalKind;
  onApproveTracking: () => void;
  onRejectTracking: (reason: string) => void;
  onMarkDelivered: () => void;
  onComplete: () => void;
  onForceRefund: () => void;
  onDismissDispute: () => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const image = order.listing?.images?.[0];
  const disputeCountdown = useMemo(() => {
    if (!order.dispute_window_ends_at) return null;
    const t = new Date(order.dispute_window_ends_at).getTime();
    if (t <= Date.now()) return 'Window elapsed';
    return `Releases ${formatDistanceToNow(new Date(order.dispute_window_ends_at), { addSuffix: true })}`;
  }, [order.dispute_window_ends_at]);


  return (
    <div className="rounded-2xl bg-card p-3 card-shadow">
      <div className="flex gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
          {image && <img src={image} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{order.listing?.title ?? 'Item'}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <AdminBadge tone="info">#{order.order_number ?? order.id.slice(0, 6).toUpperCase()}</AdminBadge>
            <AdminBadge tone="neutral">${(order.price + order.shipping_price).toFixed(2)}</AdminBadge>
            {kind === 'delivery' && (
              <AdminBadge tone="warning">
                Shipped {order.shipped_at ? format(new Date(order.shipped_at), 'MMM d') : ''}
              </AdminBadge>
            )}
            {kind === 'dispute' && disputeCountdown && (
              <AdminBadge tone="warning">{disputeCountdown}</AdminBadge>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Avatar className="h-4 w-4">
                <AvatarImage src={order.buyer_profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-[8px]">{initials(order.buyer_profile?.username)}</AvatarFallback>
              </Avatar>
              <span className="truncate">Buyer {order.buyer_profile?.username ?? '-'}</span>
            </span>
            <span className="flex items-center gap-1">
              <Avatar className="h-4 w-4">
                <AvatarImage src={order.seller_profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-[8px]">{initials(order.seller_profile?.username)}</AvatarFallback>
              </Avatar>
              <span className="truncate">Seller {order.seller_profile?.username ?? '-'}</span>
            </span>
          </div>
          {(order.tracking_provider || order.tracking_number) && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/60 px-2 py-1 text-xs">
              <span className="font-medium">{order.tracking_provider ?? 'Carrier'}</span>
              <span className="truncate">{order.tracking_number}</span>
              {order.tracking_number && (
                <button
                  type="button"
                  onClick={() => openTrackingUrl(order.tracking_provider, order.tracking_number!)}
                  className="ml-auto text-[11px] font-medium text-primary underline"
                >
                  Track
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {kind === 'tracking' && !rejecting && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={() => setRejecting(true)}>
            Reject
          </Button>
          <Button size="sm" className="flex-1 bg-primary text-charcoal hover:bg-primary/90" onClick={onApproveTracking}>
            Approve
          </Button>
        </div>
      )}

      {kind === 'tracking' && rejecting && (
        <div className="mt-3 space-y-2">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (e.g. invalid tracking, wrong carrier)"
            className="h-9 text-xs"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setRejecting(false);
                setReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={reason.trim().length < 3}
              onClick={() => {
                onRejectTracking(reason.trim());
                setRejecting(false);
                setReason('');
              }}
            >
              Confirm reject
            </Button>
          </div>
        </div>
      )}

      {kind === 'delivery' && (
        <div className="mt-3">
          <Button size="sm" className="w-full bg-charcoal text-white hover:bg-charcoal/90" onClick={onMarkDelivered}>
            Mark delivered (start 48h window)
          </Button>
        </div>
      )}

      {kind === 'dispute' && (
        <div className="mt-3 space-y-2">
          {order.refund_request_reason && (
            <div className="rounded-lg bg-muted/60 px-2 py-1.5 text-xs">
              <p className="font-semibold text-foreground">Buyer reason</p>
              <p className="mt-0.5 text-muted-foreground">{order.refund_request_reason}</p>
              {order.refund_requested_at && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Requested {formatDistanceToNow(new Date(order.refund_requested_at), { addSuffix: true })}
                </p>
              )}
            </div>
          )}
          {order.refund_declined_reason && (
            <div className="rounded-lg bg-destructive/10 px-2 py-1.5 text-xs">
              <p className="font-semibold text-destructive">Seller declined</p>
              <p className="mt-0.5 text-muted-foreground">{order.refund_declined_reason}</p>
              {order.refund_declined_at && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Declined {formatDistanceToNow(new Date(order.refund_declined_at), { addSuffix: true })}
                </p>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={onDismissDispute}
            >
              Dismiss (side with seller)
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onForceRefund}
            >
              Refund buyer
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
