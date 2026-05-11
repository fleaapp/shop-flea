import { useState, useEffect, useCallback } from 'react';
import { ChatMessage } from '@/types/admin/chat';
import { useToast } from '@/hooks/use-toast';
import { callAdminData } from './useAdminData';

export function useAdminChatMessages(threadId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const fetchMessages = useCallback(async () => {
    if (!threadId) { setMessages([]); return; }
    setLoading(true);
    try {
      const data = await callAdminData<{ messages: ChatMessage[] }>('getThreadMessages', { threadId });
      setMessages(data.messages || []);
    } catch (e) {
      console.error('admin messages fetch failed', e);
      toast({ title: 'Error', description: 'Failed to fetch messages', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [threadId, toast]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const sendMessage = async (message: string, attachmentUrl?: string) => {
    if (!threadId) return;
    setSending(true);
    try {
      const data = await callAdminData<{ message?: ChatMessage }>('sendSupportMessage', {
        threadId,
        message,
        attachmentUrl: attachmentUrl || null,
      });
      if (data.message) setMessages((prev) => [...prev, data.message as ChatMessage]);
      else fetchMessages();
    } catch (e) {
      console.error('admin message send failed', e);
      toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' });
    } finally { setSending(false); }
  };

  return { messages, loading, sending, sendMessage, refetch: fetchMessages };
}
