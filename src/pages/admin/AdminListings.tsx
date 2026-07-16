import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminListings, type AdminListing } from '@/hooks/admin/useAdminListings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Eye, EyeOff, Star, Trash2, RotateCcw, AlertTriangle, ExternalLink, Heart, MessageCircle, ShoppingBag, Flag, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { AdminHeader } from '@/components/admin/shell/AdminHeader';
import { AdminBadge, toneForStatus, statusLabel } from '@/components/admin/shell/AdminBadge';
import { AdminChipFilter } from '@/components/admin/shell/AdminChipFilter';
import { AdminEmptyState } from '@/components/admin/shell/AdminEmptyState';

const initials = (s?: string | null) => (s ?? '?').replace('@', '').slice(0, 2).toUpperCase();

export default function AdminListings() {
  const navigate = useNavigate();
  const { listings, loading, search, setSearch, status, setStatus, sort, setSort, dir, setDir, minReports, setMinReports, performAction, stats } = useAdminListings();
  const [selected, setSelected] = useState<AdminListing | null>(null);

  const statusOptions = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'active', label: 'Active', emoji: '🟢', count: stats.active },
    { key: 'sold', label: 'Sold', emoji: '💰', count: stats.sold },
    { key: 'refunded', label: 'Refunded', emoji: '↩️', count: stats.refunded },
    { key: 'hidden', label: 'Hidden', emoji: '🙈' },
    { key: 'removed', label: 'Deleted', emoji: '🗑️', count: stats.deleted },
    { key: 'archived', label: 'Archived', emoji: '📦' },
    { key: 'featured', label: 'Featured', emoji: '⭐️' },
  ] as const;

  return (
    <div className="admin-scope flex min-h-[100svh] flex-col bg-background pb-24">
      <AdminHeader title="Listings" emoji="📦" />

      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, brand, ID…"
            className="h-10 rounded-full border-border bg-card pl-9"
          />
        </div>
      </div>

      <AdminChipFilter options={statusOptions as any} value={status} onChange={(v) => setStatus(v as any)} />

      <div className="flex items-center gap-2 px-4 pb-2">
        <Select value={sort} onValueChange={(v) => setSort(v as any)}>
          <SelectTrigger className="h-9 w-[140px] rounded-full border-border bg-card text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Newest</SelectItem>
            <SelectItem value="price">Price</SelectItem>
            <SelectItem value="report_count">Reports</SelectItem>
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
        <Select value={String(minReports)} onValueChange={(v) => setMinReports(Number(v))}>
          <SelectTrigger className="h-9 w-[130px] rounded-full border-border bg-card text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any reports</SelectItem>
            <SelectItem value="1">≥ 1 report</SelectItem>
            <SelectItem value="2">≥ 2 reports</SelectItem>
            <SelectItem value="3">≥ 3 reports</SelectItem>
          </SelectContent>
        </Select>
        {stats.flagged > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">🚩 {stats.flagged}</span>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-56 w-full rounded-2xl" />)}</div>
        ) : listings.length === 0 ? (
          <AdminEmptyState emoji="🔍" title="No listings match" description="Try clearing filters or searching by ID." />
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelected(l)}
                className="group overflow-hidden rounded-2xl bg-card text-left card-shadow transition-transform active:scale-[0.98]"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                  {l.images?.[0] && <img src={l.images[0]} alt={l.title} className="h-full w-full object-cover" loading="lazy" />}
                  <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
                    <AdminBadge tone={toneForStatus(l.status)}>{statusLabel(l.status)}</AdminBadge>
                    {l.report_count > 0 && (
                      <AdminBadge tone="danger">
                        <Flag className="h-2.5 w-2.5" />
                        {l.report_count}
                      </AdminBadge>
                    )}
                    {l.spam_signal && <AdminBadge tone="warning">Spam?</AdminBadge>}
                    {l.is_duplicate && <AdminBadge tone="accent">Dup</AdminBadge>}
                  </div>
                </div>
                <div className="p-2.5">
                  <p className="truncate text-sm font-semibold text-foreground">{l.title}</p>
                  <p className="truncate text-xs text-muted-foreground">${l.price} · {l.seller_profile.username}</p>
                  <p className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" />{l.favorites_count}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3" />{l.comments_count}</span>
                    <span className="flex items-center gap-0.5"><ShoppingBag className="h-3 w-3" />{l.orders_count}</span>
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl border-border bg-background p-0">
          {selected && (
            <div className="flex flex-col">
              <div className="rounded-t-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-background px-5 pb-4 pt-6">
                <DialogHeader>
                  <DialogTitle className="text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-bold">{selected.title}</span>
                      <AdminBadge tone={toneForStatus(selected.status)}>{statusLabel(selected.status)}</AdminBadge>
                      {selected.report_count > 0 && (
                        <AdminBadge tone="danger"><Flag className="h-3 w-3" />{selected.report_count}</AdminBadge>
                      )}
                      {selected.spam_signal && <AdminBadge tone="warning">Spam?</AdminBadge>}
                      {selected.is_duplicate && <AdminBadge tone="accent">Duplicate</AdminBadge>}
                    </div>
                    <p className="mt-1 text-xs font-normal text-muted-foreground">
                      ${selected.price} · {selected.brand} · {selected.size} · {format(new Date(selected.created_at), 'MMM d, yyyy')}
                    </p>
                  </DialogTitle>
                </DialogHeader>
              </div>

              <div className="space-y-4 px-5 py-4">
                {selected.images?.[0] && (
                  <div className="grid grid-cols-3 gap-2">
                    {selected.images.slice(0, 6).map((src, i) => (
                      <img key={i} src={src} alt="" className="aspect-[4/5] w-full rounded-2xl object-cover" />
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Field label="Price" value={`$${selected.price}`} />
                  <Field label="Shipping" value={`$${selected.shipping_price ?? 0}`} />
                  <Field label="Brand" value={selected.brand} />
                  <Field label="Size" value={selected.size} />
                  <Field label="Category" value={selected.category} />
                  <Field label="Subcategory" value={selected.subcategory ?? '—'} />
                  <Field label="Condition" value={selected.condition} />
                  <Field label="Created" value={format(new Date(selected.created_at), 'MMM d')} />
                </div>

                <button
                  onClick={() => navigate(`/seller/${selected.user_id}`)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left card-shadow transition-transform active:scale-[0.99]"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={selected.seller_profile.avatar_url ?? undefined} />
                    <AvatarFallback>{initials(selected.seller_profile.username)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{selected.seller_profile.username}</p>
                    <p className="truncate text-xs text-muted-foreground">{selected.seller_profile.email ?? '—'} · {selected.seller_profile.status ?? 'active'}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </button>

                <div className="grid grid-cols-4 gap-2">
                  <Stat icon={<Heart className="h-4 w-4" />} label="Faves" value={selected.favorites_count} />
                  <Stat icon={<MessageCircle className="h-4 w-4" />} label="Comments" value={selected.comments_count} />
                  <Stat icon={<ShoppingBag className="h-4 w-4" />} label="Orders" value={selected.orders_count} />
                  <Stat icon={<Flag className="h-4 w-4" />} label="Reports" value={selected.report_count} tone={selected.report_count > 0 ? 'risk' : undefined} />
                </div>

                {(selected.spam_signal || selected.is_duplicate) && (
                  <div className="flex items-start gap-2 rounded-2xl border border-yellow-300/60 bg-yellow-500/10 p-3 text-sm text-yellow-900 dark:text-yellow-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-0.5">
                      {selected.is_duplicate && <p>Possible duplicate of another listing by this seller.</p>}
                      {selected.spam_signal && <p>Heuristic flag: high reports, short title, or contains links/handles.</p>}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border/60 bg-muted/30 px-5 py-3">
                <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => { performAction(selected.id, 'approve'); setSelected(null); }}>Approve</Button>
                <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => { performAction(selected.id, 'hide'); setSelected(null); }}><EyeOff className="mr-1 h-3.5 w-3.5" /> Hide</Button>
                <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => { performAction(selected.id, 'feature'); setSelected(null); }}><Star className="mr-1 h-3.5 w-3.5" /> Feature</Button>
                <Button size="sm" variant="outline" className="h-8 rounded-full text-xs" onClick={() => { performAction(selected.id, 'restore'); setSelected(null); }}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Restore</Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-full text-xs" onClick={() => navigate(`/listing/${selected.id}`)}><Eye className="mr-1 h-3.5 w-3.5" /> View</Button>
                <Button size="sm" variant="destructive" className="ml-auto h-8 rounded-full text-xs" onClick={() => { if (confirm('Delete this listing? It stays under Deleted so admin history is preserved.')) { performAction(selected.id, 'soft_delete'); setSelected(null); } }}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-2.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: 'risk' }) {
  return (
    <div className={`rounded-2xl border p-2.5 text-center ${tone === 'risk' ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card'}`}>
      <div className="flex items-center justify-center gap-1 text-muted-foreground">{icon}<span className="text-[10px] uppercase tracking-wide">{label}</span></div>
      <p className="mt-0.5 text-base font-bold">{value}</p>
    </div>
  );
}
