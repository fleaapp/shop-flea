import { useState } from 'react';
import { Report, ReportFilter } from '@/types/admin/reports';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { User, MessageSquare, ShoppingBag, Flag } from 'lucide-react';
import { AdminBadge, toneForStatus, statusLabel } from '@/components/admin/shell/AdminBadge';
import { AdminChipFilter } from '@/components/admin/shell/AdminChipFilter';
import { AdminEmptyState } from '@/components/admin/shell/AdminEmptyState';

type Tab = 'all' | 'listing' | 'comment' | 'user';

interface Props {
  reports: Report[];
  loading: boolean;
  filter: ReportFilter;
  onFilterChange: (filter: ReportFilter) => void;
  selectedReportId: string | null;
  onSelectReport: (report: Report) => void;
  pendingCount: number;
  reportTallyByUser: Record<string, number>;
}

const icons = { listing: ShoppingBag, comment: MessageSquare, user: User };
const initials = (u: string) => u.replace('@', '').slice(0, 2).toUpperCase();

export function ReportList({ reports, loading, filter, onFilterChange, selectedReportId, onSelectReport, pendingCount, reportTallyByUser }: Props) {
  const [tab, setTab] = useState<Tab>('all');
  const filtered = tab === 'all' ? reports : reports.filter((r) => r.report_type === tab);

  const statusOptions = [
    { key: 'all', label: 'All', count: reports.length },
    { key: 'pending', label: 'Pending', emoji: '⏳', count: pendingCount },
    { key: 'accepted', label: 'Accepted', emoji: '🚩' },
    { key: 'rejected', label: 'Rejected', emoji: '✖️' },
  ];

  const typeOptions = [
    { key: 'all', label: 'All types' },
    { key: 'listing', label: 'Listings', emoji: '📦' },
    { key: 'comment', label: 'Comments', emoji: '💬' },
    { key: 'user', label: 'Users', emoji: '👤' },
  ];

  return (
    <div className="flex h-full flex-col bg-background">
      <AdminChipFilter options={statusOptions as any} value={filter} onChange={(v) => onFilterChange(v as ReportFilter)} />
      <AdminChipFilter options={typeOptions as any} value={tab} onChange={(v) => setTab(v as Tab)} />

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
        ) : filtered.length === 0 ? (
          <AdminEmptyState emoji="🚩" title={`No ${tab === 'all' ? '' : tab + ' '}reports`} description="Reports raised by users will land here." />
        ) : (
          <div className="space-y-2 px-4 py-2">
            {filtered.map((r) => {
              const TypeIcon = icons[r.report_type];
              const tally = reportTallyByUser[r.reported_user_id] || 0;
              return (
                <button
                  key={r.id}
                  onClick={() => onSelectReport(r)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-2xl bg-card p-3 text-left card-shadow transition-transform active:scale-[0.99]',
                    selectedReportId === r.id && 'ring-2 ring-primary/40'
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={r.reported_user_profile?.avatar_url || undefined} />
                      <AvatarFallback>{initials(r.reported_user_profile?.username || 'U')}</AvatarFallback>
                    </Avatar>
                    {tally > 1 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                        {tally}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <TypeIcon className="h-3.5 w-3.5" />
                        <span className="capitalize">{r.report_type}</span>
                      </div>
                      <AdminBadge tone={toneForStatus(r.status)}>{statusLabel(r.status)}</AdminBadge>
                    </div>
                    <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
                      {r.reported_user_profile?.username || 'Unknown'}{' '}
                      <span className="font-normal text-muted-foreground">reported by</span>{' '}
                      {r.reporter_user_profile?.username || 'Unknown'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.reason || 'No reason provided.'}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!loading && pendingCount === 0 && filtered.length === 0 && tab === 'all' && (
        <div className="mx-4 mb-4 flex items-center gap-2 rounded-2xl bg-primary/10 p-3 text-sm text-foreground">
          <Flag className="h-4 w-4 text-primary" /> All caught up.
        </div>
      )}
    </div>
  );
}
