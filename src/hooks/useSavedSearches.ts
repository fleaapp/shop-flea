import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface SavedSearch {
  id: string;
  query: string;
  filters: Record<string, any>;
  region_id: string | null;
  created_at: string;
}

export const useSavedSearches = () => {
  const { user, profile } = useAuth();
  const [saved, setSaved] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSaved = useCallback(async () => {
    if (!user) {
      setSaved([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('saved_searches' as any)
      .select('id, query, filters, region_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setSaved(data as any);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSaved();
  }, [fetchSaved]);

  const saveSearch = useCallback(
    async (query: string, filters: Record<string, any> = {}) => {
      if (!user) {
        toast.error('Sign in to save searches.');
        return false;
      }
      const trimmed = query.trim();
      if (!trimmed) return false;

      const { error } = await supabase.from('saved_searches' as any).insert({
        user_id: user.id,
        query: trimmed,
        filters,
        region_id: profile?.region_id ?? null,
      });

      if (error) {
        if ((error as any).code === '23505') {
          toast('You already saved this search.');
        } else {
          toast.error('Could not save search.');
        }
        return false;
      }
      toast.success('💾 Search saved. We\'ll alert you on new matches.');
      await fetchSaved();
      return true;
    },
    [user, profile?.region_id, fetchSaved]
  );

  const removeSaved = useCallback(
    async (id: string) => {
      if (!user) return;
      const prev = saved;
      setSaved((s) => s.filter((x) => x.id !== id));
      const { error } = await supabase.from('saved_searches' as any).delete().eq('id', id);
      if (error) {
        setSaved(prev);
        toast.error('Could not remove saved search.');
      }
    },
    [user, saved]
  );

  const isSaved = useCallback(
    (query: string) =>
      saved.some((s) => s.query.toLowerCase() === query.trim().toLowerCase()),
    [saved]
  );

  return { saved, loading, saveSearch, removeSaved, isSaved, refetch: fetchSaved };
};
