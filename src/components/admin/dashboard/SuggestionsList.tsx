import { useState } from 'react';
import { Suggestion } from '@/hooks/admin/useAdminSuggestions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Mailbox, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  suggestions: Suggestion[];
  loading: boolean;
  onMarkAsRead: (id: string) => void;
}

const TRUNC = 120;
const initials = (u: string) => u.split(/[\s_@]/).filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase();

export function SuggestionsList({ suggestions, loading, onMarkAsRead }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (s: Suggestion) => {
    if (openId === s.id) setOpenId(null);
    else { setOpenId(s.id); if (!s.read) onMarkAsRead(s.id); }
  };

  if (loading) {
    return <div className="space-y-3 p-6">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-6">
        <Mailbox className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">User Suggestions</h2>
        <span className="text-sm text-muted-foreground">({suggestions.length})</span>
      </div>

      {suggestions.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Mailbox className="h-8 w-8" /><p>No suggestions yet</p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-2 p-4">
            {suggestions.map((s) => {
              const long = s.content.length > TRUNC;
              const open = openId === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => toggle(s)}
                  className={cn(
                    'w-full rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent/50',
                    !s.read && 'border-primary/30 bg-primary/5',
                    open && 'bg-accent/30'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={s.profile?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-xs text-primary">{initials(s.profile?.username || 'U')}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{s.profile?.username || 'Unknown'}</span>
                          {!s.read && <Badge variant="default" className="h-4 px-1.5 text-[10px]">New</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">{format(new Date(s.created_at), 'PP')}</span>
                      </div>
                    </div>
                    {long && (
                      <span className="shrink-0 text-muted-foreground">
                        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-foreground/80">
                    {long && !open ? s.content.slice(0, TRUNC) + '…' : s.content}
                  </p>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
