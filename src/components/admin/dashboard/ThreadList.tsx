import { ChatThread, ThreadFilter } from '@/types/admin/chat';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { MessageCircle, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ThreadListProps {
  threads: ChatThread[];
  loading: boolean;
  selectedThreadId: string | null;
  onSelectThread: (thread: ChatThread) => void;
  filter: ThreadFilter;
  onFilterChange: (filter: ThreadFilter) => void;
}

const initials = (u: string) => u.split(/[\s_@]/).filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase();

export function ThreadList({ threads, loading, selectedThreadId, onSelectThread, filter, onFilterChange }: ThreadListProps) {
  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Support Chats</h2>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={(v) => onFilterChange(v as ThreadFilter)}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
        ) : threads.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">No conversations found</div>
        ) : (
          <div className="p-2">
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => onSelectThread(thread)}
                className={cn(
                  'flex w-full gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent',
                  selectedThreadId === thread.id && 'bg-accent'
                )}
              >
                <div className="relative">
                  <Avatar>
                    <AvatarImage src={thread.user_profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {initials(thread.user_profile?.username || 'U')}
                    </AvatarFallback>
                  </Avatar>
                  {(thread.unread_count || 0) > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-unread text-xs font-medium text-white">
                      {thread.unread_count}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate font-medium text-foreground">{thread.user_profile?.username || 'Unknown User'}</span>
                    <Badge variant="secondary" className={cn(
                      'shrink-0 text-xs',
                      thread.status === 'active' ? 'bg-status-active text-status-active-foreground' : 'bg-status-resolved text-status-resolved-foreground'
                    )}>{thread.status}</Badge>
                  </div>
                  <p className="truncate text-sm font-medium text-foreground/80">{thread.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{thread.last_message?.message || thread.description || 'No messages yet'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {thread.last_message
                      ? formatDistanceToNow(new Date(thread.last_message.created_at), { addSuffix: true })
                      : formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
