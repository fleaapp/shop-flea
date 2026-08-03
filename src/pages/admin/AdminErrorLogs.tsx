import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { RefreshCw, Search, Trash2, X, ChevronDown } from 'lucide-react';
import { AdminHeader } from '@/components/admin/shell/AdminHeader';
import { AdminBadge, type AdminBadgeTone } from '@/components/admin/shell/AdminBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useAdminErrorLogs, type ErrorLogRow, type ErrorLogFilters } from '@/hooks/admin/useAdminErrorLogs';
import { markAdminTabSeen } from '@/lib/adminLastSeen';
import { explainError, friendlyRoute, friendlyDevice, SEVERITY_LABEL, SOURCE_LABEL, type PlainError } from '@/lib/errorCatalog';

const severityTone: Record<ErrorLogRow['severity'], AdminBadgeTone> = {
  critical: 'danger',
  error: 'warning',
  warning: 'neutral',
};

const severityDot: Record<ErrorLogRow['severity'], string> = {
  critical: 'bg-destructive',
  error: 'bg-amber-500',
  warning: 'bg-muted-foreground/60',
};

const sinceOptions = [
  { label: 'Last hour', value: 1 },
  { label: 'Today', value: 24 },
  { label: 'This week', value: 24 * 7 },
  { label: 'This month', value: 24 * 30 },
];

const sourceOptions: { label: string; value: ErrorLogFilters['source'] }[] = [
  { label: 'Everything', value: 'all' },
  { label: 'App', value: 'client' },
  { label: 'Backend', value: 'edge_function' },
  { label: 'Payments', value: 'payment' },
  { label: 'Sign in', value: 'auth' },
];

const severityOptions: { label: string; value: ErrorLogFilters['severity'] }[] = [
  { label: 'All', value: 'all' },
  { label: 'App broke', value: 'critical' },
  { label: 'Something failed', value: 'error' },
  { label: 'Minor', value: 'warning' },
];

type GroupedRow = {
  key: string;
  latest: ErrorLogRow;
  count: number;
  people: number;
  plain: PlainError;
  rows: ErrorLogRow[];
};

