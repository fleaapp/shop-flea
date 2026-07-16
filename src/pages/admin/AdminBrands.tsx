import { useEffect, useMemo, useState } from 'react';
import { Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAdminBrands, type AdminBrand } from '@/hooks/admin/useAdminBrands';
import { AdminHeader } from '@/components/admin/shell/AdminHeader';
import { AdminBadge } from '@/components/admin/shell/AdminBadge';
import { AdminEmptyState } from '@/components/admin/shell/AdminEmptyState';

const LAST_SEEN_KEY = 'admin_brands_last_seen';

export default function AdminBrands() {
  const { brands, loading, search, setSearch, rename, remove } = useAdminBrands();
  const [editing, setEditing] = useState<AdminBrand | null>(null);
  const [value, setValue] = useState('');
  const [previousLastSeen] = useState<string | null>(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem(LAST_SEEN_KEY) : null
  );

  useEffect(() => {
    if (!loading) {
      window.localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    }
  }, [loading]);

  const isNew = useMemo(() => {
    const sinceMs = previousLastSeen ? Date.parse(previousLastSeen) : Date.now() - 30 * 24 * 60 * 60 * 1000;
    return (b: AdminBrand) => !!b.created_at && Date.parse(b.created_at) > sinceMs;
  }, [previousLastSeen]);

  const sortedBrands = useMemo(() => {
    return [...brands].sort((a, b) => {
      const an = isNew(a) ? 0 : 1;
      const bn = isNew(b) ? 0 : 1;
      if (an !== bn) return an - bn;
      return (a.display_name || '').localeCompare(b.display_name || '', undefined, { sensitivity: 'base' });
    });
  }, [brands, isNew]);

  const openEdit = (b: AdminBrand) => { setEditing(b); setValue(b.display_name); };

  const newCount = sortedBrands.filter(isNew).length;

  return (
    <div className="admin-scope flex min-h-[100svh] flex-col bg-background pb-24">
      <AdminHeader title="Brands" emoji="🏷️" />

      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brands…"
            className="h-10 rounded-full border-border bg-card pl-9"
          />
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{brands.length} total</span>
          {newCount > 0 && <AdminBadge tone="success">✨ {newCount} new</AdminBadge>}
        </div>
      </div>

      <div className="flex-1 px-4 pt-2">
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)}</div>
        ) : brands.length === 0 ? (
          <AdminEmptyState emoji="🏷️" title="No brands yet" />
        ) : (
          <div className="space-y-2">
            {sortedBrands.map((b) => {
              const fresh = isNew(b);
              return (
                <div
                  key={b.id}
                  className={`flex items-center justify-between rounded-2xl p-3 card-shadow ${fresh ? 'bg-primary/10 ring-1 ring-primary/40' : 'bg-card'}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{b.display_name}</p>
                      {fresh && <AdminBadge tone="success">✨ New</AdminBadge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{b.brand_name} · {b.usage_count ?? 0} uses</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)} className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete brand "${b.display_name}"?`)) remove(b.id); }} className="h-8 w-8">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename brand</DialogTitle></DialogHeader>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Display name" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={async () => { if (editing) { await rename(editing.id, value); setEditing(null); } }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
