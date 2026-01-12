import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Heart, MessageCircle, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import ListingTag from '@/components/ListingTag';
import { supabase } from '@/integrations/supabase/client';

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
  const { id } = useParams();
  const [open, setOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [listing, setListing] = useState<DbListing | null>(null);
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleSave = () => {
    toast.success('Saved to favorites!');
  };

  const handleMessage = () => {
    toast('Messaging coming soon!');
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
            <div className="mt-4 flex-wrap gap-2 flex flex-row">
              <ListingTag label={['xs', 's', 'm', 'l', 'xl', 'xxl', 'one size'].includes(listing.size.toLowerCase()) ? listing.size.toUpperCase() : listing.size.charAt(0).toUpperCase() + listing.size.slice(1)} variant="muted" />
              <ListingTag label={listing.brand.charAt(0).toUpperCase() + listing.brand.slice(1)} variant="muted" />
              <ListingTag label={listing.condition.charAt(0).toUpperCase() + listing.condition.slice(1)} variant="muted" />
              {listing.gender && <ListingTag label={listing.gender.charAt(0).toUpperCase() + listing.gender.slice(1)} variant="muted" />}
              {listing.colour && <ListingTag label={listing.colour.charAt(0).toUpperCase() + listing.colour.slice(1)} variant="muted" />}
              {listing.style && <ListingTag label={listing.style.charAt(0).toUpperCase() + listing.style.slice(1)} variant="muted" />}
              <ListingTag label={listing.category.charAt(0).toUpperCase() + listing.category.slice(1)} variant="muted" />
            </div>

            {/* Content */}
            <div className="pt-4">
              {/* Title */}
              <h1 className="text-2xl font-bold text-foreground">{listing.title}</h1>

              {/* Description */}
              {listing.description && (
                <p className="mt-4 text-muted-foreground leading-relaxed">{listing.description}</p>
              )}

              {/* Price */}
              <div className="mt-4">
                <p className="text-2xl font-bold text-foreground text-right">${listing.price}</p>
                <p className="text-sm text-muted-foreground text-right">+ ${listing.shipping_price || 0} shipping</p>
              </div>

              {/* Seller Info */}
              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-card p-4 card-shadow">
                <img
                  src={sellerAvatar}
                  alt={sellerName}
                  className="h-12 w-12 rounded-full bg-muted"
                  loading="lazy"
                />
                <div className="flex-1">
                  <p className="font-medium text-foreground">{sellerName}</p>
                  <p className="text-sm text-muted-foreground">Seller</p>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mr-2">
                  <MapPin className="h-4 w-4" />
                  <span>{sellerLocation}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  onClick={handleMessage}
                  className="h-14 rounded-2xl border-2 text-base font-medium"
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Message
                </Button>

                <Button
                  onClick={handleSave}
                  className="h-14 rounded-2xl bg-primary text-base font-medium text-primary-foreground hover:bg-mint-dark"
                >
                  <Heart className="mr-2 h-5 w-5" />
                  Save
                </Button>
              </div>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default ListingDetails;