export default function AdminErrorLogs() {
  const navigate = useNavigate();
  const { rows, loading, filters, setFilters, refresh, deleteRow, clearOlderThan } = useAdminErrorLogs();
  const [selected, setSelected] = useState<GroupedRow | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [showTechnical, setShowTechnical] = useState(false);

  const summary = useMemo(() => {
    const s = { total: rows.length, critical: 0, error: 0, warning: 0 };
    rows.forEach((r) => { s[r.severity] += 1; });
    return s;
  }, [rows]);

  // Collapse identical errors into one entry with an occurrence count so a
  // single broken screen does not fill the page with copies of itself.
  const groups = useMemo<GroupedRow[]>(() => {
    const map = new Map<string, GroupedRow>();
    for (const r of rows) {
      const plain = explainError(r);
      const key = `${r.severity}|${plain.headline}|${r.title}|${r.message.slice(0, 120)}`;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.rows.push(r);
      } else {
        map.set(key, { key, latest: r, count: 1, people: 0, plain, rows: [r] });
      }
    }
    const out = Array.from(map.values());
    out.forEach((g) => {
      g.people = new Set(g.rows.map((r) => r.user_id || r.username || 'anon')).size;
    });
    return out.sort((a, b) => +new Date(b.latest.created_at) - +new Date(a.latest.created_at));
  }, [rows]);

  const needsAttention = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return groups.filter(
      (g) => (g.plain.impact === 'money' || g.plain.impact === 'access') && +new Date(g.latest.created_at) > cutoff,
    );
  }, [groups]);

  useEffect(() => {
    markAdminTabSeen('error_logs');
  }, [rows.length]);

  const openGroup = (g: GroupedRow) => { setShowTechnical(false); setSelected(g); };

  return (
    <div className="admin-scope native-safe-top fixed inset-0 flex flex-col bg-background overflow-hidden">
      <AdminHeader
        title="Error logs"
        emoji="🪵"
        right={
          <Button variant="ghost" size="icon" aria-label="Refresh logs" onClick={refresh} className="h-9 w-9 rounded-full">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-2 pb-24 space-y-3">
        {/* Summary chips */}
        <div className="grid grid-cols-4 gap-2">
          <StatChip label="Total" value={summary.total} />
          <StatChip label="App broke" value={summary.critical} tone="danger" />
          <StatChip label="Failed" value={summary.error} tone="warning" />
          <StatChip label="Minor" value={summary.warning} />
        </div>

        {/* Needs attention */}
        {needsAttention.length > 0 && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-destructive">
              Needs attention - last 24 hours
            </p>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Money or sign-in problems. These are the ones that cost real money or lock people out.
            </p>
            {needsAttention.slice(0, 4).map((g) => (
              <button
                key={g.key}
                onClick={() => openGroup(g)}
                className="w-full text-left rounded-xl bg-card border border-border/50 p-2.5 active:bg-muted/40"
              >
                <p className="text-sm font-semibold leading-snug">{g.plain.headline}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {g.count > 1 ? `${g.count} times` : 'Once'}
                  {g.people > 1 ? ` · ${g.people} people` : ''}
                  {' · '}
                  {formatDistanceToNow(new Date(g.latest.created_at), { addSuffix: true })}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {sourceOptions.map((opt) => (
              <FilterPill
                key={opt.value}
                active={filters.source === opt.value}
                onClick={() => setFilters({ ...filters, source: opt.value })}
                label={opt.label}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {severityOptions.map((opt) => (
              <FilterPill
                key={opt.value}
                active={filters.severity === opt.value}
                onClick={() => setFilters({ ...filters, severity: opt.value })}
                label={opt.label}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sinceOptions.map((opt) => (
              <FilterPill
                key={opt.value}
                active={filters.sinceHours === opt.value}
                onClick={() => setFilters({ ...filters, sinceHours: opt.value })}
                label={opt.label}
              />
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setFilters({ ...filters, search: searchInput }); }}
              onBlur={() => setFilters({ ...filters, search: searchInput })}
              placeholder="Search errors or a username"
              className="pl-9 rounded-full"
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setFilters({ ...filters, search: '' }); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label="Clear"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        {loading && groups.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            🎉 Nothing broke in this period. This list updates itself every 10 seconds.
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((g) => {
              const r = g.latest;
              const screen = friendlyRoute(r.route);
              const device = friendlyDevice(r.device);
              return (
                <button
                  key={g.key}
                  onClick={() => openGroup(g)}
                  className="w-full text-left rounded-2xl bg-card border border-border/50 p-3 active:bg-muted/40"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`h-2 w-2 rounded-full ${severityDot[r.severity]}`} />
                    <AdminBadge tone={severityTone[r.severity]}>{SEVERITY_LABEL[r.severity]}</AdminBadge>
                    <AdminBadge tone="neutral">{SOURCE_LABEL[r.source] ?? r.source}</AdminBadge>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-snug">{g.plain.headline}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{g.plain.explanation}</p>
                  <div className="flex flex-wrap items-center gap-x-1.5 mt-1.5 text-[11px] text-muted-foreground">
                    {r.username && <span className="font-medium">{r.username.startsWith('@') ? r.username : `@${r.username}`}</span>}
                    {screen && <span>· on {screen}</span>}
                    {device && <span>· {device}</span>}
                    {g.count > 1 && <span>· happened {g.count} times</span>}
                    {g.people > 1 && <span>· {g.people} people</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="pt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full rounded-full text-muted-foreground">
                <Trash2 className="h-4 w-4 mr-1.5" />
                Clear anything older than a day
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[320px] rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Clear old logs?</AlertDialogTitle>
                <AlertDialogDescription>
                  Deletes everything logged more than 24 hours ago. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row">
                <AlertDialogCancel className="h-9 rounded-lg flex-1">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="h-9 rounded-lg flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    try { await clearOlderThan(24); toast.success('Cleared'); }
                    catch (e: any) { toast.error(e?.message || 'Failed'); }
                  }}
                >
                  Clear
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Drawer open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DrawerContent className="fixed bottom-0 left-0 right-0 flex flex-col rounded-t-3xl">
          <DrawerHeader className="px-4 pt-3 pb-2">
            <DrawerTitle className="text-lg">What happened</DrawerTitle>
          </DrawerHeader>
          {selected && (() => {
            const r = selected.latest;
            const screen = friendlyRoute(r.route);
            const device = friendlyDevice(r.device);
            return (
              <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <AdminBadge tone={severityTone[r.severity]}>{SEVERITY_LABEL[r.severity]}</AdminBadge>
                  <AdminBadge tone="neutral">{SOURCE_LABEL[r.source] ?? r.source}</AdminBadge>
                  <span className="text-[11px] text-muted-foreground ml-auto">
                    {format(new Date(r.created_at), 'PP p')}
                  </span>
                </div>

                <div className="rounded-2xl bg-muted/40 p-3">
                  <p className="font-semibold text-foreground leading-snug">{selected.plain.headline}</p>
                  <p className="text-muted-foreground mt-1 leading-relaxed">{selected.plain.explanation}</p>
                </div>

                <Section title="Who it affected">
                  <ul className="space-y-1 text-muted-foreground">
                    <li>
                      {selected.people > 1
                        ? `${selected.people} different people`
                        : r.username
                          ? 'One person'
                          : 'One person (not signed in)'}
                      {selected.count > 1 ? `, ${selected.count} times in this period` : ', once'}
                    </li>
                    {r.username && (
                      <li>
                        Most recent:{' '}
                        <button
                          onClick={() => { if (r.user_id) navigate(`/seller/${r.user_id}`); }}
                          className="text-primary underline underline-offset-2"
                        >
                          {r.username.startsWith('@') ? r.username : `@${r.username}`}
                        </button>
                      </li>
                    )}
                    {screen && <li>Where: {screen}</li>}
                    {device && <li>Device: {device}</li>}
                  </ul>
                </Section>

                <Section title="What to do next">
                  <p className="text-muted-foreground leading-relaxed">{selected.plain.action}</p>
                  {r.context && (
                    <ContextActions ctx={r.context} onNavigate={(to) => { setSelected(null); navigate(to); }} />
                  )}
                </Section>

                <div>
                  <button
                    onClick={() => setShowTechnical((v) => !v)}
                    className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Technical detail
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showTechnical ? 'rotate-180' : ''}`} />
                  </button>

                  {showTechnical && (
                    <div className="mt-2 space-y-3">
                      <Field label="Raw title" value={r.title} />
                      <Field label="Raw message" value={r.message} />
                      {r.route && <Field label="Route" value={r.route} />}
                      {r.stack && <Block label="Stack" value={r.stack} />}
                      {r.device && <Block label="Device" value={JSON.stringify(r.device, null, 2)} />}
                      {r.context && <Block label="Context" value={JSON.stringify(r.context, null, 2)} />}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-full"
                    onClick={() => {
                      const payload = JSON.stringify(r, null, 2);
                      if (navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(payload).then(() => toast.success('Copied'));
                      }
                    }}
                  >
                    Copy details
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive"
                    onClick={async () => {
                      try {
                        await deleteRow(r.id);
                        setSelected(null);
                        toast.success('Deleted');
                      } catch (e: any) {
                        toast.error(e?.message || 'Failed');
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                  </Button>
                </div>
              </div>
            );
          })()}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
      <p className="whitespace-pre-wrap break-words text-xs">{value}</p>
    </div>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
      <pre className="rounded-lg bg-muted p-2 text-[11px] leading-relaxed overflow-x-auto max-h-64 whitespace-pre-wrap break-words">{value}</pre>
    </div>
  );
}

function StatChip({ label, value, tone }: { label: string; value: number; tone?: 'danger' | 'warning' }) {
  const toneCls = tone === 'danger'
    ? 'bg-destructive/10 text-destructive'
    : tone === 'warning'
      ? 'bg-amber-500/10 text-amber-700'
      : 'bg-muted/40 text-foreground';
  return (
    <div className={`rounded-2xl p-2.5 ${toneCls}`}>
      <div className="text-lg font-bold leading-none">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        active ? 'bg-charcoal text-white border-charcoal' : 'bg-card text-foreground border-border/60'
      }`}
    >
      {label}
    </button>
  );
}

function ContextActions({ ctx, onNavigate }: { ctx: Record<string, any>; onNavigate: (to: string) => void }) {
  const links: { label: string; to: string }[] = [];
  if (ctx.order_id) links.push({ label: `Open order ${String(ctx.order_id).slice(0, 8)}`, to: `/orders/${ctx.order_id}` });
  if (ctx.listing_id) links.push({ label: `Open listing ${String(ctx.listing_id).slice(0, 8)}`, to: `/listing/${ctx.listing_id}` });
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {links.map((l) => (
        <button
          key={l.to}
          onClick={() => onNavigate(l.to)}
          className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary"
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
