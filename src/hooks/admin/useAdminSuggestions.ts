import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
    try {
      const { data, error } = await (supabase as any).from('suggestions').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const enriched = await Promise.all(
        (data || []).map(async (s: any) => {
          const { data: profile } = await (supabase as any).from('profiles')
            .select('username, avatar_url').eq('user_id', s.user_id).maybeSingle();
          return { ...s, profile: profile || { username: 'Unknown', avatar_url: null } } as Suggestion;
        })
      );
      setSuggestions(enriched);
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to fetch suggestions', variant: 'destructive' });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  useEffect(() => {
    const channel = supabase.channel('admin-suggestions-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suggestions' }, () => fetchSuggestions())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchSuggestions]);

  const unreadCount = suggestions.filter((s) => !s.read).length;

  const markAsRead = async (id: string) => {
    try {
      const { error } = await (supabase as any).from('suggestions').update({ read: true }).eq('id', id);
      if (error) throw error;
      setSuggestions((p) => p.map((s) => s.id === id ? { ...s, read: true } : s));
    } catch (e) { console.error(e); }
  };

  return { suggestions, loading, unreadCount, markAsRead };
}
