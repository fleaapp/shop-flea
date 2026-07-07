import { supabase } from '@/lib/supabase';
import {
  getGuestFavorites,
  clearGuestFavorites,
} from '@/utils/guestWishlist';
import {
  getGuestDiscards,
  clearGuestDiscards,
} from '@/utils/guestDiscards';
import {
  createSavedListingSnapshotFromListing,
  saveSavedListingSnapshots,
} from '@/utils/savedListingSnapshots';

/**
 * Merge any guest-session activity (wishlist likes + passed/discarded listings)
 * into the newly authenticated user's account. Safe to call multiple times —
 * duplicates are ignored and storage is cleared afterwards.
 */
export const mergeGuestSessionToAccount = async (userId: string) => {
  if (!userId) return;

  const guestFavorites = getGuestFavorites();
  const guestDiscards = getGuestDiscards();

  if (guestFavorites.length === 0 && guestDiscards.length === 0) return;

  try {
    if (guestFavorites.length > 0) {
      const rows = guestFavorites.map((l) => ({
        user_id: userId,
        listing_id: l.id,
      }));
      await supabase
        .from('favorites')
        .upsert(rows, { onConflict: 'user_id,listing_id', ignoreDuplicates: true });

      try {
        saveSavedListingSnapshots(
          userId,
          guestFavorites.map((l) => createSavedListingSnapshotFromListing(l)),
        );
      } catch (err) {
        console.warn('Failed to persist guest wishlist snapshots:', err);
      }
    }

    if (guestDiscards.length > 0) {
      const rows = guestDiscards.map((listingId) => ({
        user_id: userId,
        listing_id: listingId,
      }));
      await supabase
        .from('discarded_listings')
        .upsert(rows, { onConflict: 'user_id,listing_id', ignoreDuplicates: true });
    }
  } catch (err) {
    console.warn('Failed to merge guest session into account:', err);
    return;
  }

  clearGuestFavorites();
  clearGuestDiscards();
};
