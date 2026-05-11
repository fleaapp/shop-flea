import { BannedUser, BanFilter } from '@/types/admin/reports';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ShieldBan, Filter, ShieldCheck, ShieldOff } from 'lucide-react';

interface Props {
  bannedUsers: BannedUser[];
  loading: boolean;
  filter: BanFilter;
  onFilterChange: (filter: BanFilter) => void;
  onUpdateBanStatus: (banId: string, status: 'active' | 'lifted') => Promise<void>;
  activeCount: number;
  liftedCount: number;
}

const initials = (u: string) => u.split(/[\s_@]/).filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase();

export function BannedUsersList({ bannedUsers, loading, filter, onFilterChange, onUpdateBanStatus, activeCount, liftedCount }: Props) {
  if (loading) {
    return (
      <div className="space-y-3 p-6">
        {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <ShieldBan className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold">Banned Users</h2>
          <div className="flex gap-2">
            <Badge variant="destructive" className="text-xs">{activeCount} active</Badge>
            <Badge variant="secondary" className="text-xs">{liftedCount} lifted</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={(v) => onFilterChange(v as BanFilter)}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="lifted">Lifted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {bannedUsers.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
          <ShieldCheck className="h-8 w-8" /><p>No banned users found</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-3 p-4 sm:hidden">
            {bannedUsers.map((b) => (
              <div key={b.id} className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={b.user_profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-destructive/10 text-xs text-destructive">{initials(b.user_profile?.username || 'U')}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{b.user_profile?.username || 'Unknown'}</span>
                  </div>
                  <Badge variant="secondary" className={cn('text-xs capitalize', b.status === 'active' ? 'bg-red-500/15 text-red-700 dark:text-red-400' : 'bg-muted text-muted-foreground')}>{b.status}</Badge>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{b.reason}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{format(new Date(b.banned_at), 'PP')}</span>
                  <Button size="sm" variant={b.status === 'active' ? 'outline' : 'destructive'} onClick={() => onUpdateBanStatus(b.id, b.status === 'active' ? 'lifted' : 'active')} className="gap-1 text-xs">
                    {b.status === 'active' ? (<><ShieldCheck className="h-3 w-3" /> Lift</>) : (<><ShieldOff className="h-3 w-3" /> Reinstate</>)}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date Banned</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bannedUsers.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={b.user_profile?.avatar_url || undefined} />
                          <AvatarFallback className="bg-destructive/10 text-xs text-destructive">{initials(b.user_profile?.username || 'U')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{b.user_profile?.username || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{b.user_id.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{b.reason}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(b.banned_at), 'PP')}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn('capitalize', b.status === 'active' ? 'bg-red-500/15 text-red-700 dark:text-red-400' : 'bg-muted text-muted-foreground')}>{b.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant={b.status === 'active' ? 'outline' : 'destructive'} onClick={() => onUpdateBanStatus(b.id, b.status === 'active' ? 'lifted' : 'active')} className="gap-1">
                        {b.status === 'active' ? (<><ShieldCheck className="h-3.5 w-3.5" /> Lift Ban</>) : (<><ShieldOff className="h-3.5 w-3.5" /> Reinstate</>)}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
