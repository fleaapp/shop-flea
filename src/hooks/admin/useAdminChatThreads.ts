import { useState, useEffect, useCallback } from 'react';
import { ChatThread, ThreadFilter } from '@/types/admin/chat';
import { useToast } from '@/hooks/use-toast';
import { callAdminData } from './useAdminData';

export function useAdminChatThreads() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ThreadFilter>('all');
  const { toast } = useToast();

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminData<{ threads: ChatThread[] }>('listThreads', { filter });
      setThreads(data.threads || []);
    } catch (e) {
      console.error('threads fetch failed', e);
      toast({ title: 'Error', description: 'Failed to fetch chat threads', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  const updateThreadStatus = async (threadId: string, status: 'active' | 'resolved') => {
    try {
      await callAdminData('updateThreadStatus', { threadId, status });
      toast({ title: 'Updated', description: `Thread marked as ${status}` });
      fetchThreads();
    } catch (e) {
      console.error('thread update failed', e);
      toast({ title: 'Error', description: 'Failed to update thread', variant: 'destructive' });
    }
  };

  return { threads, loading, filter, setFilter, updateThreadStatus, refetch: fetchThreads };
}
