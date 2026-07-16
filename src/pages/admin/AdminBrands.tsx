import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAdminBrands, type AdminBrand } from '@/hooks/admin/useAdminBrands';

export default function AdminBrands() {
  const navigate = useNavigate();
  const { brands, loading, search, setSearch, rename, remove } = useAdminBrands();
  const [editing, setEditing] = useState<AdminBrand | null>(null);
  const [value, setValue] = useState('');

  const openEdit = (b: AdminBrand) => { setEditing(b); setValue(b.display_name); };

  return (
    <div className="admin-scope flex min-h-screen flex-col bg-background pb-20">
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-background px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="flex-1 text-center text-lg font-bold">🏷️ Brands</h1>
        <div className="w-8" />
      </header>

      <div className="border-b border-border bg-card px-4 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search brands…" className="pl-8" />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-3">
        {loading ? (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : brands.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">No brands.</p>
        ) : (
          <div className="space-y-2">
            {brands.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-xl bg-card p-3 card-shadow">
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{b.brand_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{b.usage_count ?? 0} uses</Badge>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete brand "${b.display_name}"?`)) remove(b.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
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
