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

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500/10 text-emerald-700 border-emerald-300',
    suspended: 'bg-yellow-500/10 text-yellow-700 border-yellow-300',
    blocked: 'bg-destructive/10 text-destructive border-destructive/30',
  };
  return map[status] ?? 'bg-muted text-muted-foreground border-border';
}

function riskBadge(score: number) {
  if (score >= 70) return 'bg-destructive/10 text-destructive border-destructive/30';
  if (score >= 40) return 'bg-yellow-500/10 text-yellow-700 border-yellow-300';
  return 'bg-emerald-500/10 text-emerald-700 border-emerald-300';
}

export default function AdminUsers() {
  const navigate = useNavigate();
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

  return (
    <div className="admin-scope flex h-screen flex-col bg-background">
      <header className="border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground sm:text-xl">User Management</h1>
              <p className="hidden text-sm text-muted-foreground sm:block">{stats.total} users · {stats.risky} flagged risky</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusBadge('active')}>Active {stats.active}</Badge>
            <Badge className={statusBadge('suspended')}>Suspended {stats.suspended}</Badge>
            <Badge className={statusBadge('blocked')}>Blocked {stats.blocked}</Badge>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search username, email, name…" className="pl-8" />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as any)}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Sort: Signup date</SelectItem>
            <SelectItem value="last_sign_in_at">Sort: Last active</SelectItem>
            <SelectItem value="username">Sort: Username</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}>{dir === 'asc' ? 'Asc' : 'Desc'}</Button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">No users match these filters</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {users.map((u) => (
              <button key={u.user_id} onClick={() => openDetail(u)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/40">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={u.avatar_url ?? undefined} />
                  <AvatarFallback>{initials(u.username)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-foreground">{u.username}</p>
                    <Badge className={statusBadge(u.status)} variant="outline">{u.status}</Badge>
                    {u.report_strike_count > 0 && (
                      <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                        {u.report_strike_count} strike{u.report_strike_count > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{u.email ?? '—'} · joined {format(new Date(u.created_at), 'MMM d, yyyy')}</p>
                </div>
                <div className="hidden text-right text-xs text-muted-foreground sm:block">
                  <p>{u.listings_total} listings · {u.orders_as_seller} sales</p>
                  <p>{fmtCurrency(u.seller_volume + u.buyer_volume)} volume · {u.refunds_count} refunds</p>
                </div>
                <Badge className={riskBadge(u.risk_score)} variant="outline">Risk {u.risk_score}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) { setSelected(null); setDetail(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selected.avatar_url ?? undefined} />
                    <AvatarFallback>{initials(selected.username)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">{selected.username}<Badge className={statusBadge(selected.status)} variant="outline">{selected.status}</Badge></div>
                    <p className="text-xs font-normal text-muted-foreground">{selected.email}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Risk score" value={String(selected.risk_score)} tone={selected.risk_score >= 50 ? 'risk' : 'ok'} />
                <Stat label="Listings" value={`${selected.listings_total} (${selected.listings_active} active)`} />
                <Stat label="Sales" value={String(selected.orders_as_seller)} />
                <Stat label="Volume" value={fmtCurrency(selected.seller_volume + selected.buyer_volume)} />
                <Stat label="Refunds" value={String(selected.refunds_count)} />
                <Stat label="Reports against" value={String(selected.reports_against)} />
                <Stat label="Strikes" value={String(selected.report_strike_count)} />
                <Stat label="Last active" value={selected.last_sign_in_at ? format(new Date(selected.last_sign_in_at), 'MMM d') : '—'} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1"><CreditCard className="h-3 w-3" /> Stripe {selected.stripe_onboarding_complete ? '✓' : '—'}</Badge>
                {selected.country_code && <Badge variant="outline">{selected.country_code}</Badge>}
                {selected.region_id && <Badge variant="outline">{selected.region_id}</Badge>}
              </div>

              <div className="flex flex-wrap gap-2 border-y border-border py-3">
                <Button size="sm" variant="outline" onClick={() => setConfirm({ user: selected, type: 'suspend', label: 'Suspend user' })} disabled={selected.status === 'suspended'}>
                  <ShieldAlert className="mr-1 h-4 w-4" /> Suspend
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirm({ user: selected, type: 'ban', label: 'Ban user' })} disabled={selected.status === 'blocked'}>
                  <ShieldBan className="mr-1 h-4 w-4" /> Ban
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirm({ user: selected, type: 'activate', label: 'Reactivate user' })} disabled={selected.status === 'active'}>
                  <ShieldCheck className="mr-1 h-4 w-4" /> Reactivate
                </Button>
                <Button size="sm" variant="outline" onClick={() => performAction(selected.user_id, 'reset_password')}>
                  <KeyRound className="mr-1 h-4 w-4" /> Reset password
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setConfirm({ user: selected, type: 'delete', label: 'Permanently delete user' })}>
                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                </Button>
              </div>

              <Tabs defaultValue="listings">
                <TabsList>
                  <TabsTrigger value="listings">Listings</TabsTrigger>
                  <TabsTrigger value="orders">Orders</TabsTrigger>
                  <TabsTrigger value="reports">Reports</TabsTrigger>
                  <TabsTrigger value="reviews">Reviews</TabsTrigger>
                  <TabsTrigger value="threads">Support</TabsTrigger>
                </TabsList>
                {detailLoading && <div className="p-4"><Skeleton className="h-32 w-full" /></div>}
                {detail && (
                  <>
                    <TabsContent value="listings"><ActivityList items={detail.listings} renderTitle={(l: any) => l.title} renderSub={(l: any) => `${l.status} · $${l.price} · ${format(new Date(l.created_at), 'MMM d')}`} /></TabsContent>
                    <TabsContent value="orders">
                      <ActivityList items={[...(detail.ordersAsBuyer || []).map((o: any) => ({ ...o, role: 'buyer' })), ...(detail.ordersAsSeller || []).map((o: any) => ({ ...o, role: 'seller' }))]}
                        renderTitle={(o: any) => `${o.role === 'buyer' ? 'Bought' : 'Sold'} — ${o.order_number ?? o.id.slice(0, 8)}`}
                        renderSub={(o: any) => `${o.status} · $${o.price} · ${format(new Date(o.created_at), 'MMM d')}`} />
                    </TabsContent>
                    <TabsContent value="reports">
                      <ActivityList items={[...(detail.reportsAgainst || []).map((r: any) => ({ ...r, dir: 'against' })), ...(detail.reportsBy || []).map((r: any) => ({ ...r, dir: 'by' }))]}
                        renderTitle={(r: any) => `Report ${r.dir} — ${r.report_type}`}
                        renderSub={(r: any) => `${r.reason ?? '—'} · ${format(new Date(r.created_at), 'MMM d, yyyy')}`} />
                    </TabsContent>
                    <TabsContent value="reviews">
                      <ActivityList items={detail.reviews}
                        renderTitle={(r: any) => `${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}`}
                        renderSub={(r: any) => `${r.comment ?? ''} · ${format(new Date(r.created_at), 'MMM d, yyyy')}`} />
                    </TabsContent>
                    <TabsContent value="threads">
                      <ActivityList items={detail.threads}
                        renderTitle={(t: any) => t.title || 'Untitled thread'}
                        renderSub={(t: any) => `${t.status} · updated ${format(new Date(t.updated_at), 'MMM d')}`} />
                    </TabsContent>
                  </>
                )}
              </Tabs>
            </>
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
