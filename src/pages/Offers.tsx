import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useOffers, Offer, offerTimeLeft } from '@/hooks/useOffers';
import MakeOfferDrawer from '@/components/MakeOfferDrawer';
import { safeNavigateBack } from '@/utils/safeBack';
import { Button } from '@/components/ui/button';
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
  const { user } = useAuth();
  const { received, sent, loading, create, respond, withdraw, refresh } = useOffers();
  const [tab, setTab] = useState<'received' | 'sent'>(
    (location.state as any)?.tab === 'sent' ? 'sent' : 'received',
  );
  const [listings, setListings] = useState<Record<string, ListingLite>>({});
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [counterOffer, setCounterOffer] = useState<Offer | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

        {offer.status === 'accepted' && offer.buyer_id === user?.id && (
          <Button onClick={() => navigate('/cart')} className="mt-3 h-10 w-full rounded-lg text-sm">
            Pay ${offer.amount.toFixed(2)} - offer price
          </Button>
        )}
      </div>
    );
  };

  const list = tab === 'received' ? received : sent;

  return (
    <div className="native-safe-top fixed inset-0 flex flex-col bg-background pb-24">
      <div className="flex shrink-0 items-center gap-3 px-4 pt-4">
        <button
          onClick={() => safeNavigateBack(navigate, '/profile')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card card-shadow"
        >
          <ChevronLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">💰 Offers</h1>
      </div>

      <div className="mt-4 flex shrink-0 justify-center px-4">
        <div className="flex w-[220px] items-center rounded-full bg-muted p-1">
          {(['received', 'sent'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`w-1/2 rounded-full px-3 py-2.5 text-sm font-medium capitalize transition-all ${
                tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto px-4 pb-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <span className="text-5xl">⏳</span>
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="mb-3 text-5xl">💰</span>
            <p className="text-sm text-muted-foreground">
              {tab === 'received' ? 'No offers received yet.' : 'You have not made any offers yet.'}
            </p>
          </div>
        ) : (
          list.map((o) => renderCard(o, tab))
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

      <BottomNav />
    </div>
  );
};

export default Offers;
