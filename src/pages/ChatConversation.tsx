import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/utils/imageCompression';
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

  // Mark non-user messages as read when opening conversation.
  // Uses a SECURITY DEFINER RPC because support replies are sometimes stored
  // with sender_id = the thread owner (admin acting inside the same account),
  // which the direct-UPDATE RLS policy blocks.
  useEffect(() => {
    if (!threadId || !user?.id) return;
    const previous = queryClient.getQueryData<any>(['unread-support', user.id]);
    const threadUnread = Array.isArray(previous?.perThread)
      ? Number(previous.perThread.find((item: any) => item.threadId === threadId)?.count || 0)
      : 0;
    queryClient.setQueryData<any>(['unread-support', user.id], (prev: any) => {
      if (!prev) return prev;
      const perThread = Array.isArray(prev.perThread)
        ? prev.perThread.filter((item: any) => item.threadId !== threadId)
        : [];
      return { ...prev, total: Math.max(0, Number(prev.total || 0) - threadUnread), perThread };
    });
    queryClient.setQueryData<any>(['nav-badges', user.id], (prev: any) => {
      if (!prev) return prev;
      return { ...prev, unread_support: Math.max(0, Number(prev.unread_support || 0) - threadUnread) };
    });

    let clearedNotifications = 0;
    queryClient.setQueryData<any[]>(['notifications', user.id], (prev) => {
      if (!Array.isArray(prev)) return prev;
      const next = prev.map((notification: any) => {
        if (!notification?.is_read && notification?.type === 'support_message' && notification?.related_thread_id === threadId) {
          clearedNotifications += 1;
          return { ...notification, is_read: true };
        }
        return notification;
      });
      return clearedNotifications > 0 ? next : prev;
    });
    if (clearedNotifications > 0) {
      queryClient.setQueryData<any>(['nav-badges', user.id], (prev: any) => {
        if (!prev) return prev;
        return { ...prev, activity_unread: Math.max(0, Number(prev.activity_unread || 0) - clearedNotifications) };
      });
    }

    const markRead = async () => {
      try {
        await (supabase as any).rpc('mark_support_thread_read', { _thread_id: threadId });
      } catch (err) {
        console.warn('[ChatConversation] mark_support_thread_read failed:', err);
      }
      queryClient.invalidateQueries({ queryKey: ['unread-support'] });
      queryClient.invalidateQueries({ queryKey: ['nav-badges'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };
    markRead();
  }, [threadId, user?.id, queryClient]);


  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
  };

  const fetchData = async () => {
    if (!threadId || !user) return;
    const [threadRes, msgRes] = await Promise.all([
      (supabase as any).from('chat_threads').select('*').eq('id', threadId).maybeSingle(),
      (supabase as any).from('chat_messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true }),
    ]);
    if (threadRes.data) setThread(threadRes.data);
    if (msgRes.data) setMessages(msgRes.data);
    scrollToBottom();
  };

  // Fetch thread & messages
  useEffect(() => {
    fetchData();
  }, [threadId, user]);

  // Refetch when app returns from background (e.g. push notification tap)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
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

    const messageText = newMsg.trim();
    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      thread_id: threadId,
      sender_id: user.id,
      sender_type: 'user',
      message: messageText || (file ? `Sent an attachment` : ''),
      attachment_url: null,
      read: false,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMsg('');
    scrollToBottom();

    try {
      let attachmentUrl: string | null = null;
      if (file) {
        const upload = file.type.startsWith('image/') ? await compressImage(file).catch(() => file) : file;
        const filePath = `${user.id}/support/${Date.now()}_${upload.name}`;
        const { error: upErr } = await supabase.storage.from('listings').upload(filePath, upload);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('listings').getPublicUrl(filePath);
        attachmentUrl = urlData.publicUrl;
        setMessages((prev) => prev.map((msg) => (
          msg.id === optimisticId ? { ...msg, attachment_url: attachmentUrl } : msg
        )));
      }

      const { data: inserted, error: insertError } = await (supabase as any).from('chat_messages').insert({
        thread_id: threadId,
        sender_id: user.id,
        sender_type: 'user',
        message: messageText || (file ? `Sent an attachment` : ''),
        attachment_url: attachmentUrl,
        read: false,
      }).select().single();

      if (insertError) throw insertError;

      if (inserted) {
        setMessages((prev) => prev.map((msg) => (
          msg.id === optimisticId ? inserted as Message : msg
        )));
      }

      await (supabase as any)
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', threadId);

      setFile(null);
    } catch (err: any) {
      setMessages((prev) => prev.filter((msg) => msg.id !== optimisticId));
      setNewMsg(messageText);
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const isResolved = thread?.status === 'resolved';

  return (
    <div className="native-safe-top fixed inset-0 flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background px-4 py-4 flex items-center border-b border-border">
        <button aria-label="Back" onClick={() => navigate('/contact-support')} className="text-foreground absolute left-4 z-10">
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
      <div className="native-keyboard-lift sticky bottom-0 bg-background border-t border-border px-4 pt-3 pb-8">
        {isResolved ? (
          <p className="text-center text-sm text-muted-foreground py-2">This conversation is resolved.</p>
        ) : (
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button onClick={() => fileRef.current?.click()} className="text-muted-foreground">📎</button>
            <div className="flex-1 relative">
              {file && (
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  📎 {file.name}
                  <button onClick={() => setFile(null)} className="text-destructive ml-1">✕</button>
                </div>
              )}
              <textarea
                value={newMsg}
                onChange={(e) => {
                  setNewMsg(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Type a message..."
                className="w-full rounded-2xl bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none card-shadow resize-none min-h-[48px] max-h-[120px]"
                rows={2}
              />
            </div>
            <button aria-label="Send message"
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
