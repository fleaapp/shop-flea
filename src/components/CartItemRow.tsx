import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Check, Heart, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Listing } from '@/types/listing';

interface CartItemRowProps {
  item: Listing & { status?: string };
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

        {/* Image - tappable to open listing details */}
        <div
          className={cn(
            "relative h-24 w-24 flex-shrink-0 cursor-pointer"
          )}
          onClick={() => !isSold && onCardClick()}
        >
          <img
            src={item.image}
            alt={item.title}
            className={cn(
              "h-full w-full rounded-xl object-cover",
              isSold && "opacity-50"
            )}
          />
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
                className="h-8 w-8 rounded-full bg-muted cursor-pointer active:scale-95 transition-transform"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/seller/${item.sellerId}`);
                }}
              />
            )}
          </div>
          <div className="pb-1">
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
