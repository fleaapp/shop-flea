import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface ThreadUnread {
  threadId: string;
  count: number;
}

export const useUnreadSupport = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['unread-support', user?.id],
    queryFn: async () => {
      if (!user?.id) return { total: 0, perThread: [] as ThreadUnread[] };

      // Get all user's threads
      const { data: threads, error: threadsError } = await (supabase as any)
        .from('chat_threads')
        .select('id')
        .eq('user_id', user.id);

      if (!threads || threads.length === 0) return { total: 0, perThread: [] as ThreadUnread[] };

      const threadIds = threads.map((t: any) => t.id);

      // Get unread messages (not from user, not read)
      const { data: messages } = await (supabase as any)
        .from('chat_messages')
        .select('id, thread_id')
        .in('thread_id', threadIds)
        .neq('sender_type', 'user')
        .eq('read', false);

      if (!messages || messages.length === 0) return { total: 0, perThread: [] as ThreadUnread[] };

      const perThread: ThreadUnread[] = [];
      const countMap: Record<string, number> = {};
      for (const msg of messages) {
        countMap[msg.thread_id] = (countMap[msg.thread_id] || 0) + 1;
      }
      for (const [threadId, count] of Object.entries(countMap)) {
        perThread.push({ threadId, count });
      }

      return { total: messages.length, perThread };
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const total = data?.total || 0;
  const perThread = data?.perThread || [];

  const getThreadUnread = (threadId: string) => {
    return perThread.find(t => t.threadId === threadId)?.count || 0;
  };

  return { total, perThread, getThreadUnread, isLoading };
};
