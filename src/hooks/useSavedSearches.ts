import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { toast } from 'sonner';

export interface SavedSearch {
  id: string;
  query: string;
  filters: Record<string, any>;
  region_id: string | null;
  created_at: string;
}

const normalizeFilters = (filters: Record<string, any> = {}) =>
  Object.fromEntries(
    Object.entries(filters).filter(([, value]) => {
      if (value === null || value === undefined || value === '') return false;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    })
  );

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const savedSearchKey = (query: string, filters: Record<string, any> = {}, regionId: string | null = null) =>
  `${query.trim().toLowerCase()}|${stableStringify(normalizeFilters(filters))}|${regionId ?? ''}`;

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
    const { data, error } = await invokeCloudFunction('saved-searches', { method: 'GET' });
    if (!error && data) {
      setSaved(((data as any).saved || []) as SavedSearch[]);
    }
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
      const cleanedFilters = normalizeFilters(filters);
      if (!trimmed && Object.keys(cleanedFilters).length === 0) return false;

      const { error } = await invokeCloudFunction('saved-searches', {
        body: {
          query: trimmed,
          filters: cleanedFilters,
          region_id: profile?.region_id ?? null,
        },
      });

      if (error) {
        if ((error as any).context?.status === 409 || /already saved/i.test((error as any).message ?? '')) {
          toast('You already saved this search.');
        } else {
          toast.error('Could not save this search.');
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
      const { error } = await invokeCloudFunction('saved-searches', {
        method: 'DELETE',
        query: { id },
      });
      if (error) {
        setSaved(prev);
        toast.error('Could not remove saved search.');
      }
    },
    [user, saved]
  );

  const isSaved = useCallback(
    (query: string, filters: Record<string, any> = {}) => {
      const key = savedSearchKey(query, filters, profile?.region_id ?? null);
      return saved.some((s) => savedSearchKey(s.query, s.filters || {}, s.region_id) === key);
    },
    [saved, profile?.region_id]
  );

  return { saved, loading, saveSearch, removeSaved, isSaved, refetch: fetchSaved };
};
