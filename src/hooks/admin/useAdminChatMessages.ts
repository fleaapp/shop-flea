import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/types/admin/chat';
import { useToast } from '@/hooks/use-toast';

export function useAdminChatMessages(threadId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const fetchMessages = useCallback(async () => {
    if (!threadId) { setMessages([]); return; }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).from('chat_messages').select('*')
        .eq('thread_id', threadId).order('created_at', { ascending: true });
      if (error) throw error;
      setMessages((data || []) as ChatMessage[]);
      await (supabase as any).from('chat_messages').update({ read: true })
        .eq('thread_id', threadId).eq('sender_type', 'user').eq('read', false);
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to fetch messages', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [threadId, toast]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    if (!threadId) return;
    const channel = supabase.channel(`admin-messages-${threadId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((prev) => [...prev, m]);
          if (m.sender_type === 'user') {
            (supabase as any).from('chat_messages').update({ read: true }).eq('id', m.id);
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId]);

  const sendMessage = async (message: string, attachmentUrl?: string) => {
    if (!threadId) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast({ title: 'Error', description: 'Not signed in', variant: 'destructive' }); return; }
      const { error } = await (supabase as any).from('chat_messages').insert({
        thread_id: threadId, sender_id: user.id, sender_type: 'support',
        message, attachment_url: attachmentUrl || null, read: false,
      });
      if (error) throw error;
      await (supabase as any).from('chat_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId);
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } finally { setSending(false); }
  };

  return { messages, loading, sending, sendMessage, refetch: fetchMessages };
}
