import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ListingTag from './ListingTag';
import { Listing } from '@/types/listing';

interface WishlistCardProps {
  listing: Listing;
  onAddToCart: () => void;
  onRemove: () => void;
}

const WishlistCard = ({ listing, onAddToCart, onRemove }: WishlistCardProps) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/listing/${listing.id}`, { state: { listing } });
  };

  return (
    <div 
      className="flex flex-col overflow-hidden rounded-3xl bg-card p-3 card-shadow cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Image with price tag */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl">
        <img 
          src={listing.image} 
          alt={listing.title} 
          className="h-full w-full object-cover" 
        />
        
        {/* Price tag */}
        <div className="absolute top-3 left-3 bg-card rounded-full px-3 py-1.5 shadow-md">
          <span className="font-bold text-foreground">${listing.price}</span>
        </div>
      </div>
      
      {/* Footer with actions */}
      <div className="px-2 pt-3 pb-1">
        <div className="flex items-end justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground truncate">{listing.title}</h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <ListingTag label={listing.size} />
              <ListingTag label={listing.brand} />
            </div>
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart();
            }}
            className="flex-1 h-10 rounded-full bg-card border-border font-medium"
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Add to cart
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="h-10 w-10 rounded-full bg-muted text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WishlistCard;
