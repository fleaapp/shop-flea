import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Heart, MessageCircle, MapPin, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import ListingTag from '@/components/ListingTag';
import { mockListings } from '@/data/mockListings';
import { Listing } from '@/types/listing';

const ListingDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  const [open, setOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Get listing from state or find from mock data
  const listing: Listing = location.state?.listing || mockListings.find((l) => l.id === id);

  const images = listing?.images?.length ? listing.images : listing ? [listing.image] : [];

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => navigate(-1), 300);
  };

  useEffect(() => {
    setOpen(true);
    setActiveImageIndex(0);

    // Ensure the drawer content always starts at the top (prevents "cut off" opening).
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

  if (!listing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Listing not found</p>
      </div>
    );
  }

  const handleSave = () => {
    toast.success('Saved to favorites!');
  };

  const handleMessage = () => {
    toast('Messaging coming soon!');
  };

  const handleShare = () => {
    toast('Share link copied!');
  };

  return (
    <div className="min-h-screen bg-background">
      <Drawer open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
        {/* Use dvh so mobile browsers don't "crop" the top due to URL bar/vh quirks */}
        <DrawerContent className="mt-0 h-[95dvh] max-h-[95dvh] overflow-hidden rounded-t-3xl bg-background">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-8">
            {/* Header */}
            <div className="flex items-center justify-end">
              <Button variant="ghost" size="icon" onClick={handleShare} className="h-10 w-10 rounded-full">
                <Share2 className="h-5 w-5" />
              </Button>
            </div>

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

            {/* Content */}
            <div className="pt-6">
              {/* Title and Price */}
              <div className="flex items-start justify-between">
                <h1 className="text-2xl font-bold text-foreground">{listing.title}</h1>
                <div className="text-right">
                  <p className="text-2xl font-bold text-foreground">${listing.price}</p>
                  <p className="text-sm text-muted-foreground">+ ${listing.shippingPrice} shipping</p>
                </div>
              </div>

              {/* Tags */}
              <div className="mt-4 flex flex-wrap gap-2">
                <ListingTag label={listing.size} />
                <ListingTag label={listing.brand} />
                {listing.tags.map((tag) => (
                  <ListingTag key={tag} label={tag} />
                ))}
              </div>

              {/* Description */}
              <p className="mt-6 text-muted-foreground leading-relaxed">{listing.description}</p>

              {/* Location */}
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{listing.location}</span>
              </div>

              {/* Seller Info */}
              <div className="mt-6 flex items-center gap-3 rounded-2xl bg-card p-4 card-shadow">
                <img
                  src={listing.sellerAvatar}
                  alt={listing.sellerName}
                  className="h-12 w-12 rounded-full bg-muted"
                  loading="lazy"
                />
                <div className="flex-1">
                  <p className="font-medium text-foreground">{listing.sellerName}</p>
                  <p className="text-sm text-muted-foreground">Seller</p>
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
