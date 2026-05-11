import { TransactionSummary } from '@/types/admin/transactions';
import { DollarSign, ShoppingCart, TrendingUp, AlertTriangle, Truck, RotateCcw } from 'lucide-react';

interface Props { summary: TransactionSummary; }

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color || 'bg-primary/10 text-primary'}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold leading-tight text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function TransactionSummaryBar({ summary }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      <StatCard icon={ShoppingCart} label="Total Orders" value={summary.totalOrders.toLocaleString()} />
      <StatCard icon={DollarSign} label="Total Revenue" value={`$${summary.totalRevenue.toFixed(2)}`} color="bg-emerald-500/10 text-emerald-600" />
      <StatCard icon={TrendingUp} label="Platform Earnings" value={`$${summary.platformEarnings.toFixed(2)}`} color="bg-blue-500/10 text-blue-600" />
      <StatCard icon={RotateCcw} label="Refunds" value={`$${summary.refundTotal.toFixed(2)}`} color="bg-orange-500/10 text-orange-600" />
      <StatCard icon={Truck} label="In Progress" value={summary.ordersInProgress.toString()} color="bg-yellow-500/10 text-yellow-600" />
      <StatCard icon={AlertTriangle} label="Overdue" value={summary.overdueShipments.toString()} color="bg-destructive/10 text-destructive" />
      <StatCard icon={AlertTriangle} label="Disputed" value={summary.disputedOrders.toString()} color="bg-destructive/10 text-destructive" />
    </div>
  );
}
