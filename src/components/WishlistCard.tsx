import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import soldSticker from '@/assets/sold-sticker.png';
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
  isPaused?: boolean;
  isInactive?: boolean;
  isRemoved?: boolean;
  isInCart?: boolean;
}

const WishlistCard = ({ listing, onRemove, onAddToCart, isSold = false, isPaused = false, isInactive = false, isRemoved = false, isInCart = false }: WishlistCardProps) => {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);

  const isUnavailable = isSold || isPaused || isInactive || isRemoved;

  const handleCardClick = () => {
    navigate(`/listing/${listing.id}`, { state: { listing, isSold, fromWishlist: true } });
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
        className="w-full max-w-[min(340px,85vw)] max-[393px]:max-w-[min(300px,80vw)] max-[375px]:max-w-[min(280px,78vw)] mx-auto cursor-pointer h-[min(68vh,520px)] max-[393px]:h-[min(58vh,440px)] max-[375px]:h-[min(55vh,400px)]"
        onClick={handleCardClick}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-card p-3 max-[375px]:p-2 card-shadow">
          {/* Image with white border effect - takes remaining space */}
          <div
            className="relative flex-1 min-h-0 overflow-hidden rounded-2xl"
            style={{ clipPath: 'inset(0 round calc(var(--radius) + 8px))' }}
          >
            <img 
              src={listing.image} 
              alt={listing.title} 
            className={`h-full w-full object-cover block rounded-2xl ${isSold ? 'blur-[2px]' : ''}`}
            />
            
            {/* Sold overlay with sticker */}
            {isSold && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-charcoal/40">
                <img src={soldSticker} alt="SOLD" className="w-[160px] h-[160px] drop-shadow-lg" />
              </div>
            )}

            {/* Paused overlay with emoji (same style as sold) */}
            {isPaused && !isSold && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-charcoal/40">
                <span className="text-[80px] drop-shadow-lg">⏸️</span>
              </div>
            )}

            {/* Inactive overlay with emoji (same style as paused) */}
            {isInactive && !isSold && !isPaused && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-charcoal/40">
                <span className="text-[80px] drop-shadow-lg">🕰️</span>
              </div>
            )}
            
            {/* Remove button - top left */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRemoveClick}
              className="absolute top-2 left-2 h-9 w-9 rounded-full bg-card/90 backdrop-blur-sm hover:bg-card z-10 text-base"
            >
              ❌
            </Button>
            
            {/* Add to cart button - top right (hide if unavailable) */}
            {!isUnavailable && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleAddToCart}
                className={`absolute top-2 right-2 h-9 w-9 rounded-full backdrop-blur-sm hover:bg-card text-base ${
                  isInCart 
                    ? 'bg-[#ddfed7]' 
                    : 'bg-card/90'
                }`}
              >
                🛒
              </Button>
            )}
          </div>
          
          {/* Content - fixed height, matching SwipeCard exactly */}
          <div className="px-2 max-[375px]:px-1.5 pt-3 max-[375px]:pt-2 pb-1 flex-shrink-0">
            <div className="flex items-end justify-between">
              <div className="flex-1 min-w-0">
                <h3 className={`text-lg max-[375px]:text-base font-semibold truncate ${isSold ? 'text-[hsl(4,90%,58%)]' : 'text-foreground'}`}>{listing.title}</h3>
                <div className="mt-1.5 max-[375px]:mt-1 flex flex-nowrap gap-1.5 max-[375px]:gap-1 overflow-x-auto scrollbar-hide">
                  <ListingTag label={listing.size} isSize />
                  <ListingTag label={listing.brand} />
                </div>
              </div>
              
              <div className="text-right flex-shrink-0 ml-3 max-[375px]:ml-2">
                <p className="text-xl max-[375px]:text-lg font-bold text-foreground">${listing.price}</p>
                <p className="text-xs max-[375px]:text-[10px] text-muted-foreground">+ ${listing.shippingPrice} shipping</p>
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
