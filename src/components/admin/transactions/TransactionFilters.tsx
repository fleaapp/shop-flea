import { TransactionFilters as Filters } from '@/types/admin/transactions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Search, X, Download } from 'lucide-react';

interface Props {
  filters: Filters;
  onUpdateFilter: (key: keyof Filters, value: any) => void;
  onReset: () => void;
  onExport: () => void;
  orderCount: number;
}

export function TransactionFiltersBar({ filters, onUpdateFilter, onReset, onExport, orderCount }: Props) {
  const hasFilters = filters.dateFrom || filters.dateTo || filters.status || filters.shippingStatus || filters.flagged || filters.overdue || filters.search;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search order code, buyer, seller..." value={filters.search} onChange={(e) => onUpdateFilter('search', e.target.value)} className="pl-9" />
        </div>
        <Input type="date" value={filters.dateFrom || ''} onChange={(e) => onUpdateFilter('dateFrom', e.target.value || null)} className="w-[140px]" />
        <Input type="date" value={filters.dateTo || ''} onChange={(e) => onUpdateFilter('dateTo', e.target.value || null)} className="w-[140px]" />
        <Select value={filters.status || 'all'} onValueChange={(v) => onUpdateFilter('status', v === 'all' ? null : v)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Order Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="awaiting">Awaiting</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="disputed">Disputed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.shippingStatus || 'all'} onValueChange={(v) => onUpdateFilter('shippingStatus', v === 'all' ? null : v)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Shipping Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Shipping</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={filters.overdue} onCheckedChange={(v) => onUpdateFilter('overdue', v)} />Overdue Only
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={filters.flagged} onCheckedChange={(v) => onUpdateFilter('flagged', v)} />Flagged
          </label>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={onReset} className="gap-1 text-muted-foreground">
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{orderCount} orders</span>
          <Button variant="outline" size="sm" onClick={onExport} className="gap-1">
            <Download className="h-3 w-3" /> Export CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
