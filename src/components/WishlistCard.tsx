import { useNavigate } from 'react-router-dom';
import ListingTag from './ListingTag';
import { Listing } from '@/types/listing';

interface WishlistCardProps {
  listing: Listing;
}

const WishlistCard = ({ listing }: WishlistCardProps) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/listing/${listing.id}`, { state: { listing } });
  };

  return (
    <div 
      className="w-full max-w-[340px] mx-auto cursor-pointer"
      style={{ height: 'min(68vh, 520px)' }}
      onClick={handleCardClick}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-card p-3 card-shadow py-[10px] px-[10px]">
        {/* Image with white border effect - takes remaining space */}
        <div className="relative flex-1 min-h-0 overflow-hidden rounded-2xl">
          <img 
            src={listing.image} 
            alt={listing.title} 
            className="h-full w-full object-cover" 
          />
        </div>
        
        {/* Content - fixed height, matching SwipeCard exactly */}
        <div className="px-2 pt-3 pb-1 flex-shrink-0">
          <div className="flex items-end justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-foreground truncate">{listing.title}</h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                <ListingTag label={listing.size} />
                <ListingTag label={listing.brand} />
              </div>
            </div>
            
            <div className="text-right flex-shrink-0 ml-3">
              <p className="text-xl font-bold text-foreground">${listing.price}</p>
              <p className="text-xs text-muted-foreground">+ ${listing.shippingPrice} shipping</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WishlistCard;
