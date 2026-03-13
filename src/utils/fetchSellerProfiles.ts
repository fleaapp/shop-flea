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

export const fetchSellerProfiles = async (userIds: string[]): Promise<FetchSellerProfilesResult> => {
  if (userIds.length === 0) {
    return { profiles: [], canTrustMissing: true };
  }

  // Use wildcard select so this works across environments even if view columns differ.
  const profilesPublicResponse = await supabase
    .from('profiles_public')
    .select('*')
    .in('user_id', userIds);

  if (!profilesPublicResponse.error) {
    const profiles = ((profilesPublicResponse.data as Record<string, unknown>[] | null) ?? [])
      .map(normalizeProfile)
      .filter((p) => p.user_id);

    return { profiles, canTrustMissing: true };
  }

  const shouldFallbackToProfiles =
    profilesPublicResponse.error.code === 'PGRST205' ||
    profilesPublicResponse.error.message?.includes('profiles_public');

  if (!shouldFallbackToProfiles) {
    console.error('Failed to fetch seller profiles:', profilesPublicResponse.error);
    return { profiles: [], canTrustMissing: false };
  }

  // Fallback for legacy environments without profiles_public.
  const profilesFallbackResponse = await supabase
    .from('profiles')
    .select('*')
    .in('user_id', userIds);

  if (profilesFallbackResponse.error) {
    console.error('Failed to fetch seller profiles from fallback source:', profilesFallbackResponse.error);
    return { profiles: [], canTrustMissing: false };
  }

  const profiles = ((profilesFallbackResponse.data as Record<string, unknown>[] | null) ?? [])
    .map(normalizeProfile)
    .filter((p) => p.user_id);

  // IMPORTANT: Do not trust missing rows from profiles fallback because table RLS can hide active users.
  return { profiles, canTrustMissing: false };
};
