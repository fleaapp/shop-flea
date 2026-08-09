import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import EmptyState from '@/components/EmptyState';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useOffers, Offer, offerTimeLeft } from '@/hooks/useOffers';
import MakeOfferDrawer from '@/components/MakeOfferDrawer';
import { safeNavigateBack } from '@/utils/safeBack';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import useSellerGate from '@/hooks/useSellerGate';

import { toast } from 'sonner';
import { calculateTransactionFee } from '@/utils/feeCalculator';

interface ListingLite {
  id: string;
  title: string;
  price: number;
  shipping_price: number | null;
  images: string[];
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  accepted: 'Accepted',
  declined: 'Declined',
  countered: 'Countered',
  expired: 'Expired',
  withdrawn: 'Withdrawn',
};

const Offers = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, refreshProfile } = useAuth();
  const { received, sent, loading, loadingMore, hasMore, loadMore, create, respond, withdraw, refresh } = useOffers();
  const { sellerReady, gate: sellerGate, setGateOpen: setSellerGateOpen } = useSellerGate();
  const requestedRole = (location.state as any)?.role;
  const [role, setRole] = useState<'buyer' | 'seller'>(
    requestedRole === 'seller' ? 'seller' : 'buyer',
  );
  // Notifications can't tell which side of an offer the user is on, so they pass
  // role: 'auto' and we land on whichever side actually holds the offers.
  const [autoRole, setAutoRole] = useState(requestedRole === 'auto');
  const [tab, setTab] = useState<'received' | 'sent'>(
    (location.state as any)?.tab === 'sent' ? 'sent' : 'received',
  );
  const [listings, setListings] = useState<Record<string, ListingLite>>({});
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [counterOffer, setCounterOffer] = useState<Offer | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingOffersToggle, setSavingOffersToggle] = useState(false);

  const offersEnabled = (profile as any)?.offers_enabled ?? false;
  const handleToggleOffers = async (checked: boolean) => {
    if (!user) return;
    setSavingOffersToggle(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ offers_enabled: checked } as any)
        .eq('user_id', user.id)
        .select('offers_enabled')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('No profile row updated');
      await refreshProfile();
      toast.success(checked ? 'Offers on' : 'Offers off');
    } catch (error: any) {
      toast.error(`Failed to update: ${error?.message ?? 'unknown error'}`);
    } finally {
      setSavingOffersToggle(false);
    }
  };


  const all = useMemo(() => [...received, ...sent], [received, sent]);
  const listingIdsKey = useMemo(
    () => [...new Set(all.map((o) => o.listing_id))].sort().join(','),
    [all],
  );
  const userIdsKey = useMemo(
    () =>
      [...new Set(all.flatMap((o) => [o.buyer_id, o.seller_id]))]
        .filter((id) => id && id !== user?.id)
        .sort()
        .join(','),
    [all, user?.id],
  );

  useEffect(() => {
    const load = async () => {
      const listingIds = listingIdsKey ? listingIdsKey.split(',') : [];
      const userIds = userIdsKey ? userIdsKey.split(',') : [];
      if (listingIds.length > 0) {
        const { data } = await supabase
          .from('listings')
          .select('id, title, price, shipping_price, images, status')
          .in('id', listingIds);
        const map: Record<string, ListingLite> = {};
        (data ?? []).forEach((l: any) => (map[l.id] = l));
        setListings(map);
      }
      if (userIds.length > 0) {
        const { data } = await supabase
          .from('profiles_public')
          .select('user_id, username')
          .in('user_id', userIds);
        const map: Record<string, string> = {};
        (data ?? []).forEach((p: any) => (map[p.user_id] = p.username));
        setUsernames(map);
      }
    };
    if (listingIdsKey) load();
  }, [listingIdsKey, userIdsKey]);

  // Poll only while the screen is actually visible - background timers on
  // native keep firing and drain battery for no benefit.
  useEffect(() => {
    let timer: number | undefined;
    const start = () => {
      if (timer) return;
      timer = window.setInterval(() => void refresh(), 60_000);
    };
    const stop = () => {
      if (timer) window.clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
        start();
      } else {
        stop();
      }
    };
    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);


  const isLive = (o: Offer) => o.status === 'pending' && new Date(o.expires_at).getTime() > Date.now();

  const handleRespond = async (offer: Offer, decision: 'accept' | 'decline') => {
    setBusyId(offer.id);
    try {
      await respond(offer.id, decision);
      toast.success(
        decision === 'accept'
          ? offer.direction === 'buyer_to_seller'
            ? 'Offer accepted. The buyer has 24 hours to pay.'
            : 'Offer accepted. The item is in your cart at that price - pay within 24 hours.'
          : 'Offer declined.',
      );

    } catch (error: any) {
      toast.error(error?.message || 'Could not update that offer.');
    } finally {
      setBusyId(null);
    }
  };

  const handleWithdraw = async (offer: Offer) => {
    setBusyId(offer.id);
    try {
      await withdraw(offer.id);
      toast.success('Offer withdrawn.');
    } catch (error: any) {
      toast.error(error?.message || 'Could not withdraw that offer.');
    } finally {
      setBusyId(null);
    }
  };

  const renderCard = (offer: Offer, list: 'received' | 'sent') => {
    const listing = listings[offer.listing_id];
    const counterpartId = offer.buyer_id === user?.id ? offer.seller_id : offer.buyer_id;
    const counterpart = usernames[counterpartId] || '@user';
    const live = isLive(offer);
    const shipping = Number(listing?.shipping_price || 0);
    const sellerNet =
      Math.round((offer.amount + shipping - calculateTransactionFee(offer.amount + shipping)) * 100) / 100;
    const iAmSeller = offer.seller_id === user?.id;
    const payable = offer.status === 'accepted' && new Date(offer.expires_at).getTime() > Date.now();
    const acceptedLapsed = offer.status === 'accepted' && !payable;
    const listingGone = listing ? listing.status !== 'active' : false;
    const closed = !live && !payable;

    return (
      <div key={offer.id} className={`rounded-2xl bg-card p-3 card-shadow ${closed ? 'opacity-70' : ''}`}>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(`/listing/${offer.listing_id}`)}
            className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-muted"
          >
            {listing?.images?.[0] && (
              <img src={listing.images[0]} alt={listing.title} className="h-full w-full object-cover" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{listing?.title || 'Item'}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  live || payable ? 'bg-primary/15 text-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {live
                  ? offerTimeLeft(offer.expires_at)
                  : payable
                    ? `Pay within ${offerTimeLeft(offer.expires_at).replace(' left', '')}`
                    : acceptedLapsed
                      ? 'Expired'
                      : offer.status === 'pending'
                        ? 'Expired'
                        : STATUS_LABEL[offer.status] || 'Closed'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {list === 'received' ? 'From' : 'To'} {counterpart}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-base font-bold text-foreground">${offer.amount.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground line-through">
                ${Number(offer.original_price).toFixed(2)}
              </span>
            </div>
            {iAmSeller && !closed && (
              <p className="mt-0.5 text-xs text-muted-foreground">You'd receive ${sellerNet.toFixed(2)}</p>
            )}
            {listingGone && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {listing?.status === 'sold' ? 'This item has sold.' : 'This item is no longer available.'}
              </p>
            )}
            {acceptedLapsed && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                The 24 hour payment window closed, so this offer price is no longer valid.
              </p>
            )}
          </div>
        </div>


        {live && list === 'received' && (
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              disabled={busyId === offer.id}
              onClick={() => handleRespond(offer, 'decline')}
              className="h-10 flex-1 rounded-lg text-sm"
            >
              Decline
            </Button>
            {offer.round < 5 && (
              <Button
                variant="outline"
                disabled={busyId === offer.id}
                onClick={() => setCounterOffer(offer)}
                className="h-10 flex-1 rounded-lg text-sm"
              >
                Counter
              </Button>
            )}
            <Button
              disabled={busyId === offer.id}
              onClick={() => handleRespond(offer, 'accept')}
              className="h-10 flex-1 rounded-lg text-sm"
            >
              Accept
            </Button>
          </div>
        )}

        {live && list === 'sent' && (
          <Button
            variant="outline"
            disabled={busyId === offer.id}
            onClick={() => handleWithdraw(offer)}
            className="mt-3 h-10 w-full rounded-lg text-sm"
          >
            Withdraw
          </Button>
        )}

        {payable && offer.buyer_id === user?.id && !listingGone && (
          <>
            <Button onClick={() => navigate('/cart')} className="mt-3 h-10 w-full rounded-lg text-sm">
              Pay ${offer.amount.toFixed(2)} - offer price
            </Button>
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
              Offer price held for {offerTimeLeft(offer.expires_at).replace(' left', '')} - the item is not reserved until you pay.
            </p>
          </>
        )}
      </div>
    );
  };

  const isMine = (o: Offer) =>
    (o.direction === 'buyer_to_seller' && o.buyer_id === user?.id) ||
    (o.direction === 'seller_to_buyer' && o.seller_id === user?.id);

  const list = useMemo(() => {
    const rows = all.filter((o) => {
      const inRole = role === 'buyer' ? o.buyer_id === user?.id : o.seller_id === user?.id;
      if (!inRole) return false;
      return tab === 'sent' ? isMine(o) : !isMine(o);
    });
    const rank = (o: Offer) => {
      if (isLive(o)) return 0;
      if (o.status === 'accepted' && new Date(o.expires_at).getTime() > Date.now()) return 1;
      return 2;
    };
    const seen = new Set<string>();
    return [...rows]
      .filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)))
      .sort(
        (a, b) =>
          rank(a) - rank(b) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [role, tab, all, user?.id]);

  useEffect(() => {
    if (!autoRole || !user?.id || all.length === 0) return;
    const inTab = (o: Offer) => (tab === 'sent' ? isMine(o) : !isMine(o));
    const buyerCount = all.filter((o) => o.buyer_id === user.id && inTab(o)).length;
    const sellerCount = all.filter((o) => o.seller_id === user.id && inTab(o)).length;
    if (buyerCount === 0 && sellerCount > 0) setRole('seller');
    setAutoRole(false);
  }, [autoRole, all, tab, user?.id]);

  return (
    <div className="native-safe-top fixed inset-0 flex flex-col bg-background pb-24">
      <div className="relative flex h-10 shrink-0 items-center justify-center px-4 pt-4">
        <button aria-label="Back"
          onClick={() => safeNavigateBack(navigate, '/profile')}
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-card card-shadow"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">💰 Offers</h1>
      </div>

      <div className="mt-8 flex shrink-0 justify-center px-4">
        <div className="flex w-[220px] items-center rounded-full bg-muted p-1">
          {(['buyer', 'seller'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`w-1/2 rounded-full px-3 py-2.5 text-sm font-medium capitalize transition-all ${
                role === r ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex shrink-0 justify-center px-4">
        <div className="flex w-[220px] items-center rounded-full bg-muted p-1">
          {(['received', 'sent'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`w-1/2 rounded-full px-3 py-2 text-xs font-medium capitalize whitespace-nowrap transition-all ${
                tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>



      {role === 'seller' && sellerReady && (
        <div className="mt-4 shrink-0 px-4">
          <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 card-shadow">
            <div className="min-w-0 pr-3">
              <p className="text-sm font-semibold text-foreground">💰 Offers</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {offersEnabled
                  ? 'Buyers can make offers on your listings.'
                  : 'Turn on to let buyers make offers on your listings.'}
              </p>
            </div>
            <Switch
              checked={offersEnabled}
              disabled={savingOffersToggle}
              onCheckedChange={handleToggleOffers}
             
            />
          </div>
        </div>
      )}

      <div className="mt-4 flex-1 overflow-y-auto px-4 pb-6">

        {role === 'seller' && !sellerReady ? (
          <EmptyState
            emoji="💰"
            title="Set up seller account"
            description="Become a seller to receive and manage offers on your listings."
            actionLabel="Set up seller account"
            onAction={() => setSellerGateOpen(true)}
            minHeightClass="min-h-[55vh]"
          />
        ) : loading ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <span className="text-5xl">⏳</span>
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            emoji="💰"
            title={tab === 'received' ? 'No offers received' : 'No offers sent'}
            description={
              role === 'seller'
                ? tab === 'received'
                  ? 'When a buyer makes you an offer, it lands here. You have 24 hours to accept, counter or decline.'
                  : 'Send a discount offer from a listing to everyone who saved it.'
                : tab === 'received'
                  ? 'Sellers can send you a discount on items you have saved. Those offers land here.'
                  : 'Found something you love? Make an offer and the seller has 24 hours to reply.'
            }
            actionLabel={role === 'buyer' ? 'Browse items' : undefined}
            onAction={role === 'buyer' ? () => navigate('/') : undefined}
            minHeightClass="min-h-[55vh]"
          />
        ) : (
          <div className="space-y-3">
            {list.map((o) => renderCard(o, tab))}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="w-full rounded-xl border border-border bg-card py-3 text-sm font-medium text-foreground disabled:opacity-60"
              >
                {loadingMore ? 'Loading...' : 'Load older offers'}
              </button>
            )}
          </div>
        )}
      </div>



      {counterOffer && listings[counterOffer.listing_id] && (
        <MakeOfferDrawer
          open={!!counterOffer}
          onOpenChange={(v) => {
            if (!v) setCounterOffer(null);
          }}
          mode="counter"
          parentOfferId={counterOffer.id}
          listing={{
            id: counterOffer.listing_id,
            title: listings[counterOffer.listing_id].title,
            price: Number(counterOffer.original_price),
            shipping_price: listings[counterOffer.listing_id].shipping_price,
            image: listings[counterOffer.listing_id].images?.[0],
          }}
          onSubmit={async (amount, parentOfferId) => {
            await create(counterOffer.listing_id, amount, parentOfferId);
            toast.success('Counter-offer sent.');
            setCounterOffer(null);
            refresh();
          }}
        />
      )}

      {sellerGate}
      <BottomNav />
    </div>
  );
};

export default Offers;
