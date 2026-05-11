import { useState } from 'react';
import { Report, ReportFilter } from '@/types/admin/reports';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Flag, Filter, AlertTriangle, User, MessageSquare, ShoppingBag } from 'lucide-react';

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
const initials = (u: string) => u.split(/[\s_@]/).filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase();
const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  accepted: 'bg-red-500/15 text-red-700 dark:text-red-400',
  rejected: 'bg-muted text-muted-foreground',
};

export function ReportList({ reports, loading, filter, onFilterChange, selectedReportId, onSelectReport, pendingCount, reportTallyByUser }: Props) {
  const [tab, setTab] = useState<Tab>('all');
  const filtered = tab === 'all' ? reports : reports.filter((r) => r.report_type === tab);
  const counts = {
    listing: reports.filter((r) => r.report_type === 'listing').length,
    comment: reports.filter((r) => r.report_type === 'comment').length,
    user: reports.filter((r) => r.report_type === 'user').length,
  };

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">Reports</h2>
          {pendingCount > 0 && <Badge variant="destructive" className="text-xs">{pendingCount}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={(v) => onFilterChange(v as ReportFilter)}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex border-b border-border">
        {(['all', 'listing', 'comment', 'user'] as Tab[]).map((t) => {
          const TabIcon = t === 'all' ? Flag : icons[t as keyof typeof icons];
          const count = t === 'all' ? reports.length : counts[t as keyof typeof counts];
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium capitalize transition-colors',
                tab === t ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <TabIcon className="h-3.5 w-3.5" />{t}
              {count > 0 && <span className="text-[10px] text-muted-foreground">({count})</span>}
            </button>
          );
        })}
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="space-y-2 p-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3 rounded-lg p-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-8 w-8" />
            <p>No {tab === 'all' ? '' : tab + ' '}reports found</p>
          </div>
        ) : (
          <div className="p-2">
            {filtered.map((r) => {
              const TypeIcon = icons[r.report_type];
              const tally = reportTallyByUser[r.reported_user_id] || 0;
              return (
                <button
                  key={r.id}
                  onClick={() => onSelectReport(r)}
                  className={cn(
                    'flex w-full gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent',
                    selectedReportId === r.id && 'bg-accent'
                  )}
                >
                  <div className="relative">
                    <Avatar>
                      <AvatarImage src={r.reported_user_profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-destructive/10 text-destructive">
                        {initials(r.reported_user_profile?.username || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    {tally > 1 && (
                      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold text-destructive-foreground">
                        {tally}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs capitalize text-muted-foreground">{r.report_type}</span>
                      </div>
                      <Badge variant="secondary" className={cn('shrink-0 text-xs capitalize', statusColors[r.status])}>{r.status}</Badge>
                    </div>
                    <p className="truncate text-sm font-medium text-foreground">
                      {r.reported_user_profile?.username || 'Unknown'}{' '}
                      <span className="font-normal text-muted-foreground">reported by</span>{' '}
                      {r.reporter_user_profile?.username || 'Unknown'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{r.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
