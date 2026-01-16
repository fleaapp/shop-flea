import { useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import BottomNav from '@/components/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { formatTagLabel } from '@/components/ListingTag';
import { useCart } from '@/context/CartContext';
import { useFavorites } from '@/hooks/useFavorites';
import { toast } from 'sonner';
import { Listing } from '@/types/listing';

interface SellerProfile {
  user_id: string;
  username: string;
  avatar_url: string | null;
  rating: number | null;
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
  
  const { addToCart, isInCart } = useCart();
  const { addFavorite, isFavorite } = useFavorites();

  useEffect(() => {
    if (sellerId) {
      fetchSellerData();
    }
  }, [sellerId]);

  const fetchSellerData = async () => {
    if (!sellerId) return;
    
    setLoading(true);
    setListingsLoading(true);

    // Fetch seller profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, username, avatar_url, rating')
      .eq('user_id', sellerId)
      .single();

    if (profileError) {
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

    // Fetch sold listings
    const { data: soldData } = await supabase
      .from('listings')
      .select('*')
      .eq('user_id', sellerId)
      .eq('status', 'sold');

    if (soldData) {
      setSoldListings(soldData);
    }

    setListingsLoading(false);
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
      sellerAvatar: sellerProfile?.avatar_url || '',
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
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
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
      <div className="flex flex-col items-center px-4 pt-6">
        <div className="relative">
          <div className="h-20 w-20 max-[430px]:h-16 max-[430px]:w-16 max-[375px]:h-14 max-[375px]:w-14 rounded-full p-0.5 bg-gradient-to-br from-muted to-border">
            <img src={sellerProfile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sellerProfile.user_id}`} alt="Profile" className="h-full w-full rounded-full bg-card object-cover" />
          </div>
        </div>
        <h2 className="mt-3 text-lg max-[430px]:text-base font-semibold text-foreground">{sellerProfile.username || '@seller'}</h2>
        <div className="mt-2 flex items-center gap-1.5 rounded-full bg-card px-3 py-1 card-shadow">
          <span className="text-sm">⭐</span>
          <span className="text-sm font-medium text-foreground">
            {sellerProfile.rating && sellerProfile.rating > 0 ? `${sellerProfile.rating}/5` : 'No reviews'}
          </span>
        </div>
      </div>

      <div className="mt-5 max-[430px]:mt-4 max-[393px]:mt-3 max-[375px]:mt-2 flex justify-center items-center">
        <div className="flex items-center rounded-full bg-muted p-1">
          <button onClick={() => setActiveTab('listings')} className={`rounded-full w-24 py-2.5 text-sm font-medium transition-all ${activeTab === 'listings' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            Listings
          </button>
          <button onClick={() => setActiveTab('sold')} className={`rounded-full w-24 py-2.5 text-sm font-medium transition-all ${activeTab === 'sold' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
            Sold
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-center overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-hide py-6 max-[430px]:py-5 max-[393px]:py-4 max-[375px]:py-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {listingsLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : displayListings.length > 0 ? (
          <div className="flex gap-4 max-[430px]:gap-3 max-[375px]:gap-2.5" style={{ paddingLeft: 'calc(50% - min(128px, 35vw))', paddingRight: 'calc(50% - min(128px, 35vw))' }}>
            {displayListings.map((listing) => (
              <div key={listing.id} className="relative w-64 max-[430px]:w-60 max-[393px]:w-52 max-[375px]:w-44 flex-shrink-0 overflow-hidden rounded-3xl max-[375px]:rounded-2xl bg-card p-2.5 max-[430px]:p-2 max-[375px]:p-1.5 card-shadow snap-center">
                {/* Image */}
                <div 
                  className="aspect-[3/4] max-[430px]:aspect-[3/4] max-[393px]:aspect-[4/5] max-[375px]:aspect-[1/1] w-full overflow-hidden rounded-2xl max-[375px]:rounded-xl cursor-pointer"
                  onClick={() => navigate(`/listing/${listing.id}`)}
                >
                  <img src={listing.images[0]} alt={listing.title} className="h-full w-full object-cover" />
                </div>
                
                {/* Content */}
                <div className="px-2 max-[393px]:px-1.5 max-[375px]:px-1 pt-3 max-[393px]:pt-1.5 max-[375px]:pt-1.5 pb-1 max-[393px]:pb-0.5 max-[375px]:pb-0.5">
                  <div className="flex items-end justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base max-[393px]:text-sm max-[375px]:text-xs font-semibold text-foreground truncate">{listing.title}</h3>
                      <div className="mt-1.5 max-[393px]:mt-0.5 max-[375px]:mt-0.5 flex flex-nowrap gap-1.5 max-[393px]:gap-1 max-[375px]:gap-1">
                        <span className="rounded-full bg-muted px-2.5 max-[393px]:px-1.5 max-[375px]:px-1.5 py-0.5 text-xs max-[393px]:text-[10px] max-[375px]:text-[9px] font-medium text-muted-foreground whitespace-nowrap">
                          {formatTagLabel(listing.size, true)}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 max-[393px]:px-1.5 max-[375px]:px-1.5 py-0.5 text-xs max-[393px]:text-[10px] max-[375px]:text-[9px] font-medium text-muted-foreground truncate">
                          {listing.brand}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3 max-[393px]:ml-1.5 max-[375px]:ml-1.5">
                      <p className="text-lg max-[393px]:text-base max-[375px]:text-sm font-bold text-foreground">${listing.price}</p>
                      <p className="text-xs max-[393px]:text-[10px] max-[375px]:text-[9px] text-muted-foreground whitespace-nowrap">+ ${listing.shipping_price || 0} ship</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-12">
            <p className="text-muted-foreground">{activeTab === 'listings' ? 'No listings yet' : 'No sold items yet'}</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default SellerProfile;