import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import ListingTag from '@/components/ListingTag';
import ListingComments from '@/components/ListingComments';
import { supabase } from '@/integrations/supabase/client';
import { useFavorites } from '@/hooks/useFavorites';
import { useCart } from '@/context/CartContext';
import { useDiscardedListings } from '@/hooks/useDiscardedListings';

interface DbListing {
  id: string;
  title: string;
  description: string | null;
  brand: string;
  size: string;
  price: number;
  shipping_price: number | null;
  images: string[];
  tags: string[] | null;
  condition: string;
  colour: string | null;
  style: string | null;
  gender: string | null;
  category: string;
  user_id: string;
}

interface SellerProfile {
  username: string;
  avatar_url: string | null;
  location: string | null;
}

const ListingDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [open, setOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [listing, setListing] = useState<DbListing | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Check if listing is sold (passed from navigation state)
  const isSold = location.state?.isSold || false;

  // All hooks must be called before any conditional returns
  const { addFavorite, isFavorite } = useFavorites();
  const { addToCart, isInCart } = useCart();
  const { addDiscarded } = useDiscardedListings();

  useEffect(() => {
    const fetchListing = async () => {
      if (!id) return;
      
      // First fetch the listing
      const { data: listingData, error: listingError } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (listingError || !listingData) {
        console.error('Error fetching listing:', listingError);
        setLoading(false);
        return;
      }
      
      setListing(listingData);
      
      // Then fetch the seller's profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username, avatar_url, location')
        .eq('user_id', listingData.user_id)
        .maybeSingle();
      
      setSeller(profileData);
      setLoading(false);
    };
    
    fetchListing();
  }, [id]);

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => navigate(-1), 300);
  };

  useEffect(() => {
    setOpen(true);
    setActiveImageIndex(0);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0 });
    });
  }, [id]);

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => {
      setActiveImageIndex(carouselApi.selectedScrollSnap());
    };
    onSelect();
    carouselApi.on('select', onSelect);
    return () => {
      carouselApi.off('select', onSelect);
    };
  }, [carouselApi]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Listing not found</p>
      </div>
    );
  }

  const images = listing.images?.length ? listing.images : [];
  const sellerName = seller?.username || '@user';
  const sellerAvatar = seller?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${listing.id}`;
  const sellerLocation = seller?.location || 'Unknown';

  const handleAddToWishlist = async () => {
    if (isFavorite(listing.id)) {
      toast.info('Already in wishlist');
      return;
    }
    const success = await addFavorite(listing.id);
    if (success) {
      toast.success('Added to wishlist!');
    }
  };

  const handleAddToCart = () => {
    if (isInCart(listing.id)) {
      toast.info('Already in cart');
      return;
    }
    // Convert DB listing to Listing type for cart
    addToCart({
      id: listing.id,
      title: listing.title,
      price: listing.price,
      shippingPrice: listing.shipping_price || 0,
      description: listing.description || '',
      image: listing.images?.[0] || '',
      images: listing.images,
      category: listing.category,
      size: listing.size,
      brand: listing.brand,
      tags: listing.tags || [],
      sellerId: listing.user_id,
      sellerName: seller?.username || 'Unknown',
      sellerAvatar: sellerAvatar,
      location: sellerLocation,
      createdAt: new Date(),
      condition: listing.condition as 'new' | 'like-new' | 'good' | 'fair',
    });
    toast.success('Added to cart!');
  };

  const handleDiscard = async () => {
    await addDiscarded(listing.id);
    toast.success('Item discarded');
    handleClose();
  };

  return (
    <div className="min-h-screen bg-background">
      <Drawer open={open} onOpenChange={isOpen => !isOpen && handleClose()}>
        <DrawerContent className="mt-0 h-[95dvh] max-h-[95dvh] overflow-hidden rounded-t-3xl bg-background">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-8">
            {/* Image Gallery (swipe) */}
            <div className="relative overflow-hidden rounded-3xl">
              <Carousel setApi={setCarouselApi} opts={{ loop: images.length > 1 }} className="w-full">
                <CarouselContent className="ml-0">
                  {images.map((src, index) => (
                    <CarouselItem key={`${listing.id}-img-${index}`} className="pl-0">
                      <img
                        src={src}
                        alt={`${listing.title} photo ${index + 1}`}
                        className="aspect-square w-full object-cover"
                        loading={index === 0 ? 'eager' : 'lazy'}
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>

              {images.length > 1 && (
                <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-background/70 px-2 py-1 text-xs text-foreground">
                  {activeImageIndex + 1}/{images.length}
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="mt-4 gap-2 flex flex-row overflow-x-auto scrollbar-hide">
              <ListingTag label={listing.size} isSize variant="muted" />
              <ListingTag label={listing.brand} variant="muted" />
              <ListingTag label={listing.condition} variant="muted" />
              {listing.gender && <ListingTag label={listing.gender} variant="muted" />}
              {listing.colour && <ListingTag label={listing.colour} variant="muted" />}
              {listing.style && <ListingTag label={listing.style} variant="muted" />}
              <ListingTag label={listing.category} variant="muted" />
            </div>

            {/* Content */}
            <div className="pt-4">
              {/* Title */}
              <h1 className="text-2xl font-bold text-foreground">{listing.title}</h1>

              {/* Description */}
              {listing.description && (
                <p className="mt-4 text-muted-foreground leading-relaxed">{listing.description}</p>
              )}

              {/* Seller Info + Price Row */}
              <div className="mt-6 flex items-center justify-between gap-3">
                {/* Seller Card */}
                <div 
                  className="flex items-center gap-2 rounded-2xl bg-card p-2.5 pr-6 card-shadow cursor-pointer active:scale-[0.98] transition-transform"
                  onClick={() => {
                    setOpen(false);
                    setTimeout(() => navigate(`/seller/${listing.user_id}`), 300);
                  }}
                >
                  <img
                    src={sellerAvatar}
                    alt={sellerName}
                    className="h-9 w-9 rounded-full bg-muted flex-shrink-0"
                    loading="lazy"
                  />
                  <div>
                    <p className="font-medium text-foreground text-sm">{sellerName}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      <span>{sellerLocation}</span>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">${listing.price}</p>
                  <p className="text-xs text-muted-foreground">+ ${listing.shipping_price || 0} shipping</p>
                </div>
              </div>

              {/* Comments Section */}
              <ListingComments listingId={listing.id} sellerId={listing.user_id} />

            </div>
          </div>

          {/* Sticky Footer Actions */}
          <div className="sticky bottom-0 left-0 right-0 flex gap-3 bg-background px-4 py-4 border-t border-border justify-center">
            <Button
              variant="outline"
              onClick={() => { handleDiscard(); }}
              className="h-14 w-14 rounded-2xl border-2 text-2xl bg-transparent active:bg-[#ddfed7] active:border-[#ddfed7]"
            >
              ❌
            </Button>

            {!isSold && (
              <>
                <Button
                  variant="outline"
                  onClick={() => { handleAddToWishlist(); handleClose(); }}
                  className="h-14 w-14 rounded-2xl border-2 text-2xl bg-transparent active:bg-[#ddfed7] active:border-[#ddfed7]"
                >
                  💌
                </Button>

                <Button
                  variant="outline"
                  onClick={() => { handleAddToCart(); handleClose(); }}
                  className="h-14 w-14 rounded-2xl border-2 text-2xl bg-transparent active:bg-[#ddfed7] active:border-[#ddfed7]"
                >
                  🛒
                </Button>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default ListingDetails;
