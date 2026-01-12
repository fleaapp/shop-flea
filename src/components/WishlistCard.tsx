import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import ListingTag from './ListingTag';
import { Listing } from '@/types/listing';

interface WishlistCardProps {
  listing: Listing;
  onRemove?: () => void;
}

const WishlistCard = ({ listing, onRemove }: WishlistCardProps) => {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleCardClick = () => {
    navigate(`/listing/${listing.id}`, { state: { listing } });
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(true);
  };

  const handleConfirmRemove = () => {
    setShowConfirm(false);
    onRemove?.();
  };

  return (
    <>
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
            
            {/* Remove button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRemoveClick}
              className="absolute top-2 left-2 h-9 w-9 rounded-full bg-card/90 backdrop-blur-sm text-muted-foreground hover:text-destructive hover:bg-card"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
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

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="max-w-[280px] rounded-2xl p-5">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-base">Remove from wishlist?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Remove "{listing.title}" from your wishlist?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 sm:flex-row">
            <AlertDialogCancel className="flex-1 mt-0 h-9 rounded-lg text-sm">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmRemove} 
              className="flex-1 h-9 rounded-lg text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default WishlistCard;
