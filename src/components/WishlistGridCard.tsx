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

interface WishlistGridCardProps {
  listing: Listing;
  onRemove?: () => void;
  onAddToCart?: () => void;
  isSold?: boolean;
  isPaused?: boolean;
  isInactive?: boolean;
  isRemoved?: boolean;
  isInCart?: boolean;
}

const WishlistGridCard = ({ listing, onRemove, onAddToCart, isSold = false, isPaused = false, isInactive = false, isRemoved = false, isInCart = false }: WishlistGridCardProps) => {
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
        className="w-full cursor-pointer"
        onClick={handleCardClick}
      >
        <div className="flex flex-col overflow-hidden rounded-2xl bg-card p-2 card-shadow">
          {/* Image */}
          <div
            className="relative aspect-[3/4] overflow-hidden rounded-xl"
            style={{ clipPath: 'inset(0 round calc(var(--radius) + 4px))' }}
          >
            <img
              src={listing.image}
              alt={listing.title}
              className={`h-full w-full object-cover block rounded-xl ${isSold ? 'blur-[2px]' : ''}`}
            />

            {isSold && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-charcoal/40">
                <img src={soldSticker} alt="SOLD" className="w-[80px] h-[80px] drop-shadow-lg" />
              </div>
            )}

            {isPaused && !isSold && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-charcoal/40">
                <span className="text-[40px] drop-shadow-lg">⏸️</span>
              </div>
            )}

            {isInactive && !isSold && !isPaused && !isRemoved && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-charcoal/40">
                <span className="text-[40px] drop-shadow-lg">🕰️</span>
              </div>
            )}

            {isRemoved && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-charcoal/40">
                <span className="text-[40px] drop-shadow-lg">⛔️</span>
              </div>
            )}

            {/* Remove button - top left */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRemoveClick}
              className="absolute top-1.5 left-1.5 h-7 w-7 rounded-full bg-card/90 backdrop-blur-sm hover:bg-card z-10 text-xs"
            >
              ❌
            </Button>

            {/* Add to cart button - top right */}
            {!isUnavailable && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleAddToCart}
                className={`absolute top-1.5 right-1.5 h-7 w-7 rounded-full backdrop-blur-sm hover:bg-card text-xs ${
                  isInCart ? 'bg-[#ddfed7]' : 'bg-card/90'
                }`}
              >
                🛒
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="px-1 pt-2 pb-0.5">
            <div className="flex items-end justify-between">
              <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-semibold truncate ${isSold ? 'text-[hsl(4,90%,58%)]' : 'text-foreground'}`}>
                  {listing.title}
                </h3>
                <div className="mt-1 flex flex-nowrap gap-1 overflow-x-auto scrollbar-hide whitespace-nowrap">
                  <ListingTag label={listing.size} isSize size="sm" />
                  <ListingTag label={listing.brand} size="sm" />
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <p className="text-sm font-bold text-foreground">${listing.price}</p>
                <p className="text-[10px] text-muted-foreground">+ ${listing.shippingPrice} shipping</p>
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

export default WishlistGridCard;
