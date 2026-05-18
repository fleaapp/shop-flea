import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { WaitlistEntry } from '@/hooks/admin/useAdminWaitlist';

type SortKey = 'created_at' | 'email' | 'first_name' | 'last_name' | 'country_code';

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
    lines.push(
      [
        escape(r.first_name ?? ''),
        escape(r.last_name ?? ''),
        escape(r.email),
        escape(r.country_code ?? ''),
        escape(new Date(r.created_at).toISOString()),
      ].join(','),
    );
  });
  return lines.join('\n');
}

export function WaitlistList({ entries, loading, error, onRefresh }: Props) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = entries;
    if (q) {
      rows = rows.filter((r) =>
        [r.first_name, r.last_name, r.email, r.country_code]
          .filter(Boolean)
          .some((v) => (v as string).toLowerCase().includes(q)),
      );
    }
    rows = [...rows].sort((a, b) => {
      const av = (a[sortKey] ?? '') as string;
      const bv = (b[sortKey] ?? '') as string;
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [entries, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

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

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className="inline-flex items-center gap-1 font-medium hover:text-foreground"
    >
      {label}
      {sortKey === k &&
        (sortDir === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        ))}
    </button>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, country..."
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filtered.length} of {entries.length}
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
        </Button>
        <Button size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {error && <div className="p-4 text-sm text-destructive">{error}</div>}
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortHeader k="first_name" label="First" /></TableHead>
                <TableHead><SortHeader k="last_name" label="Last" /></TableHead>
                <TableHead><SortHeader k="email" label="Email" /></TableHead>
                <TableHead><SortHeader k="country_code" label="Country" /></TableHead>
                <TableHead><SortHeader k="created_at" label="Signed up" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.first_name ?? '—'}</TableCell>
                  <TableCell>{r.last_name ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{r.email}</TableCell>
                  <TableCell>{r.country_code}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No signups found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
