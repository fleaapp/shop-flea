import { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Listing } from '@/types/listing';
import ListingTag from './ListingTag';
import { Heart, X } from 'lucide-react';

interface SwipeCardProps {
  listing: Listing;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onClick: () => void;
  isTop: boolean;
  index: number;
}

const SwipeCard = ({ listing, onSwipeLeft, onSwipeRight, onClick, isTop, index }: SwipeCardProps) => {
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0.5, 1, 1, 1, 0.5]);
  
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100;
    
    if (info.offset.x > threshold) {
      setExitDirection('right');
      onSwipeRight();
    } else if (info.offset.x < -threshold) {
      setExitDirection('left');
      onSwipeLeft();
    }
  };

  const stackOffset = index * 4;
  const stackRotation = index * 3; // Slight rotation for stacked effect
  const stackTranslateX = index * 12; // Offset to the right

  return (
    <motion.div
      ref={cardRef}
      className="absolute inset-x-0 top-0 mx-auto w-full h-full cursor-grab active:cursor-grabbing"
      style={{
        x: isTop ? x : 0,
        rotate: isTop ? rotate : stackRotation,
        opacity: isTop ? opacity : 1,
        zIndex: 10 - index,
        top: stackOffset,
        right: isTop ? undefined : -stackTranslateX,
      }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      animate={
        exitDirection === 'left'
          ? { x: -500, rotate: -30, opacity: 0 }
          : exitDirection === 'right'
          ? { x: 500, rotate: 30, opacity: 0 }
          : {}
      }
      transition={{ duration: 0.3 }}
      onClick={isTop ? onClick : undefined}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-card p-4 card-shadow">
        {/* Image with white border effect - takes remaining space */}
        <div className="relative flex-1 min-h-0 overflow-hidden rounded-2xl">
          <img
            src={listing.image}
            alt={listing.title}
            className="h-full w-full object-cover"
            draggable={false}
          />
          
          {/* Like/Nope indicators */}
          {isTop && (
            <>
              <motion.div
                style={{ opacity: likeOpacity }}
                className="absolute inset-0 flex items-center justify-center bg-green-500/20"
              >
                <div className="rounded-xl border-4 border-green-500 px-8 py-4">
                  <Heart className="h-16 w-16 text-green-500" fill="currentColor" />
                </div>
              </motion.div>
              
              <motion.div
                style={{ opacity: nopeOpacity }}
                className="absolute inset-0 flex items-center justify-center bg-red-500/20"
              >
                <div className="rounded-xl border-4 border-red-500 px-8 py-4">
                  <X className="h-16 w-16 text-red-500" />
                </div>
              </motion.div>
            </>
          )}
        </div>
        
        {/* Content - fixed height */}
        <div className="px-3 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-semibold text-foreground truncate">{listing.title}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {listing.tags.map((tag) => (
                  <ListingTag key={tag} label={tag} />
                ))}
              </div>
            </div>
            
            <div className="text-right flex-shrink-0 ml-4">
              <p className="text-2xl font-bold text-foreground">${listing.price}</p>
              <p className="text-sm text-muted-foreground">+ ${listing.shippingPrice} shipping</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SwipeCard;
