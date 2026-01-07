import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, MapPin, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Listing } from '@/types/listing';
import ListingTag from '@/components/ListingTag';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { mockListings } from '@/data/mockListings';

const ListingDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  
  // Get listing from state or find from mock data
  const listing: Listing = location.state?.listing || mockListings.find(l => l.id === id);
  
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
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background/80 px-4 py-4 backdrop-blur-lg">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={handleShare}
          className="h-10 w-10 rounded-full"
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </header>
      
      {/* Image */}
      <div className="mx-4 overflow-hidden rounded-3xl">
        <img
          src={listing.image}
          alt={listing.title}
          className="aspect-square w-full object-cover"
        />
      </div>
      
      {/* Content */}
      <div className="px-6 pt-6">
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
      
      <BottomNav />
    </div>
  );
};

export default ListingDetails;
