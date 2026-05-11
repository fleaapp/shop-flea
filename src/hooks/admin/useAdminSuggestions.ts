import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { callAdminData } from './useAdminData';

export interface Suggestion {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  read: boolean;
  profile?: { username: string; avatar_url: string | null };
}

export function useAdminSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdminData<{ suggestions: Suggestion[] }>('listSuggestions');
      setSuggestions(data.suggestions || []);
    } catch (e) {
      console.error('suggestions fetch failed', e);
      toast({ title: 'Error', description: 'Failed to fetch suggestions', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  const unreadCount = suggestions.filter((s) => !s.read).length;

  const markAsRead = async (id: string) => {
    try {
      await callAdminData('markSuggestionRead', { id });
      setSuggestions((p) => p.map((s) => s.id === id ? { ...s, read: true } : s));
    } catch (e) {
      console.error('mark suggestion read failed', e);
      toast({ title: 'Error', description: 'Failed to update suggestion', variant: 'destructive' });
    }
  };

  return { suggestions, loading, unreadCount, markAsRead, refetch: fetchSuggestions };
}
