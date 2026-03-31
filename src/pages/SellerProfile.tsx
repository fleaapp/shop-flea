import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';
import { formatTagLabel } from '@/components/ListingTag';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/context/AuthContext';
import { useReporting } from '@/hooks/useReporting';
import ReportDialog from '@/components/ReportDialog';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import { getAvatarUrl } from '@/utils/optimizedImage';
import { toast } from 'sonner';
import { Listing } from '@/types/listing';
import ReviewsDrawer from '@/components/ReviewsDrawer';
import { ArrowLeft, MoreVertical, LayoutGrid, Rows3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProfileGridCard from '@/components/ProfileGridCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
interface SellerProfile {
  user_id: string;
  username: string;
  avatar_url: string | null;
  rating: number | null;
  pause_selling?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  last_sign_in_at?: string | null;
}

interface DbListing {
  id: string;
  title: string;
  brand: string;
  size: string;
  price: number;
  shipping_price: number | null;
  images: string[];
  condition: string;
  category: string;
  description: string | null;
  tags: string[] | null;
  status: string;
  user_id: string;
  created_at: string;
}

const SellerProfile = () => {
  const navigate = useNavigate();
  const { sellerId } = useParams<{ sellerId: string }>();
  const [activeTab, setActiveTab] = useState<'listings' | 'sold'>('listings');
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [activeListings, setActiveListings] = useState<DbListing[]>([]);
  const [soldListings, setSoldListings] = useState<DbListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single');
  const [hasOutstandingOrder, setHasOutstandingOrder] = useState(false);
  
  const { addToCart, isInCart } = useCart();
  const { addFavorite, isFavorite } = useFavorites();
  const { user } = useAuth();
  const { openReport, submitPendingReport, closeReport, pendingReport, isReporting } = useReporting();

  useEffect(() => {
    if (sellerId) {
      fetchSellerData();
      if (user) {
        checkOutstandingOrders();
      }
    }
  }, [sellerId, user]);

  const fetchSellerData = async () => {
    if (!sellerId) return;
    
    setLoading(true);
    setListingsLoading(true);

    // Try profiles_public first (no RLS restrictions), fallback to profiles
    let profileData: SellerProfile | null = null;
    let profileError: any = null;

    const { data: publicData, error: publicError } = await supabase
      .from('profiles_public' as any)
      .select('user_id, username, avatar_url, rating, pause_selling, last_sign_in_at')
      .eq('user_id', sellerId)
      .maybeSingle();

    if (!publicError && publicData) {
      profileData = publicData as any;
    } else {
      // Fallback to profiles table
      const { data: pData, error: pError } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url, rating, pause_selling, last_sign_in_at')
        .eq('user_id', sellerId)
        .maybeSingle();

      if (pError?.code === '42703') {
        const fallbackResult = await supabase
          .from('profiles')
          .select('user_id, username, avatar_url, rating, pause_selling, created_at, updated_at')
          .eq('user_id', sellerId)
          .maybeSingle();

        profileData = fallbackResult.data
          ? {
              ...fallbackResult.data,
              last_sign_in_at: fallbackResult.data.updated_at || fallbackResult.data.created_at || null,
            }
          : null;
        profileError = fallbackResult.error;
      } else {
        profileData = pData;
        profileError = pError;
      }
    }

    if (profileError || !profileData) {
      console.error('Error fetching seller profile:', profileError);
      setLoading(false);
      return;
    }

    setSellerProfile(profileData);
    setLoading(false);

    // Fetch active listings
    const { data: activeData } = await supabase
      .from('listings')
      .select('*')
      .eq('user_id', sellerId)
      .eq('status', 'active');

    if (activeData) {
      setActiveListings(activeData);
    }

    // Fetch sold listings via orders (one card per transaction)
    const { data: orders } = await supabase
      .from('orders')
      .select('id, listing_id, created_at')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    if (orders && orders.length > 0) {
      const listingIds = [...new Set(orders.map(o => o.listing_id))];
      const { data: soldData } = await supabase
        .from('listings')
        .select('*')
        .in('id', listingIds)
        .eq('user_id', sellerId);

      if (soldData) {
        const listingMap = new Map(soldData.map(l => [l.id, l]));
        const orderedSold = orders
          .map(order => {
            const listing = listingMap.get(order.listing_id);
            if (!listing) return null;
            return { ...listing, id: `${listing.id}::${order.id}`, created_at: order.created_at };
          })
          .filter((l): l is DbListing => !!l);
        setSoldListings(orderedSold);
      }
    } else {
      setSoldListings([]);
    }

    setListingsLoading(false);
  };

  const checkOutstandingOrders = async () => {
    if (!sellerId || !user) return;

    // Check for orders where current user is buyer and seller is the profile user, or vice versa
    // Outstanding orders are those that are not 'delivered' or 'cancelled'
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status')
      .or(`and(buyer_id.eq.${user.id},seller_id.eq.${sellerId}),and(buyer_id.eq.${sellerId},seller_id.eq.${user.id})`)
      .not('status', 'in', '("delivered","cancelled")');

    setHasOutstandingOrder(orders && orders.length > 0);
  };

  const handleReportUser = () => {
    if (!sellerProfile) return;
    openReport('user', sellerProfile.user_id, sellerProfile.user_id);
  };

  const handleBlockUser = () => {
    if (hasOutstandingOrder) {
      toast.error('Cannot block user with outstanding orders');
      return;
    }
    toast.success('User blocked');
  };

  const displayListings = activeTab === 'listings' ? activeListings : soldListings;

  const handleAddToCart = async (listing: DbListing) => {
    const listingForCart: Listing = {
      id: listing.id,
      title: listing.title,
      brand: listing.brand,
      size: listing.size,
      price: listing.price,
      shippingPrice: listing.shipping_price || 0,
      image: listing.images?.[0] || '',
      images: listing.images || [],
      sellerId: listing.user_id,
      sellerName: sellerProfile?.username || 'Unknown',
      sellerAvatar: sellerProfile?.avatar_url || getDefaultAvatar(listing.user_id),
      condition: listing.condition as Listing['condition'],
      category: listing.category,
      description: listing.description || '',
      tags: listing.tags || [],
      location: '',
      createdAt: new Date(listing.created_at),
    };

    const success = await addToCart(listingForCart);
    if (success) {
      toast.success('Added to cart');
    } else {
      toast.error('Failed to add to cart');
    }
  };

  const handleAddToWishlist = async (listingId: string) => {
    const success = await addFavorite(listingId);
    if (success) {
      toast.success('Added to wishlist');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-5xl">⏳</span>
      </div>
    );
  }

  if (!sellerProfile) {
    return (
      <div className="min-h-screen bg-background pb-24 flex flex-col items-center justify-center px-4">
        <p className="text-lg font-medium text-foreground mb-4">Seller not found</p>
        <button
          onClick={() => navigate(-1)}
          className="rounded-full bg-primary px-6 py-3 text-primary-foreground font-medium"
        >
          Go Back
        </button>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background pb-24 overflow-hidden flex flex-col" style={{ touchAction: 'pan-x', overscrollBehavior: 'none' }}>
      {/* Header with back button and menu - absolute positioned */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-4 z-20">
        <button
          onClick={() => navigate(-1)}
          className="h-10 w-10 flex items-center justify-center rounded-full bg-card card-shadow"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-10 w-10 flex items-center justify-center rounded-full bg-card card-shadow">
              <MoreVertical className="h-5 w-5 text-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleReportUser}>
              Report user
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={handleBlockUser}
              disabled={hasOutstandingOrder}
              className={hasOutstandingOrder ? 'opacity-50 cursor-not-allowed' : ''}
            >
              Block user
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col items-center px-4 pt-6">
        <div className="relative">
          <div className="h-20 w-20 max-[430px]:h-16 max-[430px]:w-16 max-[375px]:h-14 max-[375px]:w-14 rounded-full p-0.5 bg-gradient-to-br from-muted to-border">
            <img src={getAvatarUrl(sellerProfile.avatar_url) || getDefaultAvatar(sellerProfile.user_id)} alt="Profile" className="h-full w-full rounded-full bg-card object-cover" decoding="async" />
          </div>
        </div>
        <h2 className="mt-3 text-lg max-[430px]:text-base font-semibold text-foreground">{sellerProfile.username || '@seller'}</h2>
        <button
          onClick={() => setReviewsOpen(true)}
          className="mt-2 flex items-center gap-1.5 rounded-full bg-card px-3 py-1 card-shadow hover:bg-muted transition-colors"
        >
          <span className="text-sm">⭐</span>
          <span className="text-sm font-medium text-foreground">
            {sellerProfile.rating && sellerProfile.rating > 0 ? `${sellerProfile.rating}/5` : 'No reviews'}
          </span>
        </button>
      </div>

      <div className="mt-5 max-[430px]:mt-4 max-[393px]:mt-3 max-[375px]:mt-2 flex justify-center items-center gap-2">
        <div className="flex items-center rounded-full bg-muted p-1 w-[220px]">
          <button onClick={() => setActiveTab('listings')} className={`flex w-1/2 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-medium transition-all ${activeTab === 'listings' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            Listings
            {activeListings.length > 0 && (
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold leading-none ${activeTab === 'listings' ? 'bg-muted text-muted-foreground' : 'bg-card text-foreground/70'}`}>
                {activeListings.length}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab('sold')} className={`flex w-1/2 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-medium transition-all ${activeTab === 'sold' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            Sold
            {soldListings.length > 0 && (
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold leading-none ${activeTab === 'sold' ? 'bg-muted text-muted-foreground' : 'bg-card text-foreground/70'}`}>
                {soldListings.length}
              </span>
            )}
          </button>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setViewMode(v => v === 'single' ? 'grid' : 'single')}
          className="h-12 w-12 rounded-xl border-2 border-border bg-card hover:bg-secondary"
        >
          {viewMode === 'single' ? <LayoutGrid className="h-5 w-5" /> : <Rows3 className="h-5 w-5" />}
        </Button>
      </div>

      <div className={`flex-1 min-h-0 flex flex-col ${viewMode === 'single' ? 'justify-center overflow-x-auto overflow-y-hidden snap-x snap-mandatory' : 'overflow-y-auto overflow-x-hidden'} scrollbar-hide py-6 max-[430px]:py-5 max-[393px]:py-4 max-[375px]:py-3`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {listingsLoading ? (
          <div className="flex justify-center py-12">
            <span className="text-5xl">⏳</span>
          </div>
        ) : (() => {
          const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
          const lastSignIn = sellerProfile.last_sign_in_at ? new Date(sellerProfile.last_sign_in_at).getTime() : Date.now();
          const isInactive = (Date.now() - lastSignIn) >= TEN_DAYS_MS;
          if (isInactive) {
            return (
              <div className="flex flex-col items-center justify-center px-4 py-12">
                <span className="text-5xl mb-4">🕰️</span>
                <p className="text-lg font-medium text-muted-foreground">Inactive</p>
                <p className="mt-2 text-sm text-muted-foreground text-center">
                  This seller hasn't been active recently.
                </p>
              </div>
            );
          }
          if (sellerProfile.pause_selling) {
            return (
              <div className="flex flex-col items-center justify-center px-4 py-12">
                <span className="text-5xl mb-4">⏸️</span>
                <p className="text-lg font-medium text-muted-foreground">Paused</p>
                <p className="mt-2 text-sm text-muted-foreground text-center">
                  This seller has temporarily paused their listings.
                </p>
              </div>
            );
          }
          return null;
        })() || (displayListings.length > 0 ? (
          viewMode === 'single' ? (
            <div className="flex gap-4 max-[430px]:gap-3 max-[375px]:gap-2.5">
              <div className="flex-shrink-0 w-[calc(50vw-128px)] max-[430px]:w-[calc(50vw-120px)] max-[393px]:w-[calc(50vw-104px)] max-[375px]:w-[calc(50vw-88px)]" />
              {displayListings.map((listing) => {
                const realId = listing.id.includes('::') ? listing.id.split('::')[0] : listing.id;
                return (
                <div key={listing.id} className="relative w-64 max-[430px]:w-60 max-[393px]:w-52 max-[375px]:w-44 flex-shrink-0 overflow-hidden rounded-3xl max-[375px]:rounded-2xl bg-card p-2.5 max-[430px]:p-2 max-[375px]:p-1.5 card-shadow snap-center">
                  <div 
                    className="aspect-[3/4] max-[430px]:aspect-[3/4] max-[393px]:aspect-[4/5] max-[375px]:aspect-[1/1] w-full overflow-hidden rounded-2xl max-[375px]:rounded-xl cursor-pointer"
                    onClick={() => navigate(`/listing/${realId}`)}
                  >
                    <img src={listing.images[0]} alt={listing.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="px-2 max-[393px]:px-1.5 max-[375px]:px-1 pt-3 max-[393px]:pt-1.5 max-[375px]:pt-1.5 pb-2.5 max-[393px]:pb-2 max-[375px]:pb-1.5">
                    <div className="flex items-end justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base max-[393px]:text-sm max-[375px]:text-xs font-semibold text-foreground truncate">{listing.title}</h3>
                        <div className="mt-1.5 max-[393px]:mt-0.5 max-[375px]:mt-0.5 flex flex-nowrap gap-1.5 max-[393px]:gap-1 max-[375px]:gap-1 overflow-x-auto scrollbar-hide">
                          <span className="rounded-full bg-muted px-2.5 max-[393px]:px-1.5 max-[375px]:px-1.5 py-0.5 text-xs max-[393px]:text-[10px] max-[375px]:text-[9px] font-medium text-muted-foreground whitespace-nowrap">
                            {formatTagLabel(listing.size, true)}
                          </span>
                          <span className="rounded-full bg-muted px-2.5 max-[393px]:px-1.5 max-[375px]:px-1.5 py-0.5 text-xs max-[393px]:text-[10px] max-[375px]:text-[9px] font-medium text-muted-foreground whitespace-nowrap">
                            {listing.brand}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-1.5 max-[393px]:ml-0.5 max-[375px]:ml-0.5">
                        <p className="text-lg max-[393px]:text-base max-[375px]:text-sm font-bold text-foreground leading-none">${listing.price}</p>
                        <p className="text-xs max-[393px]:text-[10px] max-[375px]:text-[9px] text-muted-foreground whitespace-nowrap leading-tight mt-0.5">📦 +${listing.shipping_price || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
              <div className="flex-shrink-0 w-[calc(50vw-128px)] max-[430px]:w-[calc(50vw-120px)] max-[393px]:w-[calc(50vw-104px)] max-[375px]:w-[calc(50vw-88px)]" />
            </div>
          ) : (
            <div className="w-full px-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                {displayListings.map((listing) => (
                  <ProfileGridCard
                    key={listing.id}
                    listing={listing}
                    activeTab={activeTab}
                  />
                ))}
              </div>
              <div className="h-4" />
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-12">
            <p className="text-muted-foreground">{activeTab === 'listings' ? 'No listings yet' : 'No sold items yet'}</p>
          </div>
        ))}
      </div>

      <ReviewsDrawer
        userId={sellerProfile.user_id}
        username={sellerProfile.username}
        open={reviewsOpen}
        onOpenChange={setReviewsOpen}
      />

      <ReportDialog
        open={!!pendingReport}
        onOpenChange={(v) => { if (!v) closeReport(); }}
        onSubmit={submitPendingReport}
        isSubmitting={isReporting}
        reportType={pendingReport?.reportType || 'user'}
      />

      <BottomNav />
    </div>
  );
};

export default SellerProfile;
