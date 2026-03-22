import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { MapPin, MoreVertical, Flag, Share2, User } from 'lucide-react';
import { toast } from 'sonner';
import { getDefaultAvatar } from '@/utils/defaultAvatars';
import { getDetailImageUrl, getAvatarUrl } from '@/utils/optimizedImage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { useReporting } from '@/hooks/useReporting';
import ReportDialog from '@/components/ReportDialog';
import { useAuth } from '@/context/AuthContext';
import { useOrders, OrderGroup } from '@/hooks/useOrders';
import SalesDetailsSheet from '@/components/SalesDetailsSheet';
import OrderSuccessDialog from '@/components/OrderSuccessDialog';
import OrderReceiptDialog from '@/components/OrderReceiptDialog';
import { canOpenListing } from '@/utils/listingAccess';
import { loadSavedListingSnapshot } from '@/utils/savedListingSnapshots';
import type { Listing } from '@/types/listing';

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
  status?: string;
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
  const { user } = useAuth();
  const { openReport, submitPendingReport, closeReport, pendingReport, isReporting } = useReporting();
  const [open, setOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [listing, setListing] = useState<DbListing | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [listingStatus, setListingStatus] = useState<string>(location.state?.isRemoved ? 'removed' : 'active');
  const [showRemoveFromBothDialog, setShowRemoveFromBothDialog] = useState(false);
  
  // Check if listing is sold - check both navigation state AND database status
  const isSold = location.state?.isSold || listingStatus === 'sold';
  const isRemoved = location.state?.isRemoved || listingStatus === 'removed' || listingStatus === 'deleted' || (listingStatus !== 'active' && listingStatus !== 'sold');
  // Check if we came from the favorites/wishlist page
  const fromWishlist = location.state?.fromWishlist || false;

  // All hooks must be called before any conditional returns
  const { addFavorite, removeFavorite, isFavorite } = useFavorites();
  const { addToCart, removeFromCart, isInCart } = useCart();
  const { addDiscarded } = useDiscardedListings();

  // Confirmation dialog states
  const [showRemoveFromCartDialog, setShowRemoveFromCartDialog] = useState(false);
  const [showRemoveFromWishlistDialog, setShowRemoveFromWishlistDialog] = useState(false);
  const [showMarkAsSoldDialog, setShowMarkAsSoldDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [salesSheetOpen, setSalesSheetOpen] = useState(false);
  const [selectedOrderGroup, setSelectedOrderGroup] = useState<OrderGroup | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [isTextInputFocused, setIsTextInputFocused] = useState(false);

  const isOwner = user?.id === listing?.user_id;

  // Fetch seller orders for own sold listings
  const { sellerOrders, sellerOrderGroups, markAsShipped } = useOrders();

  useEffect(() => {
    const fetchListing = async () => {
      if (!id) return;

      const stateListing = location.state?.listing as (Partial<DbListing> & {
        image?: string;
        shippingPrice?: number;
        sellerId?: string;
        sellerName?: string;
        sellerAvatar?: string;
        location?: string;
      }) | undefined;

      const hydrateFromState = (forcedStatus: 'removed' | 'sold' = 'removed') => {
        if (!stateListing) return false;

        const fallbackImages = stateListing.images?.length
          ? stateListing.images
          : stateListing.image
            ? [stateListing.image]
            : [];

        setListing({
          id: id,
          title: stateListing.title || 'Removed listing',
          description: stateListing.description ?? '',
          brand: stateListing.brand || '',
          size: stateListing.size || '',
          price: Number(stateListing.price ?? 0),
          shipping_price: Number(stateListing.shipping_price ?? stateListing.shippingPrice ?? 0),
          images: fallbackImages,
          tags: stateListing.tags || [],
          condition: stateListing.condition || 'good',
          colour: stateListing.colour ?? null,
          style: stateListing.style ?? null,
          gender: stateListing.gender ?? null,
          category: stateListing.category || '',
          user_id: stateListing.user_id || stateListing.sellerId || 'unknown',
          status: forcedStatus,
        });

        setSeller({
          username: stateListing.sellerName || 'Unknown',
          avatar_url: stateListing.sellerAvatar || null,
          location: stateListing.location || null,
          country_code: null,
        });

        setListingStatus(forcedStatus);
        setLoading(false);
        return true;
      };

      const hydrateFromSnapshot = () => {
        if (!user || !id) return false;

        const snapshot = loadSavedListingSnapshot(user.id, id);
        if (!snapshot) return false;

        setListing({
          id: snapshot.listing.id,
          title: snapshot.listing.title || 'Removed listing',
          description: snapshot.listing.description ?? '',
          brand: snapshot.listing.brand || '',
          size: snapshot.listing.size || '',
          price: Number(snapshot.listing.price ?? 0),
          shipping_price: Number(snapshot.listing.shipping_price ?? 0),
          images: snapshot.listing.images ?? [],
          tags: snapshot.listing.tags ?? [],
          condition: snapshot.listing.condition || 'good',
          colour: snapshot.listing.colour ?? null,
          style: snapshot.listing.style ?? null,
          gender: snapshot.listing.gender ?? null,
          category: snapshot.listing.category || '',
          user_id: snapshot.listing.user_id || 'unknown',
          status: 'removed',
        });

        setSeller(snapshot.seller
          ? {
              username: snapshot.seller.username || 'Unknown Seller',
              avatar_url: snapshot.seller.avatar_url,
              location: snapshot.seller.location,
              country_code: null,
            }
          : null);

        setListingStatus('removed');
        setLoading(false);
        return true;
      };
      
      // First fetch the listing
      const { data: listingData, error: listingError } = await supabase
        .from('listings')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (listingError || !listingData) {
        if (hydrateFromState('removed') || hydrateFromSnapshot()) {
          return;
        }
        console.error('Error fetching listing:', listingError);
        setLoading(false);
        return;
      }
      
      const status = listingData.status || 'active';
      let normalizedListing = listingData;
      setListingStatus(status);

      // For removed/deleted listings, still allow rendering (user sees ⛔️ UI)
      const isRemovedListing = status !== 'active' && status !== 'sold';

      if (!isRemovedListing) {
        // If listing is not generally accessible anymore, keep details but force removed state for saved-item cleanup
        const listingIsAccessible = await canOpenListing(listingData.id);

        if (!listingIsAccessible) {
          normalizedListing = { ...listingData, status: 'removed' };
          setListingStatus('removed');
        }
      }

      setListing(normalizedListing);
      
      // Then fetch the seller's profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('username, avatar_url, location, country_code')
        .eq('user_id', listingData.user_id)
        .maybeSingle();
      
      // If country_code column doesn't exist, retry without it
      if (profileError?.code === '42703') {
        const { data: fallbackProfile } = await supabase
          .from('profiles')
          .select('username, avatar_url, location')
          .eq('user_id', listingData.user_id)
          .maybeSingle();
        setSeller(fallbackProfile ? { ...fallbackProfile, country_code: null } : null);
      } else {
        setSeller(profileData);
      }
      
      setLoading(false);
    };
    
    fetchListing();
  }, [id, location.state, user?.id]);

  // Fetch cart and wishlist counts for this listing
  useEffect(() => {
    const fetchCounts = async () => {
      if (!id) return;
      const [cartRes, favRes] = await Promise.all([
        supabase.from('cart_items').select('id', { count: 'exact', head: true }).eq('listing_id', id),
        supabase.from('favorites').select('id', { count: 'exact', head: true }).eq('listing_id', id),
      ]);
      setCartCount(cartRes.count ?? 0);
      setWishlistCount(favRes.count ?? 0);
    };
    fetchCounts();
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

  useEffect(() => {
    const isTextEntryElement = (element: Element | null): boolean => {
      if (!(element instanceof HTMLElement)) return false;

      if (element.tagName === 'TEXTAREA' || element.isContentEditable) {
        return true;
      }

      if (element.tagName === 'INPUT') {
        const input = element as HTMLInputElement;
        const nonTextTypes = new Set([
          'button',
          'checkbox',
          'color',
          'file',
          'hidden',
          'image',
          'radio',
          'range',
          'reset',
          'submit',
        ]);

        return !nonTextTypes.has(input.type);
      }

      return false;
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (isTextEntryElement(event.target as Element | null)) {
        setIsTextInputFocused(true);
      }
    };

    const handleFocusOut = () => {
      requestAnimationFrame(() => {
        setIsTextInputFocused(isTextEntryElement(document.activeElement));
      });
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

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
  const sellerAvatar = getAvatarUrl(seller?.avatar_url) || getDefaultAvatar(listing.user_id || listing.id);
  
  // Get location from country_code, with mapping for display
  const getLocationDisplay = (countryCode: string | null | undefined, fallbackLocation: string | null | undefined): string => {
    if (countryCode) {
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
    }
    // Fallback to location field if country_code not available
    return fallbackLocation || 'Unknown';
  };
  
  const sellerLocation = getLocationDisplay(seller?.country_code, seller?.location);

  const handleWishlistClick = async () => {
    if (isFavorite(listing.id)) {
      setShowRemoveFromWishlistDialog(true);
      return;
    }
    // Prevent adding sold items to wishlist
    if (isSold) {
      toast.error('This item has already been sold');
      return;
    }

    const success = await addFavorite(listing.id, {
      id: listing.id,
      title: listing.title,
      price: Number(listing.price ?? 0),
      shippingPrice: Number(listing.shipping_price ?? 0),
      description: listing.description || '',
      image: listing.images?.[0] || '',
      images: listing.images || [],
      category: listing.category || '',
      size: listing.size || '',
      brand: listing.brand || '',
      tags: listing.tags || [],
      sellerId: listing.user_id,
      sellerName: seller?.username || 'Unknown Seller',
      sellerAvatar,
      location: sellerLocation,
      createdAt: new Date(),
      condition: (listing.condition as Listing['condition']) || 'good',
      status: listing.status || listingStatus,
    });

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
    // Prevent adding sold items to cart
    if (isSold) {
      toast.error('This item has already been sold');
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
      <Drawer open={open} onOpenChange={isOpen => !isOpen && handleClose()} repositionInputs={false}>
        <DrawerContent className="mt-0 flex h-[95svh] max-h-[95svh] flex-col overflow-hidden rounded-t-3xl bg-background">
          <div ref={scrollRef} className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 ${isTextInputFocused ? 'pb-4' : 'pb-32'}`}>
            {/* Image Gallery (swipe) */}
            <div className="relative overflow-hidden rounded-3xl">
              <Carousel setApi={setCarouselApi} opts={{ loop: images.length > 1 }} className="w-full">
                <CarouselContent className="ml-0">
                  {images.map((src, index) => (
                    <CarouselItem key={`${listing.id}-img-${index}`} className="pl-0">
                      <img
                        src={getDetailImageUrl(src)}
                        alt={`${listing.title} photo ${index + 1}`}
                        className="aspect-[4/5] w-full object-cover"
                        loading={index === 0 ? 'eager' : 'lazy'}
                        decoding="async"
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
                  {!isOwner && (
                    <>
                      <DropdownMenuItem 
                        onClick={() => openReport('listing', listing.id, listing.user_id)}
                        disabled={isReporting}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Flag className="h-4 w-4" />
                        Report listing
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => openReport('user', listing.user_id, listing.user_id)}
                        disabled={isReporting}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <User className="h-4 w-4" />
                        Report seller
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
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

              {/* Cart & Wishlist count icons */}
              {(cartCount > 0 || wishlistCount > 0) && (
                <div className="absolute top-3 left-3 flex flex-col items-center gap-2">
                  {cartCount > 0 && (
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center text-sm">
                        🛒
                      </div>
                      <span className="text-[10px] font-semibold text-foreground mt-0.5 bg-background/70 backdrop-blur-sm rounded-full px-1.5 leading-tight">
                        {cartCount}
                      </span>
                    </div>
                  )}
                  {wishlistCount > 0 && (
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center text-sm">
                        💌
                      </div>
                      <span className="text-[10px] font-semibold text-foreground mt-0.5 bg-background/70 backdrop-blur-sm rounded-full px-1.5 leading-tight">
                        {wishlistCount}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {images.length > 1 && (
                <div className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-background/70 px-2 py-1 text-xs text-foreground">
                  {activeImageIndex + 1}/{images.length}
                </div>
              )}
            </div>

            {/* Primary Tags – Size, Condition, Brand */}
            <div className="mt-4 flex justify-between gap-3">
              {[
                { label: 'Size', value: listing.size, isSize: true },
                { label: 'Condition', value: listing.condition },
                { label: 'Brand', value: listing.brand },
              ].map((tag) => (
                <div
                  key={tag.label}
                  className="flex-1 flex flex-col items-center justify-center rounded-lg bg-muted-foreground/20 px-2 py-2.5"
                >
                  <span className="text-[10px] font-bold text-muted-foreground leading-tight">{tag.label}</span>
                  <span className="text-xs font-medium text-muted-foreground leading-snug mt-0.5 text-center">
                    {tag.isSize ? (tag.value.includes('"') ? tag.value.toUpperCase() : `AU ${tag.value.toUpperCase()}`) : tag.value.charAt(0).toUpperCase() + tag.value.slice(1)}
                  </span>
                </div>
              ))}
            </div>

            {/* Secondary Tags – remaining filters */}
            {(() => {
              const secondary: { label: string; isColour?: boolean }[] = [];
              // Split comma-separated colours into individual tags
              if (listing.colour) {
                listing.colour.split(',').map(c => c.trim()).filter(Boolean).forEach(c => {
                  secondary.push({ label: c, isColour: true });
                });
              }
              // Split comma-separated styles into individual tags
              if (listing.style) {
                listing.style.split(',').map(s => s.trim()).filter(Boolean).forEach(s => {
                  secondary.push({ label: s });
                });
              }
              if (listing.category) secondary.push({ label: listing.category });
              if (listing.gender) secondary.push({ label: listing.gender });
              if (secondary.length === 0) return null;
              return (
                <div className="mt-2 gap-2 flex flex-row overflow-x-auto scrollbar-hide">
                  {secondary.map((tag, idx) => (
                    <ListingTag key={`${tag.label}-${idx}`} label={tag.label} variant="muted" colourSwatch={tag.isColour ? tag.label : undefined} />
                  ))}
                </div>
              );
            })()}

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
                    setTimeout(() => navigate(user?.id === listing.user_id ? '/profile' : `/seller/${listing.user_id}`), 300);
                  }}
                >
                  <img
                    src={sellerAvatar}
                    alt={sellerName}
                    className="h-9 w-9 rounded-full bg-muted flex-shrink-0"
                    loading="eager"
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
          {!isTextInputFocused && (
          <div className="left-0 right-0 z-10 flex shrink-0 justify-center gap-3 border-t border-border bg-background px-4 py-4 transition-all duration-200">
            {isRemoved && !isOwner ? (
              // Removed listing footer
              <div className="flex flex-col items-center gap-3">
                <span className="text-sm font-bold text-muted-foreground">
                  ⛔️ Item removed
                </span>
                <Button
                  variant="outline"
                  onClick={() => setShowRemoveFromBothDialog(true)}
                  className="h-14 w-14 rounded-2xl border-2 text-2xl bg-transparent"
                >
                  ❌
                </Button>
              </div>
            ) : isOwner ? (
              // Owner footer
              isSold ? (
                // Sold listing owner footer
                <div className="flex flex-col items-center gap-3.5">
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setShowReceiptDialog(true)}
                      className="h-14 rounded-2xl border-2 text-sm font-medium px-5 bg-transparent w-44 gap-1"
                    >
                      🧾 Receipt
                    </Button>
                    {(() => {
                      const order = sellerOrders.find(o => o.listing_id === listing.id);
                      const orderGroup = sellerOrderGroups.find(g => g.orders.some(o => o.listing_id === listing.id));
                      if (!order) return null;
                      if (order.status === 'awaiting') {
                        return (
                          <Button
                            onClick={() => {
                              if (orderGroup) {
                                setSelectedOrderGroup(orderGroup);
                                setSalesSheetOpen(true);
                              }
                            }}
                            className="h-14 rounded-2xl text-sm font-medium px-2 bg-[#ddfed7] text-foreground hover:bg-[#ddfed7]/80 border-2 border-[#ddfed7] w-44 gap-1"
                          >
                            📦 Mark as shipped
                          </Button>
                        );
                      }
                      return (
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (orderGroup) {
                              setSelectedOrderGroup(orderGroup);
                              setSalesSheetOpen(true);
                            }
                          }}
                          className="h-14 rounded-2xl border-2 border-muted text-sm font-medium px-4 bg-muted text-muted-foreground w-44 gap-1"
                        >
                          {order.status === 'shipped' ? '✈️ Shipped' : '🚚 Delivered'}
                        </Button>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => {
                      setOpen(false);
                      setTimeout(() => navigate('/support'), 300);
                    }}
                    className="text-xs text-muted-foreground underline"
                  >
                    Need help?
                  </button>
                </div>
              ) : (
                // Active listing owner footer
                <>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setOpen(false);
                        setTimeout(() => navigate(`/listing/${listing.id}/edit`), 300);
                      }}
                      className="h-14 rounded-2xl border-2 text-sm font-medium bg-transparent w-36"
                    >
                      <span className="mr-0.5">✏️</span>
                      Edit Listing
                    </Button>
                    <Button
                      onClick={() => setShowMarkAsSoldDialog(true)}
                      className="h-14 rounded-2xl text-sm font-medium bg-charcoal text-white hover:bg-charcoal/90 border-2 border-charcoal w-36"
                    >
                      Mark as sold
                    </Button>
                  </div>
                </>
              )
            ) : (
              // Non-owner footer
              <>
                <Button
                  variant="outline"
                  onClick={handleDiscard}
                  className="h-14 w-14 rounded-2xl border-2 text-2xl bg-transparent active:bg-[#ddfed7] active:border-[#ddfed7]"
                >
                  ❌
                </Button>

                <Button
                  variant="outline"
                  onClick={handleWishlistClick}
                  className={`h-14 w-14 rounded-2xl border-2 text-2xl transition-colors ${
                    isFavorite(listing.id) 
                      ? 'bg-[#ddfed7] border-[#ddfed7]' 
                      : isSold 
                        ? 'bg-muted/50 border-muted opacity-50' 
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
                      : isSold 
                        ? 'bg-muted/50 border-muted opacity-50' 
                        : 'bg-transparent active:bg-[#ddfed7] active:border-[#ddfed7]'
                  }`}
                >
                  🛒
                </Button>
              </>
            )}
          </div>
          )}

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

          {/* Mark as Sold Confirmation */}
          <AlertDialog open={showMarkAsSoldDialog} onOpenChange={setShowMarkAsSoldDialog}>
            <AlertDialogContent className="max-w-[280px] rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Mark as sold?</AlertDialogTitle>
                <AlertDialogDescription>
                  This listing will be marked as sold. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row gap-2">
                <AlertDialogCancel className="flex-1 mt-0">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={async () => {
                    const { error } = await supabase
                      .from('listings')
                      .update({ status: 'sold' })
                      .eq('id', listing.id)
                      .eq('user_id', user!.id);
                    if (error) {
                      toast.error('Failed to mark as sold');
                    } else {
                      setListingStatus('sold');
                      toast.success('Listing marked as sold');
                    }
                    setShowMarkAsSoldDialog(false);
                  }}
                  className="flex-1"
                >
                  Mark as sold
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          {/* Remove from Cart/Wishlist for removed listings */}
          <AlertDialog open={showRemoveFromBothDialog} onOpenChange={setShowRemoveFromBothDialog}>
            <AlertDialogContent className="max-w-[340px] rounded-2xl px-7 py-6">
              <AlertDialogHeader className="space-y-2">
                <AlertDialogTitle className="text-base text-center">Remove this item?</AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-center text-balance leading-relaxed text-pretty">
                  This item has been deleted by the seller. Clean it up from your 🛒 Cart and/or 💌 Wishlist.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex-row gap-2 mt-4 sm:flex-row">
                <AlertDialogCancel className="flex-1 mt-0 h-9 rounded-lg text-sm">Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={async () => {
                    const promises: Promise<any>[] = [];
                    if (isInCart(listing.id)) {
                      promises.push(removeFromCart(listing.id));
                    }
                    if (isFavorite(listing.id)) {
                      promises.push(removeFavorite(listing.id));
                    }
                    await Promise.all(promises);
                    toast.success('Item removed');
                    setShowRemoveFromBothDialog(false);
                    handleClose();
                  }}
                  className="flex-1 h-9 rounded-lg text-sm bg-destructive text-white hover:bg-destructive/90"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DrawerContent>
      </Drawer>

      {/* Sales Details Sheet for shipping */}
      <SalesDetailsSheet
        orders={selectedOrderGroup?.orders ?? null}
        open={salesSheetOpen}
        onOpenChange={(open) => {
          setSalesSheetOpen(open);
          if (!open) setSelectedOrderGroup(null);
        }}
        onMarkShipped={(trackingDetails) => {
          if (!selectedOrderGroup) return;
          if (selectedOrderGroup.order_group_id) {
            markAsShipped.mutate({
              orderGroupId: selectedOrderGroup.order_group_id,
              trackingProvider: trackingDetails.serviceProvider,
              trackingNumber: trackingDetails.trackingNumber,
            });
          } else {
            markAsShipped.mutate({
              orderId: selectedOrderGroup.orders[0].id,
              trackingProvider: trackingDetails.serviceProvider,
              trackingNumber: trackingDetails.trackingNumber,
            });
          }
          setSalesSheetOpen(false);
          setSelectedOrderGroup(null);
        }}
      />

      {/* Receipt Dialog */}
      {(() => {
        const receiptOrders = sellerOrders.filter(o => o.listing_id === listing?.id);
        if (!receiptOrders.length) return null;
        return (
          <OrderReceiptDialog
            orders={receiptOrders}
            open={showReceiptDialog}
            onOpenChange={setShowReceiptDialog}
            viewAs="seller"
          />
        );
      })()}

      <ReportDialog
        open={!!pendingReport}
        onOpenChange={(v) => { if (!v) closeReport(); }}
        onSubmit={submitPendingReport}
        isSubmitting={isReporting}
        reportType={pendingReport?.reportType || 'listing'}
      />
    </div>
  );
};

export default ListingDetails;
