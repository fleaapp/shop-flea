import { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';

interface Props {
  onSend: (message: string, attachmentUrl?: string) => void;
  sending: boolean;
  disabled?: boolean;
}

export function MessageInput({ onSend, sending, disabled }: Props) {
  const [message, setMessage] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const t = message.trim();
    if (!t || sending) return;
    onSend(t);
    setMessage('');
    ref.current?.focus();
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="border-t border-border bg-card p-4">
      <div className="flex gap-2">
        <Textarea
          ref={ref}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
          className="min-h-[60px] max-h-[120px] resize-none"
          disabled={disabled || sending}
        />
        <Button onClick={handleSend} disabled={!message.trim() || sending || disabled} className="h-10 w-10 p-0">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Press Enter to send, Shift+Enter for new line</p>
    </div>
  );
}
