import { useCallback, useEffect, useState } from 'react';
import { callAdminData } from './useAdminData';

export type WaitlistEntry = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  country_code: string;
  region_id: string | null;
  created_at: string;
  notified_at: string | null;
};

export function useAdminWaitlist() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await callAdminData<{ entries: WaitlistEntry[] }>('listWaitlist');
      setEntries(res.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load waitlist');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entries, loading, error, refresh };
}
