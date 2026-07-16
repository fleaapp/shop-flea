import { useState } from 'react';
import { useAdminTransactions } from '@/hooks/admin/useAdminTransactions';
import { TransactionOrder, getOrderCode } from '@/types/admin/transactions';
import { TransactionSummaryBar } from '@/components/admin/transactions/TransactionSummaryBar';
import { TransactionFiltersBar } from '@/components/admin/transactions/TransactionFilters';
import { TransactionTable } from '@/components/admin/transactions/TransactionTable';
import { TransactionDetail } from '@/components/admin/transactions/TransactionDetail';
import { useIsMobile } from '@/hooks/use-mobile';
import { AdminHeader } from '@/components/admin/shell/AdminHeader';

export default function AdminTransactions() {
  const [selected, setSelected] = useState<TransactionOrder | null>(null);
  const isMobile = useIsMobile();

  const { orders, loading, summary, filters, updateFilter, resetFilters, sortField, sortDir, toggleSort } = useAdminTransactions();

  const handleExport = () => {
    const headers = ['Date', 'Order Code', 'Buyer', 'Seller', 'Total', 'Status', 'Shipping Status'];
    const rows = orders.map((o) => [
      new Date(o.created_at).toISOString(),
      getOrderCode(o.id),
      o.buyer_profile?.username || '',
      o.seller_profile?.username || '',
      (o.price + o.shipping_price).toFixed(2),
      o.status,
      o.shipped_at ? (o.delivered_at ? 'delivered' : 'shipped') : 'pending',
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flea-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const showList = !isMobile || !selected;
  const showDetail = !isMobile || !!selected;

  return (
    <div className="admin-scope flex min-h-[100svh] flex-col bg-background">
      <AdminHeader title="Transactions" emoji="📊" />

      <div className="flex flex-1 overflow-hidden">
        {showList && (
          <div className={`flex flex-col overflow-hidden ${isMobile ? 'w-full' : selected ? 'w-[60%]' : 'w-full'}`}>
            <div className="space-y-4 overflow-y-auto p-4">
              <TransactionSummaryBar summary={summary} />
              <TransactionFiltersBar filters={filters} onUpdateFilter={updateFilter} onReset={resetFilters} onExport={handleExport} orderCount={orders.length} />
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <TransactionTable orders={orders} loading={loading} onSelectOrder={setSelected} sortField={sortField} sortDir={sortDir} onToggleSort={toggleSort} />
              </div>
            </div>
          </div>
        )}
        {showDetail && selected && (
          <div className={`border-l border-border bg-card ${isMobile ? 'w-full' : 'w-[40%]'}`}>
            <TransactionDetail order={selected} onBack={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
