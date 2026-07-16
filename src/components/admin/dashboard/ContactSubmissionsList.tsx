import { useMemo, useState } from 'react';
import { Download, Loader2, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ContactSubmission } from '@/hooks/admin/useAdminContactSubmissions';
import { AdminEmptyState } from '@/components/admin/shell/AdminEmptyState';

interface Props {
  submissions: ContactSubmission[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

function toCsv(rows: ContactSubmission[]) {
  const header = ['Name', 'Email', 'Message', 'Submitted'];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [header.join(',')];
  rows.forEach((r) => {
    lines.push([
      escape(r.name ?? ''),
      escape(r.email),
      escape(r.message ?? ''),
      escape(new Date(r.created_at).toISOString()),
    ].join(','));
  });
  return lines.join('\n');
}

export function ContactSubmissionsList({ submissions, loading, error, onRefresh }: Props) {
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return submissions;
    return submissions.filter((r) =>
      [r.name, r.email, r.message].filter(Boolean).some((v) => (v as string).toLowerCase().includes(q))
    );
  }, [submissions, search]);

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contact-submissions-${new Date().toISOString().slice(0, 10)}.csv`;
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
            placeholder="Search name, email, message…"
            className="h-10 rounded-full border-border bg-card pl-9"
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{filtered.length} of {submissions.length}</span>
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
        {loading && submissions.length === 0 ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
        ) : filtered.length === 0 ? (
          <AdminEmptyState emoji="📮" title="No contact submissions" description="Messages from the contact form appear here." />
        ) : (
          <div className="space-y-2 px-4 py-2">
            {filtered.map((r) => {
              const open = openId === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setOpenId(open ? null : r.id)}
                  className="w-full rounded-2xl bg-card p-3 text-left card-shadow transition-transform active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{r.name || '—'}</p>
                      <a
                        href={`mailto:${r.email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 block truncate text-xs text-primary hover:underline"
                      >
                        {r.email}
                      </a>
                    </div>
                    <span className="shrink-0 text-muted-foreground">
                      {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </div>
                  <p className={`mt-2 text-sm text-foreground/80 ${open ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>{r.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
