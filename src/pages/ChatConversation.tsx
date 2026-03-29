import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import ChatBubble from '@/components/ChatBubble';
import { useQueryClient } from '@tanstack/react-query';

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  attachment_url: string | null;
  read: boolean;
  created_at: string;
}

interface Thread {
  id: string;
  title: string;
  status: string;
}

const ChatConversation = () => {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [thread, setThread] = useState<Thread | null>(null);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Mark non-user messages as read when opening conversation
  useEffect(() => {
    if (!threadId || !user) return;
    const markRead = async () => {
      await (supabase as any)
        .from('chat_messages')
        .update({ read: true })
        .eq('thread_id', threadId)
        .neq('sender_type', 'user')
        .eq('read', false);
      queryClient.invalidateQueries({ queryKey: ['unread-support'] });
    };
    markRead();
  }, [threadId, user, queryClient]);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
  };

  // Fetch thread & messages
  useEffect(() => {
    if (!threadId || !user) return;

    const fetchData = async () => {
      const [threadRes, msgRes] = await Promise.all([
        (supabase as any).from('chat_threads').select('*').eq('id', threadId).maybeSingle(),
        (supabase as any).from('chat_messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true }),
      ]);
      if (threadRes.data) setThread(threadRes.data);
      if (msgRes.data) setMessages(msgRes.data);
      scrollToBottom();
    };
    fetchData();
  }, [threadId, user]);

  // Real-time subscriptions
  useEffect(() => {
    if (!threadId) return;

    const msgChannel = supabase
      .channel(`thread-messages-${threadId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `thread_id=eq.${threadId}`,
      }, (payload: any) => {
        setMessages((prev) => {
          if (prev.find((m) => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
        scrollToBottom();
      })
      .subscribe();

    const statusChannel = supabase
      .channel(`thread-status-${threadId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_threads',
        filter: `id=eq.${threadId}`,
      }, (payload: any) => {
        setThread((prev) => prev ? { ...prev, ...payload.new } : prev);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(statusChannel);
    };
  }, [threadId]);

  const handleSend = async () => {
    if (!user || !threadId || (!newMsg.trim() && !file)) return;
    setSending(true);

    try {
      let attachmentUrl: string | null = null;
      if (file) {
        const filePath = `${user.id}/support/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage.from('listings').upload(filePath, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('listings').getPublicUrl(filePath);
        attachmentUrl = urlData.publicUrl;
      }

      await (supabase as any).from('chat_messages').insert({
        thread_id: threadId,
        sender_id: user.id,
        sender_type: 'user',
        message: newMsg.trim() || (file ? `Sent an attachment` : ''),
        attachment_url: attachmentUrl,
        read: false,
      });

      await (supabase as any)
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);

      setNewMsg('');
      setFile(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const isResolved = thread?.status === 'resolved';

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background px-4 py-4 flex items-center border-b border-border">
        <button onClick={() => navigate('/contact-support')} className="text-foreground absolute left-4 z-10">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-base font-bold text-foreground truncate px-10">{thread?.title || 'Chat'}</h1>
          {thread && (
            <span className={`text-xs font-medium ${isResolved ? 'text-muted-foreground' : 'text-price-green'}`}>
              {isResolved ? 'Resolved' : 'Active'}
            </span>
          )}
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground mt-8">No messages yet.</p>
        ) : (
          messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg.message}
              senderType={msg.sender_type as 'user' | 'support'}
              createdAt={msg.created_at}
              attachmentUrl={msg.attachment_url}
            />
          ))
        )}
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-background border-t border-border px-4 pt-3 pb-8">
        {isResolved ? (
          <p className="text-center text-sm text-muted-foreground py-2">This conversation is resolved.</p>
        ) : (
          <div className="flex items-end gap-2">
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button onClick={() => fileRef.current?.click()} className="text-muted-foreground pb-2.5">📎</button>
            <div className="flex-1 relative">
              {file && (
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  📎 {file.name}
                  <button onClick={() => setFile(null)} className="text-destructive ml-1">✕</button>
                </div>
              )}
              <input
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Type a message..."
                className="w-full rounded-full bg-card px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none card-shadow"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={sending || (!newMsg.trim() && !file)}
              className="rounded-full bg-charcoal p-2.5 text-card disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatConversation;
