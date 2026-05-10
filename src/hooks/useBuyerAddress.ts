// useBuyerAddress
// Reads / writes the buyer's saved checkout shipping details from the
// `buyer_addresses` table (RLS-protected). Falls back to localStorage as a
// fast first-paint cache so the form pre-fills instantly while the network
// hydrates the source of truth.

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const LS_KEY = 'saved_shipping_details';

export type SavedAddress = {
  firstName: string;
  lastName: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
};

const EMPTY: SavedAddress = {
  firstName: '', lastName: '', address: '', suburb: '', state: '', postcode: '',
};

function readCache(): SavedAddress | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeCache(v: SavedAddress) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch { /* noop */ }
}

function clearCache() {
  try { localStorage.removeItem(LS_KEY); } catch { /* noop */ }
}

export function useBuyerAddress() {
  const { user } = useAuth();
  const [address, setAddress] = useState<SavedAddress | null>(() => readCache());
  const [loading, setLoading] = useState<boolean>(!!user);

  // Hydrate from DB on mount / user change
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('buyer_addresses' as any)
        .select('first_name,last_name,address,suburb,state,postcode')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const next: SavedAddress = {
          firstName: (data as any).first_name || '',
          lastName: (data as any).last_name || '',
          address: (data as any).address || '',
          suburb: (data as any).suburb || '',
          state: (data as any).state || '',
          postcode: (data as any).postcode || '',
        };
        setAddress(next);
        writeCache(next);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const save = useCallback(async (next: SavedAddress) => {
    setAddress(next);
    writeCache(next);
    if (!user) return;
    await supabase.from('buyer_addresses' as any).upsert({
      user_id: user.id,
      first_name: next.firstName,
      last_name: next.lastName,
      address: next.address,
      suburb: next.suburb,
      state: next.state,
      postcode: next.postcode,
    } as any, { onConflict: 'user_id' });
  }, [user?.id]);

  const clear = useCallback(async () => {
    setAddress(null);
    clearCache();
    if (!user) return;
    await supabase.from('buyer_addresses' as any).delete().eq('user_id', user.id);
  }, [user?.id]);

  return { address: address ?? EMPTY, hasSaved: !!address, loading, save, clear };
}
