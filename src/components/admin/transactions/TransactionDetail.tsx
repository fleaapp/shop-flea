import { useState } from 'react';
import { TransactionOrder, getOrderCode, getShippingStatus, getDaysOverdue, calcPlatformFee, calcProcessingFee } from '@/types/admin/transactions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ArrowLeft, Package, User, DollarSign, Truck, MessageCircle, Clock, AlertTriangle, Flag, CheckCircle, StickyNote } from 'lucide-react';

interface Props { order: TransactionOrder | null; onBack: () => void; }

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" />{title}
      </div>
      <div className="space-y-2 pl-6">{children}</div>
    </div>
  );
}

function Row({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className={`text-right text-sm font-medium ${className || ''}`}>{value}</span>
    </div>
  );
}

const statusColors: Record<string, string> = {
  awaiting: 'bg-yellow-500/10 text-yellow-700 border-yellow-300',
  shipped: 'bg-blue-500/10 text-blue-700 border-blue-300',
  delivered: 'bg-emerald-500/10 text-emerald-700 border-emerald-300',
  completed: 'bg-emerald-500/10 text-emerald-700 border-emerald-300',
  cancelled: 'bg-muted text-muted-foreground border-border',
  refunded: 'bg-orange-500/10 text-orange-700 border-orange-300',
  disputed: 'bg-destructive/10 text-destructive border-destructive/30',
};

export function TransactionDetail({ order, onBack }: Props) {
  const [note, setNote] = useState('');

  if (!order) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Package className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p className="text-lg font-medium">Select a transaction</p>
          <p className="text-sm">Click on an order to view details</p>
        </div>
      </div>
    );
  }

  const ss = getShippingStatus(order);
  const overdue = getDaysOverdue(order);
  const total = order.price + order.shipping_price;
  const pf = calcPlatformFee(order.price + order.shipping_price);
  const proc = calcProcessingFee(total + pf);
  

  const timeline = [
    { label: 'Purchased', time: order.created_at, icon: DollarSign },
    ...(order.shipped_at ? [{ label: 'Shipped', time: order.shipped_at, icon: Truck }] : []),
    ...(order.delivered_at ? [{ label: 'Delivered', time: order.delivered_at, icon: CheckCircle }] : []),
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-sm font-bold">{getOrderCode(order.id)}</h2>
            <Badge variant="outline" className={`text-[11px] ${statusColors[order.status] || ''}`}>{order.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{format(new Date(order.created_at), 'PPpp')}</p>
        </div>
        {overdue !== null && <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{overdue}d overdue</Badge>}
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <Section title="Users" icon={User}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-border p-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={order.buyer_profile?.avatar_url || ''} />
                <AvatarFallback>{order.buyer_profile?.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs text-muted-foreground">Buyer</p>
                <p className="text-sm font-medium">{order.buyer_profile?.username || 'Unknown'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border p-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={order.seller_profile?.avatar_url || ''} />
                <AvatarFallback>{order.seller_profile?.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs text-muted-foreground">Seller</p>
                <p className="text-sm font-medium">{order.seller_profile?.username || 'Unknown'}</p>
              </div>
            </div>
          </div>
        </Section>

        <Separator />

        <Section title="Item" icon={Package}>
          {order.listing ? (
            <div className="flex items-center gap-3 rounded-lg border border-border p-3">
              {order.listing.images?.[0] && <img src={order.listing.images[0]} alt={order.listing.title} className="h-14 w-14 rounded-md object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{order.listing.title}</p>
                <p className="text-xs text-muted-foreground">{order.listing.brand} · {order.listing.category}</p>
                <p className="mt-1 text-sm font-bold">${order.price.toFixed(2)}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Listing data unavailable</p>
          )}
        </Section>

        <Separator />

        <Section title="Financial Breakdown" icon={DollarSign}>
          <div className="space-y-1.5 rounded-lg border border-border p-3">
            <Row label="Item Price" value={`$${order.price.toFixed(2)}`} />
            <Row label="Shipping" value={`$${order.shipping_price.toFixed(2)}`} />
            <Separator className="my-2" />
            <Row label="Order Total" value={`$${total.toFixed(2)}`} className="font-bold" />
            <Separator className="my-2" />
            <Row label="Secure Checkout Fee (4% + $0.70)" value={`+$${pf.toFixed(2)}`} className="text-muted-foreground" />
            <Row label="Stripe cost (est.)" value={`-$${proc.toFixed(2)}`} className="text-muted-foreground" />
            <Separator className="my-2" />
            <Row label="Net to Seller" value={`$${total.toFixed(2)}`} className="font-bold text-emerald-600" />
            <Row label="Flea revenue (est.)" value={`$${Math.max(0, pf - proc).toFixed(2)}`} className="font-bold text-blue-600" />
          </div>
        </Section>

        <Separator />

        <Section title="Shipping & Fulfilment" icon={Truck}>
          <div className="space-y-1.5 rounded-lg border border-border p-3">
            <Row label="Status" value={<Badge variant="outline" className={`text-[11px] ${statusColors[ss] || ''}`}>{ss}</Badge>} />
            {order.tracking_provider && <Row label="Provider" value={order.tracking_provider} />}
            {order.tracking_number && <Row label="Tracking #" value={order.tracking_number} />}
            <Row label="Dispatch Deadline" value={format(new Date(new Date(order.created_at).getTime() + 5 * 86400000), 'dd MMM yyyy')} />
            {overdue !== null && <Row label="Days Overdue" value={<span className="font-bold text-destructive">{overdue} days</span>} />}
          </div>
        </Section>

        <Separator />

        <Section title="Communication" icon={MessageCircle}>
          <div className="rounded-lg border border-border p-3">
            <Row label="Total Messages" value={order.message_count?.toString() || '0'} />
          </div>
        </Section>

        <Separator />

        <Section title="Activity Timeline" icon={Clock}>
          <div className="space-y-3">
            {timeline.map((e, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                  <e.icon className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{e.label}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(e.time), 'PPpp')}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Separator />

        <Section title="Internal Notes" icon={StickyNote}>
          <Textarea placeholder="Add internal notes about this order..." value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
        </Section>

        <div className="flex flex-wrap gap-2 pl-6">
          <Button variant="outline" size="sm" className="gap-1"><Flag className="h-3 w-3" /> Flag Order</Button>
          <Button variant="outline" size="sm" className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/10">
            <AlertTriangle className="h-3 w-3" /> Escalate
          </Button>
        </div>
      </div>
    </div>
  );
}
