import { useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Check, Heart, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Listing } from '@/types/listing';

interface CartItemRowProps {
  item: Listing & { status?: string };
  isSelected: boolean;
  isLast: boolean;
  showSellerAvatar: boolean;
  onToggleSelect: () => void;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

const SWIPE_THRESHOLD = 100;

const CartItemRow = ({
  item,
  isSelected,
  isLast,
  showSellerAvatar,
  onToggleSelect,
  onSwipeLeft,
  onSwipeRight,
}: CartItemRowProps) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const x = useMotionValue(0);
  
  const isSold = item.status === 'sold';
  
  // Background colors based on swipe direction
  const leftBgOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const rightBgOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  
  // Icon scale based on swipe
  const leftIconScale = useTransform(x, [-SWIPE_THRESHOLD, -50, 0], [1, 0.8, 0]);
  const rightIconScale = useTransform(x, [0, 50, SWIPE_THRESHOLD], [0, 0.8, 1]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -SWIPE_THRESHOLD) {
      setIsRemoving(true);
      setTimeout(() => {
        onSwipeLeft();
      }, 200);
    } else if (info.offset.x > SWIPE_THRESHOLD) {
      setIsRemoving(true);
      setTimeout(() => {
        onSwipeRight();
      }, 200);
    }
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        !isLast && "border-b border-border"
      )}
    >
      {/* Swipe background indicators */}
      <motion.div 
        className="absolute inset-0 bg-destructive flex items-center justify-start pl-6"
        style={{ opacity: leftBgOpacity }}
      >
        <motion.div style={{ scale: leftIconScale }}>
          <X className="h-8 w-8 text-white" />
        </motion.div>
      </motion.div>
      
      <motion.div 
        className="absolute inset-0 bg-price flex items-center justify-end pr-6"
        style={{ opacity: rightBgOpacity }}
      >
        <motion.div style={{ scale: rightIconScale }}>
          <Heart className="h-8 w-8 text-white" />
        </motion.div>
      </motion.div>

      {/* Swipeable content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={handleDragEnd}
        style={{ x }}
        animate={isRemoving ? { x: x.get() < 0 ? -400 : 400, opacity: 0 } : {}}
        transition={{ duration: 0.2 }}
        className={cn(
          "flex gap-4 p-4 bg-card relative z-10 cursor-grab active:cursor-grabbing",
          isSold && "relative"
        )}
      >
        {/* Sold overlay */}
        {isSold && (
          <div className="absolute inset-0 bg-charcoal/70 backdrop-blur-sm z-20 flex items-center justify-center">
            <span className="text-2xl font-bold text-white tracking-wider">SOLD</span>
          </div>
        )}

        {/* Image with selection checkbox */}
        <div
          className={cn(
            "relative h-24 w-24 flex-shrink-0",
            !isSold && "cursor-pointer"
          )}
          onClick={() => !isSold && onToggleSelect()}
        >
          <img
            src={item.image}
            alt={item.title}
            className={cn(
              "h-full w-full rounded-xl object-cover",
              isSold && "opacity-50"
            )}
          />
          {isSelected && !isSold && (
            <div className="absolute top-2 left-2 flex h-5 w-5 items-center justify-center rounded bg-charcoal">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className={cn(
          "flex flex-1 flex-col justify-between h-24",
          isSold && "opacity-50"
        )}>
          <div className="flex items-start justify-between pt-1">
            <h3 className="font-semibold text-foreground">{item.title}</h3>
            {showSellerAvatar && (
              <img
                src={item.sellerAvatar}
                alt={item.sellerName}
                className="h-8 w-8 rounded-full bg-muted"
              />
            )}
          </div>
          <div>
            <p className="text-lg font-bold text-foreground leading-tight">
              ${item.price}
            </p>
            <p className="text-sm text-muted-foreground leading-tight">
              + ${item.shippingPrice} shipping
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CartItemRow;
