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

const PROFILE_SELECT =
  'user_id, username, avatar_url, location, rating, pause_selling, last_sign_in_at, status';

export const fetchSellerProfiles = async (userIds: string[]): Promise<FetchSellerProfilesResult> => {
  if (userIds.length === 0) {
    return { profiles: [], canTrustMissing: true };
  }

  const profilesPublicResponse = await supabase
    .from('profiles_public')
    .select(PROFILE_SELECT)
    .in('user_id', userIds);

  if (!profilesPublicResponse.error) {
    return {
      profiles: (profilesPublicResponse.data as SellerProfileLookup[]) || [],
      canTrustMissing: true,
    };
  }

  const shouldFallbackToProfiles =
    profilesPublicResponse.error.code === 'PGRST205' ||
    profilesPublicResponse.error.message?.includes('profiles_public');

  if (!shouldFallbackToProfiles) {
    console.error('Failed to fetch seller profiles:', profilesPublicResponse.error);
    return { profiles: [], canTrustMissing: false };
  }

  const profilesFallbackResponse = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .in('user_id', userIds);

  if (profilesFallbackResponse.error) {
    console.error('Failed to fetch seller profiles from fallback source:', profilesFallbackResponse.error);
    return { profiles: [], canTrustMissing: false };
  }

  return {
    profiles: (profilesFallbackResponse.data as SellerProfileLookup[]) || [],
    canTrustMissing: true,
  };
};
