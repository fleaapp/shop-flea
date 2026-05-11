import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const CLOUD_FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/admin-data`;
const CLOUD_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export async function callAdminData<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error('No active session.');
  }

  const res = await fetch(CLOUD_FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: CLOUD_ANON,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, payload }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json?.error || `Admin request failed: ${res.status}`);
  }

  return json as T;
}

export function useAdminData() {
  return useCallback(callAdminData, []);
}
