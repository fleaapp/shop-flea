import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  notifyListingInvalidated,
  shouldPurgeSnapshot,
  type ListingInvalidationReason,
} from '@/utils/listingInvalidation';
import { removeSavedListingSnapshot } from '@/utils/savedListingSnapshots';

/**
 * Global subscription to `public.listings` changes.
 *
 * Mounted once, near the root of the authenticated app. Broadcasts an
 * in-app event whenever a listing is deleted or moves to a non-visible
 * status so every list-view hook can drop it from local state instantly.
 */
const useListingsRealtime = () => {
  useEffect(() => {
    const channel = supabase
      .channel('listings-global')
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'listings' },
        (payload) => {
          const id = (payload.old as { id?: string } | null)?.id;
          if (!id) return;
          notifyListingInvalidated(id, 'deleted');
          removeSavedListingSnapshot(id);
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'listings' },
        (payload) => {
          const next = payload.new as { id?: string; status?: string } | null;
          const prev = payload.old as { status?: string } | null;
          const id = next?.id;
          if (!id) return;

          const nextStatus = next?.status;
          const prevStatus = prev?.status;
          if (nextStatus === prevStatus) return;

          if (nextStatus && nextStatus !== 'active' && nextStatus !== 'paused') {
            const reason = nextStatus as ListingInvalidationReason;
            notifyListingInvalidated(id, reason);
            if (shouldPurgeSnapshot(reason)) {
              removeSavedListingSnapshot(id);
            }
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);
};

export default useListingsRealtime;
