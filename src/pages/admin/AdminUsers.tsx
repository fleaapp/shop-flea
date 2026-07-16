import { useState } from 'react';
import { useAdminUsers, fetchUserDetail, type AdminUser } from '@/hooks/admin/useAdminUsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, ShieldAlert, ShieldCheck, ShieldBan, KeyRound, Trash2, RotateCcw, AlertTriangle, ExternalLink, Package, CreditCard, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { AdminHeader } from '@/components/admin/shell/AdminHeader';
import { AdminBadge, toneForStatus, statusLabel } from '@/components/admin/shell/AdminBadge';
import { AdminChipFilter } from '@/components/admin/shell/AdminChipFilter';
import { AdminEmptyState } from '@/components/admin/shell/AdminEmptyState';

const fmtCurrency = (n: number) => `$${n.toFixed(2)}`;
const initials = (s?: string | null) => (s ?? '?').replace('@', '').slice(0, 2).toUpperCase();

function riskTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 70) return 'danger';
  if (score >= 40) return 'warning';
  return 'success';
}

export default function AdminUsers() {
  const { users, loading, search, setSearch, status, setStatus, sort, setSort, dir, setDir, performAction, stats } = useAdminUsers();
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirm, setConfirm] = useState<{ user: AdminUser; type: string; label: string } | null>(null);

  const openDetail = async (u: AdminUser) => {
    setSelected(u);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await fetchUserDetail(u.user_id);
      setDetail(d);
    } finally {
      setDetailLoading(false);
    }
  };

  const statusOptions = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'active', label: 'Active', emoji: '✅', count: stats.active },
    { key: 'suspended', label: 'Suspended', emoji: '⚠️', count: stats.suspended },
    { key: 'blocked', label: 'Blocked', emoji: '🚫', count: stats.blocked },
  ] as const;

  return (
    <div className="admin-scope flex min-h-[100svh] flex-col bg-background pb-24">
      <AdminHeader title="Users" emoji="👥" />

      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username, email, name…"
            className="h-10 rounded-full border-border bg-card pl-9"
          />
        </div>
      </div>

      <AdminChipFilter
        options={statusOptions as any}
        value={status}
        onChange={(v) => setStatus(v as any)}
      />

      <div className="flex items-center gap-2 px-4 pb-2">
        <Select value={sort} onValueChange={(v) => setSort(v as any)}>
          <SelectTrigger className="h-9 w-[170px] rounded-full border-border bg-card text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Signup date</SelectItem>
            <SelectItem value="last_sign_in_at">Last active</SelectItem>
            <SelectItem value="username">Username</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}
          className="h-9 rounded-full text-xs"
        >
          <ArrowUpDown className="mr-1 h-3.5 w-3.5" />
          {dir === 'asc' ? 'Asc' : 'Desc'}
        </Button>
        {stats.risky > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">⚠️ {stats.risky} flagged risky</span>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
        ) : users.length === 0 ? (
          <AdminEmptyState emoji="🔍" title="No users match these filters" />
        ) : (
          <div className="space-y-2 px-4">
            {users.map((u) => (
              <button
                key={u.user_id}
                onClick={() => openDetail(u)}
                className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left card-shadow transition-transform active:scale-[0.99]"
              >
                <Avatar className="h-11 w-11">
                  <AvatarImage src={u.avatar_url ?? undefined} />
                  <AvatarFallback>{initials(u.username)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-foreground">{u.username}</p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <AdminBadge tone={toneForStatus(u.status)}>{statusLabel(u.status)}</AdminBadge>
                    {u.report_strike_count > 0 && (
                      <AdminBadge tone="danger">{u.report_strike_count} strike{u.report_strike_count > 1 ? 's' : ''}</AdminBadge>
                    )}
                    <AdminBadge tone={riskTone(u.risk_score)}>Risk {u.risk_score}</AdminBadge>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {u.listings_total} listings · {u.orders_as_seller} sales · {fmtCurrency(u.seller_volume + u.buyer_volume)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setDetail(null); } }}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto rounded-3xl border-border bg-background p-0">
          {selected && (
            <div className="flex flex-col">
              <div className="rounded-t-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-background px-5 pb-4 pt-6">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <Avatar className="h-14 w-14 ring-2 ring-primary/30">
                      <AvatarImage src={selected.avatar_url ?? undefined} />
                      <AvatarFallback>{initials(selected.username)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-base font-bold">{selected.username}</span>
                        <AdminBadge tone={toneForStatus(selected.status)}>{statusLabel(selected.status)}</AdminBadge>
                        {selected.report_strike_count > 0 && (
                          <AdminBadge tone="danger">{selected.report_strike_count} strike{selected.report_strike_count > 1 ? 's' : ''}</AdminBadge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">{selected.email}</p>
                    </div>
                  </DialogTitle>
                </DialogHeader>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <AdminBadge tone={selected.stripe_onboarding_complete ? 'success' : 'neutral'}>
                    <CreditCard className="h-3 w-3" /> {selected.stripe_onboarding_complete ? 'Payments live' : 'No payouts'}
                  </AdminBadge>
                  {selected.country_code && <AdminBadge tone="neutral">{selected.country_code}</AdminBadge>}
                  {selected.region_id && <AdminBadge tone="neutral">{selected.region_id}</AdminBadge>}
                  <AdminBadge tone={riskTone(selected.risk_score)}>Risk {selected.risk_score}</AdminBadge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 px-5 py-4 sm:grid-cols-4">
                <Stat label="Listings" value={`${selected.listings_total}`} sub={`${selected.listings_active} active`} />
                <Stat label="Sales" value={String(selected.orders_as_seller)} />
                <Stat label="Volume" value={fmtCurrency(selected.seller_volume + selected.buyer_volume)} />
                <Stat label="Refunds" value={String(selected.refunds_count)} tone={selected.refunds_count > 0 ? 'risk' : undefined} />
                <Stat label="Reports" value={String(selected.reports_against)} tone={selected.reports_against > 0 ? 'risk' : undefined} />
                <Stat label="Strikes" value={String(selected.report_strike_count)} tone={selected.report_strike_count > 0 ? 'risk' : undefined} />
                <Stat label="Last active" value={selected.last_sign_in_at ? format(new Date(selected.last_sign_in_at), 'MMM d') : '—'} />
                <Stat label="Joined" value={format(new Date(selected.created_at), 'MMM yyyy')} />
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border/60 bg-muted/30 px-5 py-3">
                <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setConfirm({ user: selected, type: 'suspend', label: 'Suspend user' })} disabled={selected.status === 'suspended'}>
                  <ShieldAlert className="mr-1 h-3.5 w-3.5" /> Suspend
                </Button>
                <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setConfirm({ user: selected, type: 'ban', label: 'Ban user' })} disabled={selected.status === 'blocked'}>
                  <ShieldBan className="mr-1 h-3.5 w-3.5" /> Ban
                </Button>
                <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => setConfirm({ user: selected, type: 'activate', label: 'Reactivate user' })} disabled={selected.status === 'active'}>
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Reactivate
                </Button>
                <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => performAction(selected.user_id, 'reset_password')}>
                  <KeyRound className="mr-1 h-3.5 w-3.5" /> Reset password
                </Button>
                <Button size="sm" variant="destructive" className="h-8 rounded-full text-xs" onClick={() => setConfirm({ user: selected, type: 'delete', label: 'Permanently delete user' })}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
              </div>

              <div className="px-5 py-4">
                <Tabs defaultValue="listings">
                  <TabsList className="h-9 rounded-full bg-muted p-1">
                    <TabsTrigger value="listings" className="h-7 rounded-full text-xs data-[state=active]:bg-background">Listings</TabsTrigger>
                    <TabsTrigger value="orders" className="h-7 rounded-full text-xs data-[state=active]:bg-background">Orders</TabsTrigger>
                    <TabsTrigger value="reports" className="h-7 rounded-full text-xs data-[state=active]:bg-background">Reports</TabsTrigger>
                    <TabsTrigger value="reviews" className="h-7 rounded-full text-xs data-[state=active]:bg-background">Reviews</TabsTrigger>
                    <TabsTrigger value="threads" className="h-7 rounded-full text-xs data-[state=active]:bg-background">Support</TabsTrigger>
                  </TabsList>
                  {detailLoading && <div className="p-4"><Skeleton className="h-32 w-full rounded-2xl" /></div>}
                  {detail && (
                    <>
                      <TabsContent value="listings" className="mt-3"><ActivityList items={detail.listings} renderTitle={(l: any) => l.title} renderSub={(l: any) => `${l.status} · $${l.price} · ${format(new Date(l.created_at), 'MMM d')}`} /></TabsContent>
                      <TabsContent value="orders" className="mt-3">
                        <ActivityList items={[...(detail.ordersAsBuyer || []).map((o: any) => ({ ...o, role: 'buyer' })), ...(detail.ordersAsSeller || []).map((o: any) => ({ ...o, role: 'seller' }))]}
                          renderTitle={(o: any) => `${o.role === 'buyer' ? 'Bought' : 'Sold'} · ${o.order_number ?? o.id.slice(0, 8)}`}
                          renderSub={(o: any) => `${o.status} · $${o.price} · ${format(new Date(o.created_at), 'MMM d')}`} />
                      </TabsContent>
                      <TabsContent value="reports" className="mt-3">
                        <ActivityList items={[...(detail.reportsAgainst || []).map((r: any) => ({ ...r, dir: 'against' })), ...(detail.reportsBy || []).map((r: any) => ({ ...r, dir: 'by' }))]}
                          renderTitle={(r: any) => `Report ${r.dir} · ${r.report_type}`}
                          renderSub={(r: any) => `${r.reason ?? '—'} · ${format(new Date(r.created_at), 'MMM d, yyyy')}`} />
                      </TabsContent>
                      <TabsContent value="reviews" className="mt-3">
                        <ActivityList items={detail.reviews}
                          renderTitle={(r: any) => `${'⭐️'.repeat(r.rating)}`}
                          renderSub={(r: any) => `${r.comment ?? ''} · ${format(new Date(r.created_at), 'MMM d, yyyy')}`} />
                      </TabsContent>
                      <TabsContent value="threads" className="mt-3">
                        <ActivityList items={detail.threads}
                          renderTitle={(t: any) => t.title || 'Untitled thread'}
                          renderSub={(t: any) => `${t.status} · updated ${format(new Date(t.updated_at), 'MMM d')}`} />
                      </TabsContent>
                    </>
                  )}
                </Tabs>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> {confirm?.label}</AlertDialogTitle>
            <AlertDialogDescription>
              This will {confirm?.type === 'delete' ? 'permanently delete the account and all auth data' : `mark the user as ${confirm?.type}ed`}. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirm) { performAction(confirm.user.user_id, confirm.type); setConfirm(null); setSelected(null); } }}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'risk' | 'ok' }) {
  return (
    <div className={`rounded-md border p-2 ${tone === 'risk' ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/30'}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ActivityList({ items, renderTitle, renderSub }: { items: any[]; renderTitle: (i: any) => string; renderSub: (i: any) => string }) {
  if (!items || items.length === 0) return <p className="p-4 text-sm text-muted-foreground">Nothing here yet.</p>;
  return (
    <div className="max-h-64 overflow-y-auto divide-y divide-border">
      {items.slice(0, 50).map((i, idx) => (
        <div key={i.id ?? idx} className="px-2 py-2">
          <p className="text-sm font-medium text-foreground">{renderTitle(i)}</p>
          <p className="text-xs text-muted-foreground">{renderSub(i)}</p>
        </div>
      ))}
    </div>
  );
}
