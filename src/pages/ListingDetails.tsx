import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { MapPin, MoreVertical, Flag, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import ListingTag from '@/components/ListingTag';
import ListingComments from '@/components/ListingComments';
import { supabase } from '@/lib/supabase';
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
  country_code: string | null;
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
  // Check if we came from the favorites/wishlist page
  const fromWishlist = location.state?.fromWishlist || false;

  // All hooks must be called before any conditional returns
  const { addFavorite, removeFavorite, isFavorite } = useFavorites();
  const { addToCart, removeFromCart, isInCart } = useCart();
  const { addDiscarded } = useDiscardedListings();

  // Confirmation dialog states
  const [showRemoveFromCartDialog, setShowRemoveFromCartDialog] = useState(false);
  const [showRemoveFromWishlistDialog, setShowRemoveFromWishlistDialog] = useState(false);

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
        .select('username, avatar_url, location, country_code')
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
        <span className="text-5xl">⏳</span>
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
  
  // Get location from country_code, with mapping for display
  const getLocationDisplay = (countryCode: string | null | undefined): string => {
    if (!countryCode) return 'Unknown';
    const countryNames: Record<string, string> = {
      AU: 'Australia',
      NZ: 'New Zealand',
      GB: 'United Kingdom',
      US: 'United States',
      CA: 'Canada',
      // EU countries
      AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', HR: 'Croatia', CY: 'Cyprus',
      CZ: 'Czech Republic', DK: 'Denmark', EE: 'Estonia', FI: 'Finland', FR: 'France',
      DE: 'Germany', GR: 'Greece', HU: 'Hungary', IE: 'Ireland', IT: 'Italy',
      LV: 'Latvia', LT: 'Lithuania', LU: 'Luxembourg', MT: 'Malta', NL: 'Netherlands',
      PL: 'Poland', PT: 'Portugal', RO: 'Romania', SK: 'Slovakia', SI: 'Slovenia',
      ES: 'Spain', SE: 'Sweden',
    };
    return countryNames[countryCode] || countryCode;
  };
  
  const sellerLocation = getLocationDisplay(seller?.country_code);

  const handleWishlistClick = async () => {
    if (isFavorite(listing.id)) {
      setShowRemoveFromWishlistDialog(true);
      return;
    }
    const success = await addFavorite(listing.id);
    if (success) {
      toast.success('Added to wishlist!');
      handleClose();
    }
  };

  const handleRemoveFromWishlist = async () => {
    const success = await removeFavorite(listing.id);
    if (success) {
      toast.success('Removed from wishlist');
    }
    setShowRemoveFromWishlistDialog(false);
  };

  const handleCartClick = () => {
    if (isInCart(listing.id)) {
      setShowRemoveFromCartDialog(true);
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
    handleClose();
  };

  const handleRemoveFromCart = async () => {
    const success = await removeFromCart(listing.id);
    if (success) {
      toast.success('Removed from cart');
    }
    setShowRemoveFromCartDialog(false);
  };

  const handleDiscard = async () => {
    // If the item is in the wishlist, remove it from wishlist instead of just discarding
    if (isFavorite(listing.id)) {
      const success = await removeFavorite(listing.id);
      if (success) {
        toast.success('Removed from wishlist');
      }
    } else {
      await addDiscarded(listing.id);
      toast.success('Item discarded');
    }
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

              {/* 3-dot menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="absolute top-3 right-3 h-8 w-8 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center hover:bg-background/90 transition-colors">
                    <MoreVertical className="h-4 w-4 text-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 bg-background border border-border rounded-xl shadow-lg z-50">
                  <DropdownMenuItem 
                    onClick={() => {
                      toast.info('Listing reported. We will review it shortly.');
                    }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Flag className="h-4 w-4" />
                    Report listing
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={async () => {
                      const shareUrl = `${window.location.origin}/listing/${listing.id}`;
                      if (navigator.share) {
                        try {
                          await navigator.share({
                            title: listing.title,
                            text: `Check out this listing: ${listing.title}`,
                            url: shareUrl,
                          });
                        } catch (err) {
                          if ((err as Error).name !== 'AbortError') {
                            await navigator.clipboard.writeText(shareUrl);
                            toast.success('Link copied to clipboard!');
                          }
                        }
                      } else {
                        await navigator.clipboard.writeText(shareUrl);
                        toast.success('Link copied to clipboard!');
                      }
                    }}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Share2 className="h-4 w-4" />
                    Share listing
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

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
                    <p className="font-bold text-foreground text-sm underline">{sellerName}</p>
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
              onClick={handleDiscard}
              className="h-14 w-14 rounded-2xl border-2 text-2xl bg-transparent active:bg-[#ddfed7] active:border-[#ddfed7]"
            >
              ❌
            </Button>

            {!isSold && (
              <>
                <Button
                  variant="outline"
                  onClick={handleWishlistClick}
                  className={`h-14 w-14 rounded-2xl border-2 text-2xl transition-colors ${
                    isFavorite(listing.id) 
                      ? 'bg-[#ddfed7] border-[#ddfed7]' 
                      : 'bg-transparent active:bg-[#ddfed7] active:border-[#ddfed7]'
                  }`}
                >
                  💌
                </Button>

                <Button
                  variant="outline"
                  onClick={handleCartClick}
                  className={`h-14 w-14 rounded-2xl border-2 text-2xl transition-colors ${
                    isInCart(listing.id) 
                      ? 'bg-[#ddfed7] border-[#ddfed7]' 
                      : 'bg-transparent active:bg-[#ddfed7] active:border-[#ddfed7]'
                  }`}
                >
                  🛒
                </Button>
              </>
            )}
          </div>

          {/* Remove from Wishlist Confirmation */}
          <AlertDialog open={showRemoveFromWishlistDialog} onOpenChange={setShowRemoveFromWishlistDialog}>
            <AlertDialogContent className="max-w-[280px] rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Remove from Wishlist?</AlertDialogTitle>
                <AlertDialogDescription>
                  This item will be removed from your wishlist.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row gap-2">
                <AlertDialogCancel className="flex-1 mt-0">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemoveFromWishlist} className="flex-1 bg-destructive hover:bg-destructive/90">
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Remove from Cart Confirmation */}
          <AlertDialog open={showRemoveFromCartDialog} onOpenChange={setShowRemoveFromCartDialog}>
            <AlertDialogContent className="max-w-[280px] rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Remove from Cart?</AlertDialogTitle>
                <AlertDialogDescription>
                  This item will be removed from your cart.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row gap-2">
                <AlertDialogCancel className="flex-1 mt-0">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemoveFromCart} className="flex-1 bg-destructive hover:bg-destructive/90">
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default ListingDetails;
