import { ChatMessage } from '@/types/admin/chat';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Check, CheckCheck, Paperclip, Download } from 'lucide-react';

interface Props { message: ChatMessage; }

const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);

export function MessageBubble({ message }: Props) {
  const isSupport = message.sender_type === 'support';
  return (
    <div className={cn('flex w-full', isSupport ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[70%] rounded-2xl px-4 py-2.5',
        isSupport ? 'rounded-br-md bg-support-bubble text-support-bubble-foreground' : 'rounded-bl-md bg-user-bubble text-user-bubble-foreground'
      )}>
        {message.attachment_url && (
          <div className="mb-2">
            {isImage(message.attachment_url) ? (
              <a href={message.attachment_url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
                <img src={message.attachment_url} alt="Attachment" className="max-h-60 w-auto object-cover transition-transform hover:scale-105" />
              </a>
            ) : (
              <a href={message.attachment_url} target="_blank" rel="noopener noreferrer" className={cn(
                'flex items-center gap-2 rounded-lg p-2 transition-colors',
                isSupport ? 'bg-white/10 hover:bg-white/20' : 'bg-black/5 hover:bg-black/10'
              )}>
                <Paperclip className="h-4 w-4" />
                <span className="text-sm">View attachment</span>
                <Download className="ml-auto h-4 w-4" />
              </a>
            )}
          </div>
        )}
        <p className="whitespace-pre-wrap break-words text-sm">{message.message}</p>
        <div className={cn('mt-1 flex items-center gap-1 text-xs', isSupport ? 'justify-end opacity-70' : 'opacity-60')}>
          <span>{format(new Date(message.created_at), 'HH:mm')}</span>
          {isSupport && (message.read ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />)}
        </div>
      </div>
    </div>
  );
}
