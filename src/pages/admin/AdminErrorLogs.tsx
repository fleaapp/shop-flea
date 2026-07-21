import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, format } from 'date-fns';
import { RefreshCw, Search, Trash2, X } from 'lucide-react';
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

const sourceLabel: Record<ErrorLogRow['source'], string> = {
  client: 'Client',
  edge_function: 'Edge',
  payment: 'Payment',
  auth: 'Auth',
};

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
  { label: '1 h', value: 1 },
  { label: '24 h', value: 24 },
  { label: '7 d', value: 24 * 7 },
  { label: '30 d', value: 24 * 30 },
];

const sourceOptions: { label: string; value: ErrorLogFilters['source'] }[] = [
  { label: 'All', value: 'all' },
  { label: 'Client', value: 'client' },
  { label: 'Edge', value: 'edge_function' },
  { label: 'Payment', value: 'payment' },
  { label: 'Auth', value: 'auth' },
];

const severityOptions: { label: string; value: ErrorLogFilters['severity'] }[] = [
  { label: 'All', value: 'all' },
  { label: 'Critical', value: 'critical' },
  { label: 'Error', value: 'error' },
  { label: 'Warning', value: 'warning' },
];

export default function AdminErrorLogs() {
  const navigate = useNavigate();
  const { rows, loading, filters, setFilters, refresh, deleteRow, clearOlderThan } = useAdminErrorLogs();
  const [selected, setSelected] = useState<ErrorLogRow | null>(null);
  const [searchInput, setSearchInput] = useState('');

  const summary = useMemo(() => {
    const s = { total: rows.length, critical: 0, error: 0, warning: 0 };
    rows.forEach((r) => { s[r.severity] += 1; });
    return s;
  }, [rows]);

  // Clear the Error Logs badge as soon as the tab is opened, and again
  // whenever new rows arrive while it's already open, so the count never
  // lingers after the admin has actually seen the latest entries.
  useEffect(() => {
    markAdminTabSeen('error_logs');
  }, [rows.length]);

  return (
    <div className="admin-scope native-safe-top fixed inset-0 flex flex-col bg-background overflow-hidden">
      <AdminHeader
        title="Error logs"
        emoji="🪵"
        right={
          <Button variant="ghost" size="icon" onClick={refresh} className="h-9 w-9 rounded-full">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        }
      />

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-2 pb-24 space-y-3">
        {/* Summary chips */}
        <div className="grid grid-cols-4 gap-2">
          <StatChip label="Total" value={summary.total} />
          <StatChip label="Critical" value={summary.critical} tone="danger" />
          <StatChip label="Errors" value={summary.error} tone="warning" />
          <StatChip label="Warnings" value={summary.warning} />
        </div>

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
              placeholder="Search title, message, username"
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
        {loading && rows.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            🎉 No errors in this window. Auto-refreshes every 10 seconds.
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="w-full text-left rounded-2xl bg-card border border-border/50 p-3 active:bg-muted/40"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`h-2 w-2 rounded-full ${severityDot[r.severity]}`} />
                  <AdminBadge tone={severityTone[r.severity]}>{r.severity}</AdminBadge>
                  <AdminBadge tone="neutral">{sourceLabel[r.source]}</AdminBadge>
                  <span className="ml-auto text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground leading-snug line-clamp-1">{r.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.message}</p>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                  {r.username && <span className="font-medium">{r.username.startsWith('@') ? r.username : `@${r.username}`}</span>}
                  {r.route && <span className="truncate">· {r.route}</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="pt-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full rounded-full text-muted-foreground">
                <Trash2 className="h-4 w-4 mr-1.5" />
                Clear logs older than 24 h
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[320px] rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Clear old logs?</AlertDialogTitle>
                <AlertDialogDescription>
                  Deletes error logs older than 24 hours. This cannot be undone.
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
            <DrawerTitle className="text-lg">Error detail</DrawerTitle>
          </DrawerHeader>
          {selected && (
            <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <AdminBadge tone={severityTone[selected.severity]}>{selected.severity}</AdminBadge>
                <AdminBadge tone="neutral">{sourceLabel[selected.source]}</AdminBadge>
                <span className="text-[11px] text-muted-foreground ml-auto">
                  {format(new Date(selected.created_at), 'PP p')}
                </span>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Title</p>
                <p className="font-semibold text-foreground">{selected.title}</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Message</p>
                <p className="whitespace-pre-wrap break-words">{selected.message}</p>
              </div>

              {selected.username && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">User</p>
                  <button
                    onClick={() => { if (selected.user_id) navigate(`/seller/${selected.user_id}`); }}
                    className="text-primary underline underline-offset-2"
                  >
                    {selected.username.startsWith('@') ? selected.username : `@${selected.username}`}
                  </button>
                </div>
              )}

              {selected.route && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Route</p>
                  <p className="break-all">{selected.route}</p>
                </div>
              )}

              {selected.stack && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Stack</p>
                  <pre className="rounded-lg bg-muted p-2 text-[11px] leading-relaxed overflow-x-auto max-h-64 whitespace-pre-wrap break-words">{selected.stack}</pre>
                </div>
              )}

              {selected.device && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Device</p>
                  <pre className="rounded-lg bg-muted p-2 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-words">
{JSON.stringify(selected.device, null, 2)}
                  </pre>
                </div>
              )}

              {selected.context && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">Context</p>
                  <pre className="rounded-lg bg-muted p-2 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-words">
{JSON.stringify(selected.context, null, 2)}
                  </pre>
                  <ContextActions ctx={selected.context} onNavigate={(to) => { setSelected(null); navigate(to); }} />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={() => {
                    const payload = JSON.stringify(selected, null, 2);
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
                      await deleteRow(selected.id);
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
          )}
        </DrawerContent>
      </Drawer>
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
  if (ctx.order_id) links.push({ label: `Order ${String(ctx.order_id).slice(0, 8)}`, to: `/orders/${ctx.order_id}` });
  if (ctx.listing_id) links.push({ label: `Listing ${String(ctx.listing_id).slice(0, 8)}`, to: `/listing/${ctx.listing_id}` });
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
