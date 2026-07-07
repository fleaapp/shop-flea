import { supabase } from '@/lib/supabase';
import { invokeCloudFunction } from '@/utils/cloudFunctions';

type CleanupValidationResponse = {
  invalidListingIds?: string[];
} | null;

const toInvalidListingSet = (data: CleanupValidationResponse): Set<string> => {
  if (!Array.isArray(data?.invalidListingIds)) {
    return new Set<string>();
  }

  return new Set(
    data.invalidListingIds
      .filter((listingId): listingId is string => typeof listingId === 'string')
      .map((listingId) => listingId.trim())
      .filter(Boolean),
  );
};

export const getInvalidListingIds = async (listingIds: string[]): Promise<Set<string>> => {
  if (listingIds.length === 0) {
    return new Set<string>();
  }

  // Guest mode has no saved listings to validate, and the edge function
  // requires authentication. Treat all listings as valid for guests.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    return new Set<string>();
  }

  try {
    const { data, error } = await invokeCloudFunction('cleanup-stale-saved-listings', {
      listingIds,
      performCleanup: false,
    });

    if (error) {
      console.error('Failed to validate listing access:', error);
      return new Set<string>();
    }

    return toInvalidListingSet(data as CleanupValidationResponse);
  } catch (error) {
    console.error('Failed to validate listing access:', error);
    return new Set<string>();
  }
};

export const canOpenListing = async (listingId: string): Promise<boolean> => {
  const invalidListingIds = await getInvalidListingIds([listingId]);
  return !invalidListingIds.has(listingId);
};
