import { TransactionOrder, getOrderCode, getShippingStatus, getDaysOverdue, calcPlatformFee, TransactionSortField, SortDirection } from '@/types/admin/transactions';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { ArrowUpDown, MessageCircle, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  orders: TransactionOrder[];
  loading: boolean;
  onSelectOrder: (order: TransactionOrder) => void;
  sortField: TransactionSortField;
  sortDir: SortDirection;
  onToggleSort: (field: TransactionSortField) => void;
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
const shippingColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700 border-yellow-300',
  shipped: 'bg-blue-500/10 text-blue-700 border-blue-300',
  delivered: 'bg-emerald-500/10 text-emerald-700 border-emerald-300',
};

function SortHeader({ label, field, currentField, onSort }: { label: string; field: TransactionSortField; currentField: TransactionSortField; onSort: (f: TransactionSortField) => void }) {
  return (
    <button onClick={() => onSort(field)} className="flex items-center gap-1 transition-colors hover:text-foreground">
      {label}<ArrowUpDown className={`h-3 w-3 ${currentField === field ? 'text-foreground' : 'text-muted-foreground/50'}`} />
    </button>
  );
}

export function TransactionTable({ orders, loading, onSelectOrder, sortField, sortDir, onToggleSort }: Props) {
  if (loading) {
    return <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  }
  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="text-lg font-medium">No transactions found</p>
        <p className="text-sm">Try adjusting your filters</p>
      </div>
    );
  }
  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[100px]"><SortHeader label="Date" field="created_at" currentField={sortField} onSort={onToggleSort} /></TableHead>
            <TableHead>Order Code</TableHead>
            <TableHead><SortHeader label="Buyer" field="buyer" currentField={sortField} onSort={onToggleSort} /></TableHead>
            <TableHead><SortHeader label="Seller" field="seller" currentField={sortField} onSort={onToggleSort} /></TableHead>
            <TableHead className="text-right"><SortHeader label="Total" field="price" currentField={sortField} onSort={onToggleSort} /></TableHead>
            <TableHead className="text-right">Platform Fee</TableHead>
            <TableHead><SortHeader label="Status" field="status" currentField={sortField} onSort={onToggleSort} /></TableHead>
            <TableHead>Shipping</TableHead>
            <TableHead className="text-center">Msgs</TableHead>
            <TableHead>Flags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const ss = getShippingStatus(order);
            const overdue = getDaysOverdue(order);
            const total = order.price + order.shipping_price;
            const pf = calcPlatformFee(order.price);
            return (
              <TableRow key={order.id} className="cursor-pointer" onClick={() => onSelectOrder(order)}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{format(new Date(order.created_at), 'dd MMM yy')}</TableCell>
                <TableCell className="font-mono text-xs font-medium">{getOrderCode(order.id)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={order.buyer_profile?.avatar_url || ''} />
                      <AvatarFallback className="text-[10px]">{order.buyer_profile?.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                    </Avatar>
                    <span className="max-w-[100px] truncate text-sm">{order.buyer_profile?.username || 'Unknown'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={order.seller_profile?.avatar_url || ''} />
                      <AvatarFallback className="text-[10px]">{order.seller_profile?.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                    </Avatar>
                    <span className="max-w-[100px] truncate text-sm">{order.seller_profile?.username || 'Unknown'}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm font-medium">${total.toFixed(2)}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">${pf.toFixed(2)}</TableCell>
                <TableCell><Badge variant="outline" className={`text-[11px] ${statusColors[order.status] || ''}`}>{order.status}</Badge></TableCell>
                <TableCell><Badge variant="outline" className={`text-[11px] ${shippingColors[ss] || ''}`}>{ss}</Badge></TableCell>
                <TableCell className="text-center">
                  {order.message_count ? (
                    <span className="flex items-center justify-center gap-1 text-xs text-muted-foreground"><MessageCircle className="h-3 w-3" />{order.message_count}</span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  {overdue !== null && (
                    <Badge variant="destructive" className="gap-1 text-[10px]"><AlertTriangle className="h-3 w-3" />{overdue}d late</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
