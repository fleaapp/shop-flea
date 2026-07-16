import { ChatThread, ThreadFilter } from '@/types/admin/chat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { AdminBadge, toneForStatus, statusLabel } from '@/components/admin/shell/AdminBadge';
import { AdminChipFilter } from '@/components/admin/shell/AdminChipFilter';
import { AdminEmptyState } from '@/components/admin/shell/AdminEmptyState';

interface ThreadListProps {
  threads: ChatThread[];
  loading: boolean;
  selectedThreadId: string | null;
  onSelectThread: (thread: ChatThread) => void;
  filter: ThreadFilter;
  onFilterChange: (filter: ThreadFilter) => void;
}

const initials = (u: string) => u.replace('@', '').slice(0, 2).toUpperCase();

export function ThreadList({ threads, loading, selectedThreadId, onSelectThread, filter, onFilterChange }: ThreadListProps) {
  const options = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active', emoji: '💬' },
    { key: 'resolved', label: 'Resolved', emoji: '✅' },
  ];

  return (
    <div className="flex h-full flex-col bg-background">
      <AdminChipFilter options={options as any} value={filter} onChange={(v) => onFilterChange(v as ThreadFilter)} />

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
          </div>
        ) : threads.length === 0 ? (
          <AdminEmptyState emoji="💬" title="No support chats" description="Conversations from users will appear here." />
        ) : (
          <div className="space-y-2 px-4 py-2">
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => onSelectThread(thread)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl bg-card p-3 text-left card-shadow transition-transform active:scale-[0.99]',
                  selectedThreadId === thread.id && 'ring-2 ring-primary/40'
                )}
              >
                <div className="relative shrink-0">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={thread.user_profile?.avatar_url || undefined} />
                    <AvatarFallback>{initials(thread.user_profile?.username || 'U')}</AvatarFallback>
                  </Avatar>
                  {(thread.unread_count || 0) > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {thread.unread_count}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{thread.user_profile?.username || 'Unknown'}</span>
                    <AdminBadge tone={toneForStatus(thread.status)}>{statusLabel(thread.status)}</AdminBadge>
                  </div>
                  <p className="mt-0.5 truncate text-xs font-medium text-foreground/80">{thread.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {thread.last_message?.message || thread.description || 'No messages yet.'}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {thread.last_message
                      ? formatDistanceToNow(new Date(thread.last_message.created_at), { addSuffix: true })
                      : formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
