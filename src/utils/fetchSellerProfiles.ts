import { supabase } from '@/lib/supabase';

export interface SellerProfileLookup {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  location: string | null;
  rating: number | null;
  pause_selling: boolean | null;
  last_sign_in_at: string | null;
  status: string | null;
}

export const SELLER_INACTIVE_MS = 10 * 24 * 60 * 60 * 1000;

/** Same rule the cart uses: seller not seen for 10+ days is inactive. */
export const isSellerInactive = (lastSignInAt?: string | null): boolean => {
  if (!lastSignInAt) return false;
  const t = new Date(lastSignInAt).getTime();
  return Number.isFinite(t) && Date.now() - t > SELLER_INACTIVE_MS;
};

export interface FetchSellerProfilesResult {
  profiles: SellerProfileLookup[];
  canTrustMissing: boolean;
}

const normalizeProfile = (row: Record<string, unknown>): SellerProfileLookup => ({
  user_id: String(row.user_id ?? ''),
  username: (row.username as string | null) ?? null,
  avatar_url: (row.avatar_url as string | null) ?? null,
  location: (row.location as string | null) ?? null,
  rating: (row.rating as number | null) ?? null,
  pause_selling: (row.pause_selling as boolean | null) ?? null,
  last_sign_in_at: (row.last_sign_in_at as string | null) ?? null,
  status: (row.status as string | null) ?? null,
});

/** Public lookup contains availability markers, not real activity timestamps. */
export const fetchSellerProfiles = async (userIds: string[]): Promise<FetchSellerProfilesResult> => {
  if (userIds.length === 0) return { profiles: [], canTrustMissing: true };
  const { data, error } = await supabase.from('seller_profiles')
    .select('user_id,username,avatar_url,location,rating,pause_selling,last_sign_in_at,status').in('user_id', userIds);
  if (error) {
    console.warn('Seller profiles unavailable:', error.message);
    return { profiles: [], canTrustMissing: false };
  }
  return { profiles: (data ?? []).map(row => normalizeProfile(row as Record<string, unknown>)).filter(p => p.user_id), canTrustMissing: true };
};
