import { format } from 'date-fns';

interface ChatBubbleProps {
  message: string;
  senderType: 'user' | 'support';
  createdAt: string;
  attachmentUrl?: string | null;
}

const ChatBubble = ({ message, senderType, createdAt, attachmentUrl }: ChatBubbleProps) => {
  const isUser = senderType === 'user';
  const isImage = attachmentUrl && /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(attachmentUrl);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[80%] ${isUser ? 'order-1' : 'order-0'}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm ${
            isUser
              ? 'bg-charcoal text-card rounded-br-md'
              : 'bg-card text-foreground card-shadow rounded-bl-md'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message}</p>
        </div>

        {attachmentUrl && (
          <div className={`mt-1.5 ${isUser ? 'flex justify-end' : ''}`}>
            {isImage ? (
              <img
                src={attachmentUrl}
                alt="Attachment"
                className="max-w-[200px] rounded-xl object-cover cursor-pointer"
                onClick={() => window.open(attachmentUrl, '_blank')}
              />
            ) : (
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline"
              >
                📎 Download attachment
              </a>
            )}
          </div>
        )}

        <p className={`text-[10px] text-muted-foreground mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {format(new Date(createdAt), 'MMM d, h:mm a')}
        </p>
      </div>
    </div>
  );
};

export default ChatBubble;
