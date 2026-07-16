import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { useAdminRefunds, type RefundFilter } from '@/hooks/admin/useAdminRefunds';

const initials = (s?: string | null) => (s ?? '?').replace('@', '').slice(0, 2).toUpperCase();

export default function AdminRefunds() {
  const navigate = useNavigate();
  const { orders, loading, filter, setFilter } = useAdminRefunds();

  const tabs: { key: RefundFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'requested', label: 'Requested' },
    { key: 'refunded', label: 'Refunded' },
  ];

  return (
    <div className="admin-scope flex min-h-screen flex-col bg-background pb-20">
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-background px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="flex-1 text-center text-lg font-bold">↩️ Refunds & disputes</h1>
        <div className="w-8" />
      </header>

      <div className="flex gap-2 border-b border-border bg-card px-4 py-3">
        {tabs.map((t) => (
          <Button key={t.key} size="sm" variant={filter === t.key ? 'default' : 'outline'} onClick={() => setFilter(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-auto px-4 py-3">
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : orders.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">No matching refunds.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const image = o.listing?.images?.[0];
              const isRefunded = Boolean(o.refunded_at || o.status === 'refunded');
              const status = isRefunded ? 'Refunded' : 'Requested';
              return (
                <div key={o.id} className="flex gap-3 rounded-xl bg-card p-3 card-shadow">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {image && <img src={image} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{o.listing?.title ?? 'Item'}</p>
                      <Badge variant={isRefunded ? 'secondary' : 'destructive'}>{status}</Badge>
                      {o.listing?.status === 'removed' && <Badge variant="outline">Deleted listing</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ${(o.price + o.shipping_price).toFixed(2)} · {format(new Date(o.updated_at || o.created_at), 'MMM d, yyyy')}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1">
                        <Avatar className="h-4 w-4"><AvatarImage src={o.buyer_profile?.avatar_url ?? undefined} /><AvatarFallback>{initials(o.buyer_profile?.username)}</AvatarFallback></Avatar>
                        Buyer {o.buyer_profile?.username ?? '—'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Avatar className="h-4 w-4"><AvatarImage src={o.seller_profile?.avatar_url ?? undefined} /><AvatarFallback>{initials(o.seller_profile?.username)}</AvatarFallback></Avatar>
                        Seller {o.seller_profile?.username ?? '—'}
                      </span>
                    </div>
                    {o.refund_reason && <p className="mt-1 text-xs text-muted-foreground">Reason: {o.refund_reason}</p>}
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
