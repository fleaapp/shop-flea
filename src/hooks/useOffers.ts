import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { notifyOfferChanged } from '@/utils/offerInvalidation';

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'countered' | 'expired' | 'withdrawn';
export type OfferDirection = 'buyer_to_seller' | 'seller_to_buyer';

export interface Offer {
  id: string;
  listing_id: string;
  seller_id: string;
  buyer_id: string;
  amount: number;
  original_price: number;
  status: OfferStatus;
  direction: OfferDirection;
  parent_offer_id: string | null;
  round: number;
  message: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export const OFFER_MIN_PERCENT = 0.6;

async function callOffers(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('offers', { body: payload });
  if (error) {
    // Edge function returns { error } with a 4xx; surface the readable message.
    let message = error.message || 'Something went wrong. Please try again.';
    try {
      const ctx: any = (error as any).context;
      const body = ctx && typeof ctx.json === 'function' ? await ctx.json() : null;
      if (body?.error) message = body.error;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

/** Live offers for the signed-in user, both directions. */
export function useOffers() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOffers = useCallback(async () => {
    if (!user) {
      setOffers([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('offers' as any)
      .select('*')
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(300);
    if (!error && data) setOffers(data as unknown as Offer[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  // Re-check against the server whenever the app comes back to the foreground,
  // so expiry countdowns can never drift out of sync with the database.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchOffers();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchOffers]);

  const isLive = (o: Offer) => o.status === 'pending' && new Date(o.expires_at).getTime() > Date.now();

  const received = useMemo(
    () =>
      offers.filter(
        (o) =>
          (o.direction === 'buyer_to_seller' && o.seller_id === user?.id) ||
          (o.direction === 'seller_to_buyer' && o.buyer_id === user?.id),
      ),
    [offers, user],
  );
  const sent = useMemo(
    () =>
      offers.filter(
        (o) =>
          (o.direction === 'buyer_to_seller' && o.buyer_id === user?.id) ||
          (o.direction === 'seller_to_buyer' && o.seller_id === user?.id),
      ),
    [offers, user],
  );
  const pendingReceivedCount = useMemo(() => received.filter(isLive).length, [received]);

  const respond = useCallback(
    async (offerId: string, decision: 'accept' | 'decline') => {
      const res = await callOffers({ action: 'respond', offerId, decision });
      notifyOfferChanged((res.offer as Offer | undefined)?.listing_id);
      await fetchOffers();
      return res.offer as Offer;
    },
    [fetchOffers],
  );

  const withdraw = useCallback(
    async (offerId: string) => {
      const res = await callOffers({ action: 'withdraw', offerId });
      notifyOfferChanged((res.offer as Offer | undefined)?.listing_id);
      await fetchOffers();
      return res.offer as Offer;
    },
    [fetchOffers],
  );

  const create = useCallback(
    async (listingId: string, amount: number, parentOfferId?: string | null) => {
      const res = await callOffers({ action: 'create', listingId, amount, parentOfferId: parentOfferId ?? null });
      notifyOfferChanged(listingId);
      await fetchOffers();
      return res.offer as Offer;
    },
    [fetchOffers],
  );

  const blast = useCallback(async (listingId: string, amount: number) => {
    const res = await callOffers({ action: 'blast', listingId, amount });
    notifyOfferChanged(listingId);
    return { sent: res.sent as number, reason: (res.reason ?? null) as string | null };
  }, []);

  return { offers, received, sent, pendingReceivedCount, loading, refresh: fetchOffers, create, respond, withdraw, blast };
}

/** Accepted, unexpired offers for the signed-in buyer, keyed by listing id. */
export function useAcceptedOffers() {
  const { user } = useAuth();
  const [map, setMap] = useState<Record<string, Offer>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchAccepted = useCallback(async () => {
    if (!user) {
      setMap({});
      return;
    }
    const { data, error: queryError } = await supabase
      .from('offers' as any)
      .select('*')
      .eq('buyer_id', user.id)
      .eq('status', 'accepted')
      .gt('expires_at', new Date().toISOString());
    if (queryError) {
      setError('Could not verify accepted offer prices.');
      return;
    }
    const next: Record<string, Offer> = {};
    ((data ?? []) as unknown as Offer[]).forEach((o) => {
      const existing = next[o.listing_id];
      if (!existing || new Date(o.accepted_at ?? o.created_at) > new Date(existing.accepted_at ?? existing.created_at)) {
        next[o.listing_id] = o;
      }
    });
    setMap(next);
    setError(null);
  }, [user]);

  useEffect(() => {
    fetchAccepted();
  }, [fetchAccepted]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchAccepted();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fetchAccepted]);

  return { acceptedOffers: map, acceptedOffersError: error, refreshAcceptedOffers: fetchAccepted };
}

/** Countdown label like "23h left" / "42m left". */
export function offerTimeLeft(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `${hours}h left`;
  return `${Math.max(1, Math.floor(ms / 60000))}m left`;
}
