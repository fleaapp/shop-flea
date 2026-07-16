import { useState } from 'react';
import { Suggestion } from '@/hooks/admin/useAdminSuggestions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AdminBadge } from '@/components/admin/shell/AdminBadge';
import { AdminEmptyState } from '@/components/admin/shell/AdminEmptyState';

interface Props {
  suggestions: Suggestion[];
  loading: boolean;
  onMarkAsRead: (id: string) => void;
}

const TRUNC = 120;
const initials = (u: string) => u.replace('@', '').slice(0, 2).toUpperCase();

export function SuggestionsList({ suggestions, loading, onMarkAsRead }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (s: Suggestion) => {
    if (openId === s.id) setOpenId(null);
    else { setOpenId(s.id); if (!s.read) onMarkAsRead(s.id); }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
        ) : suggestions.length === 0 ? (
          <AdminEmptyState emoji="💡" title="No suggestions yet" description="Ideas from the community will land here." />
        ) : (
          <div className="space-y-2 px-4 py-2">
            {suggestions.map((s) => {
              const long = s.content.length > TRUNC;
              const open = openId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => toggle(s)}
                  className={cn(
                    'w-full rounded-2xl bg-card p-3 text-left card-shadow transition-transform active:scale-[0.99]',
                    !s.read && 'ring-2 ring-primary/40'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={s.profile?.avatar_url || undefined} />
                        <AvatarFallback>{initials(s.profile?.username || 'U')}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">{s.profile?.username || 'Unknown'}</span>
                          {!s.read && <AdminBadge tone="success">New</AdminBadge>}
                        </div>
                        <span className="text-[11px] text-muted-foreground">{format(new Date(s.created_at), 'PP')}</span>
                      </div>
                    </div>
                    {long && (
                      <span className="shrink-0 text-muted-foreground">
                        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/80">
                    {long && !open ? s.content.slice(0, TRUNC) + '…' : s.content}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
