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
import { ArrowLeft, Search, Package, Eye, EyeOff, Star, Trash2, RotateCcw, AlertTriangle, ExternalLink, Heart, MessageCircle, ShoppingBag, Flag } from 'lucide-react';
import { format } from 'date-fns';

const statusColor: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-700 border-emerald-300',
  sold: 'bg-blue-500/10 text-blue-700 border-blue-300',
  hidden: 'bg-yellow-500/10 text-yellow-700 border-yellow-300',
  removed: 'bg-destructive/10 text-destructive border-destructive/30',
  refunded: 'bg-orange-500/10 text-orange-700 border-orange-300',
  archived: 'bg-muted text-muted-foreground border-border',
  featured: 'bg-purple-500/10 text-purple-700 border-purple-300',
};
const statusLabel = (status: string) => status === 'removed' ? 'Deleted' : status.charAt(0).toUpperCase() + status.slice(1);
const initials = (s?: string | null) => (s ?? '?').replace('@', '').slice(0, 2).toUpperCase();

export default function AdminListings() {
  const navigate = useNavigate();
  const { listings, loading, search, setSearch, status, setStatus, sort, setSort, dir, setDir, minReports, setMinReports, performAction, stats } = useAdminListings();
  const [selected, setSelected] = useState<AdminListing | null>(null);

  return (
    <div className="admin-scope flex h-screen flex-col bg-background">
      <header className="border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground sm:text-xl">Listings Management</h1>
              <p className="hidden text-sm text-muted-foreground sm:block">{stats.total} shown · {stats.flagged} flagged</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusColor.active}>Active {stats.active}</Badge>
            <Badge className={statusColor.sold}>Sold {stats.sold}</Badge>
            <Badge className={statusColor.refunded}>Refunded {stats.refunded}</Badge>
            <Badge className={statusColor.removed}>Deleted {stats.deleted}</Badge>
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, brand, ID…" className="pl-8" />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as any)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
            <SelectItem value="removed">Deleted</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="featured">Featured</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as any)}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Sort: Newest</SelectItem>
            <SelectItem value="price">Sort: Price</SelectItem>
            <SelectItem value="report_count">Sort: Reports</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setDir(dir === 'asc' ? 'desc' : 'asc')}>{dir === 'asc' ? 'Asc' : 'Desc'}</Button>
        <Select value={String(minReports)} onValueChange={(v) => setMinReports(Number(v))}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any reports</SelectItem>
            <SelectItem value="1">≥ 1 report</SelectItem>
            <SelectItem value="2">≥ 2 reports</SelectItem>
            <SelectItem value="3">≥ 3 reports</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}</div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">No listings match these filters.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((l) => (
              <button key={l.id} onClick={() => setSelected(l)} className="group overflow-hidden rounded-md border border-border bg-card text-left transition-shadow hover:shadow-md">
                <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                  {l.images?.[0] && <img src={l.images[0]} alt={l.title} className="h-full w-full object-cover" loading="lazy" />}
                  <div className="absolute left-1 top-1 flex flex-wrap gap-1">
                    <Badge className={statusColor[l.status] ?? 'bg-muted text-muted-foreground'} variant="outline">{statusLabel(l.status)}</Badge>
                    {l.report_count > 0 && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 gap-0.5"><Flag className="h-3 w-3" />{l.report_count}</Badge>}
                    {l.spam_signal && <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-300">Spam?</Badge>}
                    {l.is_duplicate && <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-300">Dup</Badge>}
                  </div>
                </div>
                <div className="p-2">
                  <p className="truncate text-sm font-medium text-foreground">{l.title}</p>
                  <p className="text-xs text-muted-foreground">${l.price} · @{l.seller_profile.username}</p>
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.title}
                  <Badge className={statusColor[selected.status] ?? ''} variant="outline">{statusLabel(selected.status)}</Badge>
                </DialogTitle>
              </DialogHeader>

              {selected.images?.[0] && (
                <div className="grid grid-cols-3 gap-2">
                  {selected.images.slice(0, 6).map((src, i) => (
                    <img key={i} src={src} alt="" className="aspect-[4/5] w-full rounded object-cover" />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <Field label="Price" value={`$${selected.price}`} />
                <Field label="Shipping" value={`$${selected.shipping_price ?? 0}`} />
                <Field label="Brand" value={selected.brand} />
                <Field label="Size" value={selected.size} />
                <Field label="Category" value={selected.category} />
                <Field label="Subcategory" value={selected.subcategory ?? '—'} />
                <Field label="Condition" value={selected.condition} />
                <Field label="Created" value={format(new Date(selected.created_at), 'MMM d, yyyy')} />
              </div>

              <div className="rounded border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={selected.seller_profile.avatar_url ?? undefined} />
                    <AvatarFallback>{initials(selected.seller_profile.username)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{selected.seller_profile.username}</p>
                    <p className="truncate text-xs text-muted-foreground">{selected.seller_profile.email ?? '—'} · {selected.seller_profile.status ?? 'active'}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/seller/${selected.user_id}`)}><ExternalLink className="h-4 w-4" /></Button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <Stat icon={<Heart className="h-4 w-4" />} label="Faves" value={selected.favorites_count} />
                <Stat icon={<MessageCircle className="h-4 w-4" />} label="Comments" value={selected.comments_count} />
                <Stat icon={<ShoppingBag className="h-4 w-4" />} label="Orders" value={selected.orders_count} />
                <Stat icon={<Flag className="h-4 w-4" />} label="Reports" value={selected.report_count} tone={selected.report_count > 0 ? 'risk' : undefined} />
              </div>

              {(selected.spam_signal || selected.is_duplicate) && (
                <div className="flex items-start gap-2 rounded border border-yellow-300 bg-yellow-500/10 p-3 text-sm text-yellow-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <div>
                    {selected.is_duplicate && <p>Possible duplicate of another listing by this seller.</p>}
                    {selected.spam_signal && <p>Heuristic flag: high reports, short title, or contains links/handles.</p>}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Button size="sm" variant="outline" onClick={() => { performAction(selected.id, 'approve'); setSelected(null); }}>Approve / Activate</Button>
                <Button size="sm" variant="outline" onClick={() => { performAction(selected.id, 'hide'); setSelected(null); }}><EyeOff className="mr-1 h-4 w-4" /> Hide</Button>
                <Button size="sm" variant="outline" onClick={() => { performAction(selected.id, 'feature'); setSelected(null); }}><Star className="mr-1 h-4 w-4" /> Feature</Button>
                <Button size="sm" variant="outline" onClick={() => { performAction(selected.id, 'restore'); setSelected(null); }}><RotateCcw className="mr-1 h-4 w-4" /> Restore</Button>
                <Button size="sm" variant="destructive" onClick={() => { if (confirm('Delete this listing? It stays under Deleted so admin history is preserved.')) { performAction(selected.id, 'soft_delete'); setSelected(null); } }}><Trash2 className="mr-1 h-4 w-4" /> Delete listing</Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/listing/${selected.id}`)}><Eye className="mr-1 h-4 w-4" /> View on site</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-border bg-muted/30 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: 'risk' }) {
  return (
    <div className={`rounded border p-2 ${tone === 'risk' ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/30'}`}>
      <div className="flex items-center justify-center gap-1 text-muted-foreground">{icon}<span className="text-[10px] uppercase">{label}</span></div>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}
