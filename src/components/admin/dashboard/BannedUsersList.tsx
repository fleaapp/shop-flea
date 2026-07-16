import { BannedUser, BanFilter } from '@/types/admin/reports';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { AdminBadge } from '@/components/admin/shell/AdminBadge';
import { AdminChipFilter } from '@/components/admin/shell/AdminChipFilter';
import { AdminEmptyState } from '@/components/admin/shell/AdminEmptyState';

interface Props {
  bannedUsers: BannedUser[];
  loading: boolean;
  filter: BanFilter;
  onFilterChange: (filter: BanFilter) => void;
  onUpdateBanStatus: (banId: string, status: 'active' | 'lifted') => Promise<void>;
  activeCount: number;
  liftedCount: number;
}

const initials = (u: string) => u.replace('@', '').slice(0, 2).toUpperCase();

export function BannedUsersList({ bannedUsers, loading, filter, onFilterChange, onUpdateBanStatus, activeCount, liftedCount }: Props) {
  const options = [
    { key: 'all', label: 'All', count: activeCount + liftedCount },
    { key: 'active', label: 'Active', emoji: '⛔️', count: activeCount },
    { key: 'lifted', label: 'Lifted', emoji: '✅', count: liftedCount },
  ];

  return (
    <div className="flex h-full flex-col bg-background">
      <AdminChipFilter options={options as any} value={filter} onChange={(v) => onFilterChange(v as BanFilter)} />

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
        ) : bannedUsers.length === 0 ? (
          <AdminEmptyState emoji="✅" title="No banned users" description="All users are in good standing." />
        ) : (
          <div className="space-y-2 px-4 py-2">
            {bannedUsers.map((b) => (
              <div key={b.id} className="flex items-start gap-3 rounded-2xl bg-card p-3 card-shadow">
                <Avatar className="h-11 w-11 shrink-0">
                  <AvatarImage src={b.user_profile?.avatar_url || undefined} />
                  <AvatarFallback>{initials(b.user_profile?.username || 'U')}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{b.user_profile?.username || 'Unknown'}</span>
                    <AdminBadge tone={b.status === 'active' ? 'danger' : 'neutral'}>
                      {b.status === 'active' ? 'Active ban' : 'Lifted'}
                    </AdminBadge>
                  </div>
                  {b.reason && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{b.reason}</p>}
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">Banned {format(new Date(b.banned_at), 'PP')}</span>
                    <Button
                      size="sm"
                      variant={b.status === 'active' ? 'outline' : 'destructive'}
                      onClick={() => onUpdateBanStatus(b.id, b.status === 'active' ? 'lifted' : 'active')}
                      className="h-8 gap-1 rounded-full text-xs"
                    >
                      {b.status === 'active' ? (<><ShieldCheck className="h-3.5 w-3.5" /> Lift ban</>) : (<><ShieldOff className="h-3.5 w-3.5" /> Reinstate</>)}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
