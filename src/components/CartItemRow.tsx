import { useState, useRef } from 'react';
import soldSticker from '@/assets/sold-sticker.png';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Listing } from '@/types/listing';
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

interface CartItemRowProps {
  item: Listing & { status?: string; isPaused?: boolean };
  isSelected: boolean;
  isLast: boolean;
  showSellerAvatar: boolean;
  showCheckbox: boolean;
  onToggleSelect: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onCardClick: () => void;
}

const SWIPE_THRESHOLD = 100;

const CartItemRow = ({
  item,
  isSelected,
  isLast,
  showSellerAvatar,
  showCheckbox,
  onToggleSelect,
  onSwipeLeft,
  onSwipeRight,
  onCardClick,
}: CartItemRowProps) => {
  const navigate = useNavigate();
  const [isRemoving, setIsRemoving] = useState(false);
  const [pendingAction, setPendingAction] = useState<'left' | 'right' | null>(null);
  const x = useMotionValue(0);
  const xRef = useRef(0);
  
  const isSold = item.status === 'sold';
  const isPaused = item.isPaused || false;
  const isUnavailable = isSold || isPaused;
  
  // Background colors based on swipe direction
  const leftBgOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]); 
  const rightBgOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  
  // Icon scale based on swipe
  const leftIconScale = useTransform(x, [-SWIPE_THRESHOLD, -50, 0], [1, 0.8, 0]);
  const rightIconScale = useTransform(x, [0, 50, SWIPE_THRESHOLD], [0, 0.8, 1]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) {
      xRef.current = info.offset.x;
      setPendingAction('left');
    } else if (info.offset.x > SWIPE_THRESHOLD) {
      xRef.current = info.offset.x;
      setPendingAction('right');
    }
  };

  const handleConfirmAction = () => {
    setIsRemoving(true);
    setTimeout(() => {
      if (pendingAction === 'left') {
        onSwipeLeft();
      } else {
        onSwipeRight();
      }
      setPendingAction(null);
    }, 200);
  };

  const handleCancelAction = () => {
    setPendingAction(null);
    x.set(0);
  };

  return (
    <>
    <div
      className={cn(
        "relative overflow-hidden",
        !isLast && "border-b border-border",
      )}
      onClick={onCardClick}
    >
      {/* Swipe background indicators */}
      <motion.div 
        className="absolute inset-0 bg-muted-foreground/50 flex items-center justify-end pr-6"
        style={{ opacity: leftBgOpacity }}
      >
        <motion.div style={{ scale: leftIconScale }}>
          <span className="text-4xl">❌</span>
        </motion.div>
      </motion.div>
      
      <motion.div 
        className="absolute inset-0 bg-price flex items-center justify-start pl-6"
        style={{ opacity: rightBgOpacity }}
      >
        <motion.div style={{ scale: rightIconScale }}>
          <span className="text-4xl">💌</span>
        </motion.div>
      </motion.div>

      {/* Swipeable content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={handleDragEnd}
        style={{ x }}
        animate={isRemoving ? { x: xRef.current < 0 ? -400 : 400, opacity: 0 } : {}}
        transition={{ duration: 0.2 }}
        className={cn(
          "flex gap-4 p-4 bg-card relative z-10 cursor-grab active:cursor-grabbing cursor-pointer",
          isUnavailable && "relative"
        )}
      >
        {/* Paused overlay (full card) - only for paused, not sold */}
        {isPaused && (
          <div className="absolute inset-0 bg-charcoal/70 backdrop-blur-sm z-20 flex items-center justify-center">
            <span className="text-2xl font-bold text-white tracking-wider">⏸️ Paused</span>
          </div>
        )}

        {/* Checkbox - only shown for sellers with multiple items */}
        {showCheckbox && (
          <div
            className="flex items-center justify-center h-24 pl-1"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
          >
            <div className={cn(
              "flex h-6 w-6 items-center justify-center rounded border-2 transition-colors",
              isSelected 
                ? "bg-charcoal border-charcoal" 
                : "bg-transparent border-muted-foreground/40"
            )}>
              {isSelected && <Check className="h-4 w-4 text-white" />}
            </div>
          </div>
        )}

        {/* Image */}
        <div
          className="relative h-24 w-24 flex-shrink-0 rounded-xl"
        >
          <img
            src={item.image}
            alt={item.title}
            className="h-full w-full rounded-xl object-cover"
          />
          {/* SOLD sticker over image only */}
          {isSold && (
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={soldSticker}
                alt="SOLD"
                className="w-[88px] h-[88px] drop-shadow-lg"
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className={cn(
          "flex flex-1 flex-col justify-between h-24",
          isPaused && "opacity-50"
        )}>
          <div className="flex items-start justify-between pt-1">
            <h3 className={cn("font-semibold", isSold ? "text-[hsl(4,90%,58%)]" : "text-foreground")}>{item.title}</h3>
            {showSellerAvatar && (
              <img
                src={item.sellerAvatar}
                alt={item.sellerName}
                className="h-8 w-8 rounded-full bg-muted cursor-pointer active:scale-95 transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/seller/${item.sellerId}`);
                }}
              />
            )}
          </div>
          <div className="pb-1">
            <p className="text-lg font-bold leading-tight text-foreground">
              ${item.price}
            </p>
            <p className="text-sm text-muted-foreground leading-tight">
              + ${item.shippingPrice} shipping
            </p>
          </div>
        </div>
      </motion.div>
    </div>

    {/* Confirmation Dialog */}
    <AlertDialog open={pendingAction !== null} onOpenChange={(open) => !open && handleCancelAction()}>
      <AlertDialogContent className="rounded-2xl max-w-[90vw] w-[320px]">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {pendingAction === 'left' ? 'Remove from cart?' : 'Move to wishlist?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pendingAction === 'left' 
              ? `Remove "${item.title}" from your cart?`
              : `Move "${item.title}" to your wishlist?`
            }
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2">
          <AlertDialogCancel className="flex-1 m-0 rounded-full">Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirmAction}
            className="flex-1 m-0 rounded-full"
          >
            {pendingAction === 'left' ? 'Remove' : 'Move'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default CartItemRow;
