import { useCallback, useEffect, useState } from 'react';
import { callAdminData } from './useAdminData';

export type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  message: string;
  ip_address: string | null;
  user_agent: string | null;
  notified_at: string | null;
  created_at: string;
};

export function useAdminContactSubmissions() {
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await callAdminData<{ submissions: ContactSubmission[] }>('listContactSubmissions');
      setSubmissions(res.submissions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load contact submissions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { submissions, loading, error, refresh };
}
