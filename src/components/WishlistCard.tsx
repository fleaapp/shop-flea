import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, ShoppingCart } from 'lucide-react';
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
  onAddToCart?: () => void;
  isSold?: boolean;
}

const WishlistCard = ({ listing, onRemove, onAddToCart, isSold = false }: WishlistCardProps) => {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleCardClick = () => {
    navigate(`/listing/${listing.id}`, { state: { listing, isSold } });
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowConfirm(true);
  };

  const handleConfirmRemove = () => {
    setShowConfirm(false);
    onRemove?.();
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart?.();
  };

  return (
    <>
      <div 
        className="w-full max-w-[min(340px,85vw)] mx-auto cursor-pointer"
        style={{ height: 'min(68vh, 520px)' }}
        onClick={handleCardClick}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-card p-2 sm:p-3 card-shadow">
          {/* Image with white border effect - takes remaining space */}
          <div className="relative flex-1 min-h-0 overflow-hidden rounded-2xl">
            <img 
              src={listing.image} 
              alt={listing.title} 
              className={`h-full w-full object-cover ${isSold ? 'blur-[2px]' : ''}`}
            />
            
            {/* Sold overlay */}
            {isSold && (
              <div className="absolute inset-0 flex items-center justify-center bg-charcoal/70">
                <span className="text-2xl font-bold text-white tracking-wider">SOLD</span>
              </div>
            )}
            
            {/* Remove button - top left */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRemoveClick}
              className="absolute top-2 left-2 h-9 w-9 rounded-full bg-card/90 backdrop-blur-sm text-muted-foreground hover:text-destructive hover:bg-card z-10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            
            {/* Add to cart button - top right (hide if sold) */}
            {!isSold && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleAddToCart}
                className="absolute top-2 right-2 h-9 w-9 rounded-full bg-card/90 backdrop-blur-sm text-muted-foreground hover:text-primary hover:bg-card"
              >
                <ShoppingCart className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {/* Content - fixed height, matching SwipeCard exactly */}
          <div className="px-1.5 sm:px-2 pt-2 sm:pt-3 pb-1 flex-shrink-0">
            <div className="flex items-end justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-foreground truncate">{listing.title}</h3>
                <div className="mt-1 sm:mt-1.5 flex flex-wrap gap-1 sm:gap-1.5">
                  <ListingTag label={listing.size} isSize />
                  <ListingTag label={listing.brand} />
                </div>
              </div>
              
              <div className="text-right flex-shrink-0 ml-2 sm:ml-3">
                <p className="text-lg sm:text-xl font-bold text-foreground">${listing.price}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">+ ${listing.shippingPrice} shipping</p>
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
