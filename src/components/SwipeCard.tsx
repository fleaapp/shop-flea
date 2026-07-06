import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useMotionValue, useTransform, PanInfo, animate } from 'framer-motion';
import { Listing } from '@/types/listing';
import ListingTag from './ListingTag';
import { getCardImageUrl } from '@/utils/optimizedImage';

interface SwipeCardProps {
  listing: Listing;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  onSwipeDown?: () => void;
  onExitComplete?: () => void;
  onClick: () => void;
  isTop: boolean;
  index: number;
}

const SwipeCard = ({
  listing,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onExitComplete,
  onClick,
  isTop,
  index
}: SwipeCardProps) => {
  const [gone, setGone] = useState(false);
  const exitNotifiedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);
  const cartOpacity = useTransform(y, [-100, 0], [1, 0]);
  const skipOpacity = useTransform(y, [0, 100], [0, 1]);

  const stackOffset = index * 4;
  const stackRotation = index * 3;
  const stackTranslateX = index * 12;

  // Position stacked (non-top) cards without animation
  useEffect(() => {
    if (!isTop && !gone) {
      x.set(stackTranslateX);
      y.set(0);
    }
  }, [isTop, gone, stackTranslateX, x, y]);

  // Reset when becoming top card
  useEffect(() => {
    if (isTop && !gone) {
      x.set(0);
      y.set(0);
    }
  }, [isTop, gone, x, y]);

  const animateExit = useCallback((direction: 'left' | 'right' | 'up' | 'down') => {
    setGone(true);
    exitNotifiedRef.current = false;

    const targets: Record<string, { x?: number; y?: number }> = {
      left: { x: -500 },
      right: { x: 500 },
      up: { y: -600 },
      down: { y: 600 },
    };
    const target = targets[direction];

    const animations: Promise<void>[] = [];

    if (target.x !== undefined) {
      animations.push(
        new Promise(resolve => {
          animate(x, target.x!, { duration: 0.3, ease: 'easeOut', onComplete: resolve });
        })
      );
    }
    if (target.y !== undefined) {
      animations.push(
        new Promise(resolve => {
          animate(y, target.y!, { duration: 0.3, ease: 'easeOut', onComplete: resolve });
        })
      );
    }

    Promise.all(animations).then(() => {
      if (!exitNotifiedRef.current) {
        exitNotifiedRef.current = true;
        onExitComplete?.();
      }
    });
  }, [x, y, onExitComplete]);

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (gone) return;
    const threshold = 100;
    
    if (info.offset.y < -threshold && Math.abs(info.offset.y) > Math.abs(info.offset.x)) {
      onSwipeUp();
      animateExit('up');
    } else if (info.offset.y > threshold && Math.abs(info.offset.y) > Math.abs(info.offset.x)) {
      onSwipeDown?.();
      animateExit('down');
    } else if (info.offset.x > threshold) {
      onSwipeRight();
      animateExit('right');
    } else if (info.offset.x < -threshold) {
      onSwipeLeft();
      animateExit('left');
    }
  }, [gone, onSwipeUp, onSwipeDown, onSwipeRight, onSwipeLeft, animateExit]);

  return (
    <motion.div
      ref={cardRef}
      className="absolute inset-x-0 top-0 mx-auto w-[calc(100%-16px)] max-[375px]:w-[calc(100%-8px)] max-w-sm cursor-grab active:cursor-grabbing h-[calc(100%-8px)]"
      style={{
        x,
        y,
        rotate: isTop ? rotate : stackRotation,
        zIndex: 10 - index,
        marginTop: stackOffset,
        opacity: gone ? 0 : 1,
      }}
      drag={isTop && !gone}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      onClick={isTop && !gone ? onClick : undefined}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-card p-3 max-[375px]:p-2 card-shadow">
        {/* Image */}
        <div className="relative flex-1 min-h-0 overflow-hidden rounded-2xl bg-muted">
          <img src={getCardImageUrl(listing.image)} alt={listing.title} className="h-full w-full object-cover" draggable={false} loading={isTop ? 'eager' : 'lazy'} decoding="async" fetchPriority={isTop ? 'high' : 'auto'} />
          
          {isTop && (
            <>
              <motion.div style={{ opacity: likeOpacity }} className="absolute inset-0 flex items-center justify-center">
                <span className="text-7xl">💌</span>
              </motion.div>
              <motion.div style={{ opacity: nopeOpacity }} className="absolute inset-0 flex items-center justify-center">
                <span className="text-7xl">❌</span>
              </motion.div>
              <motion.div style={{ opacity: cartOpacity }} className="absolute inset-0 flex items-center justify-center">
                <span className="text-7xl">🛒</span>
              </motion.div>
              <motion.div style={{ opacity: skipOpacity }} className="absolute inset-0 flex items-center justify-center">
                <span className="text-7xl">🤔</span>
              </motion.div>
            </>
          )}
        </div>
        
        {/* Content */}
        <div className="px-2 max-[375px]:px-1.5 pt-3 max-[375px]:pt-2 pb-1 flex-shrink-0">
          <div className="flex items-end justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg max-[375px]:text-base font-semibold text-foreground truncate">{listing.title}</h3>
              <div className="mt-1.5 max-[375px]:mt-1 flex flex-nowrap gap-1.5 max-[375px]:gap-1 overflow-x-auto scrollbar-hide">
                <ListingTag label={listing.size} isSize />
                <ListingTag label={listing.brand} />
              </div>
            </div>
            
            <div className="text-right flex-shrink-0 ml-3 max-[375px]:ml-2">
              <p className="text-xl max-[375px]:text-lg font-bold text-foreground leading-tight">${listing.price}</p>
              <p className="text-xs max-[375px]:text-[10px] text-muted-foreground">📦 +${listing.shippingPrice}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SwipeCard;
