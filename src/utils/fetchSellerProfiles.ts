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

const PROFILE_SELECT =
  'user_id, username, avatar_url, location, rating, pause_selling, last_sign_in_at, status';

export const fetchSellerProfiles = async (userIds: string[]): Promise<SellerProfileLookup[]> => {
  if (userIds.length === 0) return [];

  const profilesPublicResponse = await supabase
    .from('profiles_public')
    .select(PROFILE_SELECT)
    .in('user_id', userIds);

  if (!profilesPublicResponse.error) {
    return (profilesPublicResponse.data as SellerProfileLookup[]) || [];
  }

  const shouldFallbackToProfiles =
    profilesPublicResponse.error.code === 'PGRST205' ||
    profilesPublicResponse.error.message?.includes('profiles_public');

  if (!shouldFallbackToProfiles) {
    console.error('Failed to fetch seller profiles:', profilesPublicResponse.error);
    return [];
  }

  const profilesFallbackResponse = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .in('user_id', userIds);

  if (profilesFallbackResponse.error) {
    console.error('Failed to fetch seller profiles from fallback source:', profilesFallbackResponse.error);
    return [];
  }

  return (profilesFallbackResponse.data as SellerProfileLookup[]) || [];
};
