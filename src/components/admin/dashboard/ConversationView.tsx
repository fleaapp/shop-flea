import { useEffect, useRef } from 'react';
import { ChatThread, ChatMessage } from '@/types/admin/chat';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { MessageSquare, CheckCircle2, RotateCcw, Copy, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  thread: ChatThread | null;
  messages: ChatMessage[];
  loading: boolean;
  sending: boolean;
  onSendMessage: (message: string) => void;
  onUpdateStatus: (threadId: string, status: 'active' | 'resolved') => void;
  onBack?: () => void;
}

const initials = (u: string) => u.split(/[\s_@]/).filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase();

export function ConversationView({ thread, messages, loading, sending, onSendMessage, onUpdateStatus, onBack }: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const copyId = () => {
    if (thread?.user_id) {
      navigator.clipboard.writeText(thread.user_id);
      toast({ title: 'Copied', description: 'User ID copied to clipboard' });
    }
  };

  if (!thread) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background text-muted-foreground">
        <MessageSquare className="mb-4 h-16 w-16 opacity-30" />
        <h3 className="text-lg font-medium">No conversation selected</h3>
        <p className="text-sm">Select a chat from the list to view messages</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-4">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Avatar className="h-9 w-9 sm:h-12 sm:w-12">
            <AvatarImage src={thread.user_profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">{initials(thread.user_profile?.username || 'U')}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-foreground">{thread.user_profile?.username || 'Unknown User'}</h2>
              <Badge variant="secondary" className={cn(
                'text-xs',
                thread.status === 'active' ? 'bg-status-active text-status-active-foreground' : 'bg-status-resolved text-status-resolved-foreground'
              )}>{thread.status}</Badge>
            </div>
            <p className="text-sm font-medium text-foreground/80">{thread.title}</p>
            <div className="mt-1 hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <span>ID: {thread.user_id.slice(0, 8)}...</span>
              <button onClick={copyId} className="rounded p-0.5 hover:bg-accent" title="Copy User ID">
                <Copy className="h-3 w-3" />
              </button>
              <span>•</span>
              <span>Started {format(new Date(thread.created_at), 'MMM d, yyyy')}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {thread.status === 'active' ? (
            <Button variant="outline" size="sm" onClick={() => onUpdateStatus(thread.id, 'resolved')} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span className="hidden sm:inline">Mark Resolved</span>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => onUpdateStatus(thread.id, 'active')} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Reopen</span>
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 px-6 py-4">
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
                <Skeleton className="h-16 w-64 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-muted-foreground">
            <MessageSquare className="mb-2 h-8 w-8 opacity-50" />
            <p>No messages yet</p>
            {thread.description && (
              <p className="mt-2 text-center text-sm">
                <span className="font-medium">Initial description:</span><br />{thread.description}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {thread.description && (
              <div className="mb-4 rounded-lg bg-accent/50 p-3 text-sm">
                <p className="mb-1 font-medium text-muted-foreground">Initial Description:</p>
                <p className="text-foreground">{thread.description}</p>
              </div>
            )}
            {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
            <div ref={endRef} />
          </div>
        )}
      </ScrollArea>

      <MessageInput onSend={onSendMessage} sending={sending} disabled={thread.status === 'resolved'} />
      {thread.status === 'resolved' && (
        <div className="bg-muted px-6 py-2 text-center text-sm text-muted-foreground">
          This conversation is resolved. Reopen to send messages.
        </div>
      )}
    </div>
  );
}
