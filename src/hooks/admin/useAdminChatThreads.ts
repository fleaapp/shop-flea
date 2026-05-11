import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChatThread, ChatMessage, ThreadFilter } from '@/types/admin/chat';
import { useToast } from '@/hooks/use-toast';

export function useAdminChatThreads() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ThreadFilter>('all');
  const { toast } = useToast();

  const fetchThreads = useCallback(async () => {
    try {
      let query = (supabase as any).from('chat_threads').select('*').order('updated_at', { ascending: false });
      if (filter !== 'all') query = query.eq('status', filter);
      const { data: threadsData, error } = await query;
      if (error) throw error;

      const enriched = await Promise.all(
        (threadsData || []).map(async (thread: any) => {
          const { data: lastMessage } = await supabase
            .from('chat_messages').select('*').eq('thread_id', thread.id)
            .order('created_at', { ascending: false }).limit(1).maybeSingle();
          const { count: unread } = await supabase
            .from('chat_messages').select('*', { count: 'exact', head: true })
            .eq('thread_id', thread.id).eq('sender_type', 'user').eq('read', false);
          const { data: profile } = await supabase
            .from('profiles').select('username, avatar_url').eq('user_id', thread.user_id).maybeSingle();
          return {
            ...thread,
            last_message: lastMessage as ChatMessage | undefined,
            unread_count: unread || 0,
            user_profile: profile || { username: 'Unknown User', avatar_url: null },
          } as ChatThread;
        })
      );
      setThreads(enriched);
    } catch (e) {
      console.error('threads fetch failed', e);
      toast({ title: 'Error', description: 'Failed to fetch chat threads', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  useEffect(() => {
    const channel = supabase.channel('admin-chat-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads' }, () => fetchThreads())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => fetchThreads())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchThreads]);

  const updateThreadStatus = async (threadId: string, status: 'active' | 'resolved') => {
    try {
      const { error } = await (supabase as any).from('chat_threads')
        .update({ status, updated_at: new Date().toISOString() }).eq('id', threadId);
      if (error) throw error;
      toast({ title: 'Updated', description: `Thread marked as ${status}` });
      fetchThreads();
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to update thread', variant: 'destructive' });
    }
  };

  return { threads, loading, filter, setFilter, updateThreadStatus, refetch: fetchThreads };
}
