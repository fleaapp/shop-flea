import { useMemo, useState } from 'react';
import { Download, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { WaitlistEntry } from '@/hooks/admin/useAdminWaitlist';
import { AdminBadge } from '@/components/admin/shell/AdminBadge';
import { AdminEmptyState } from '@/components/admin/shell/AdminEmptyState';

interface Props {
  entries: WaitlistEntry[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function toCsv(rows: WaitlistEntry[]) {
  const header = ['First name', 'Last name', 'Email', 'Country', 'Signed up'];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [header.join(',')];
  rows.forEach((r) => {
    lines.push([
      escape(r.first_name ?? ''),
      escape(r.last_name ?? ''),
      escape(r.email),
      escape(r.country_code ?? ''),
      escape(new Date(r.created_at).toISOString()),
    ].join(','));
  });
  return lines.join('\n');
}

export function WaitlistList({ entries, loading, error, onRefresh }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((r) =>
      [r.first_name, r.last_name, r.email, r.country_code]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [entries, search]);

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="px-4 pb-2 pt-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, country…"
            className="h-10 rounded-full border-border bg-card pl-9"
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{filtered.length} of {entries.length} signups</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="h-8 rounded-full text-xs">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
            </Button>
            <Button size="sm" onClick={exportCsv} disabled={filtered.length === 0} className="h-8 rounded-full text-xs">
              <Download className="mr-1 h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {error && <div className="mx-4 my-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {loading && entries.length === 0 ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
        ) : filtered.length === 0 ? (
          <AdminEmptyState emoji="📝" title="No signups match" description="Waitlist entries will show up here." />
        ) : (
          <div className="space-y-2 px-4 py-2">
            {filtered.map((r) => (
              <div key={r.id} className="rounded-2xl bg-card p-3 card-shadow">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}
                  </p>
                  {r.country_code && <AdminBadge tone="neutral">{r.country_code}</AdminBadge>}
                </div>
                <a href={`mailto:${r.email}`} className="mt-0.5 block truncate text-xs text-primary hover:underline">{r.email}</a>
                <p className="mt-1 text-[11px] text-muted-foreground">Signed up {new Date(r.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
