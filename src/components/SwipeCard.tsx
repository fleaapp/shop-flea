import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Listing } from '@/types/listing';
import ListingTag from './ListingTag';

interface SwipeCardProps {
  listing: Listing;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
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
  onExitComplete,
  onClick,
  isTop,
  index
}: SwipeCardProps) => {
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'up' | null>(null);
  const exitNotifiedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [0, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, 0], [1, 0]);
  const cartOpacity = useTransform(y, [-100, 0], [1, 0]);

  // When a card becomes the top card, reset drag offsets.
  useEffect(() => {
    if (isTop && exitDirection === null) {
      x.set(0);
      y.set(0);
    }
  }, [isTop, exitDirection, x, y]);

  useEffect(() => {
    if (exitDirection) {
      exitNotifiedRef.current = false;
    }
  }, [exitDirection]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100;
    
    // Check vertical swipe first (up takes priority)
    if (info.offset.y < -threshold && Math.abs(info.offset.y) > Math.abs(info.offset.x)) {
      setExitDirection('up');
      onSwipeUp();
    } else if (info.offset.x > threshold) {
      setExitDirection('right');
      onSwipeRight();
    } else if (info.offset.x < -threshold) {
      setExitDirection('left');
      onSwipeLeft();
    }
  };

  const stackOffset = index * 4;
  const stackRotation = index * 3;
  const stackTranslateX = index * 12;

  const getAnimateProps = () => {
    if (exitDirection === 'left') return { x: -500, rotate: -30, opacity: 0 };
    if (exitDirection === 'right') return { x: 500, rotate: 30, opacity: 0 };
    if (exitDirection === 'up') return { y: -500, opacity: 0 };

    // Stacked cards: keep them positioned behind the top card.
    if (!isTop) {
      return { x: stackTranslateX, y: 0, rotate: stackRotation, opacity: 1 };
    }

    // Top card: motion values drive x/y/rotate while dragging.
    return {};
  };

  return (
    <motion.div
      ref={cardRef}
      className="absolute inset-x-0 top-0 mx-auto w-[calc(100%-16px)] max-[375px]:w-[calc(100%-8px)] max-w-sm cursor-grab active:cursor-grabbing h-[calc(100%-8px)]"
      style={{
        x: isTop && !exitDirection ? x : undefined,
        y: isTop && !exitDirection ? y : undefined,
        rotate: isTop && !exitDirection ? rotate : undefined,
        zIndex: 10 - index,
        marginTop: stackOffset
      }}
      animate={getAnimateProps()}
      drag={isTop && !exitDirection}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
      transition={{ duration: 0.22 }}
      onAnimationComplete={() => {
        if (!exitDirection || exitNotifiedRef.current) return;
        exitNotifiedRef.current = true;
        onExitComplete?.();
      }}
      onClick={isTop && !exitDirection ? onClick : undefined}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-card p-3 max-[375px]:p-2 card-shadow">
        {/* Image with white border effect - takes remaining space */}
        <div className="relative flex-1 min-h-0 overflow-hidden rounded-2xl bg-muted transform-gpu [backface-visibility:hidden] [-webkit-mask-image:-webkit-radial-gradient(white,black)]">
          <img
            src={listing.image}
            alt={listing.title}
            className="absolute inset-0 h-full w-full rounded-2xl object-cover transform-gpu scale-[1.06] [backface-visibility:hidden]"
            draggable={false}
          />
          
          {/* Like/Nope/Cart indicators */}
{isTop && (
            <>
              <motion.div
                style={{ opacity: likeOpacity }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <span className="text-7xl">💌</span>
              </motion.div>
              
              <motion.div
                style={{ opacity: nopeOpacity }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <span className="text-7xl">❌</span>
              </motion.div>
              
              <motion.div
                style={{ opacity: cartOpacity }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <span className="text-7xl">🛒</span>
              </motion.div>
            </>
          )}
        </div>
        
        {/* Content - fixed height */}
        <div className="px-2 max-[375px]:px-1.5 pt-3 max-[375px]:pt-2 pb-1 flex-shrink-0">
          <div className="flex items-end justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg max-[375px]:text-base font-semibold text-foreground truncate">{listing.title}</h3>
              <div className="mt-1.5 max-[375px]:mt-1 flex flex-wrap gap-1.5 max-[375px]:gap-1">
                <ListingTag label={listing.size} isSize />
                <ListingTag label={listing.brand} />
              </div>
            </div>
            
            <div className="text-right flex-shrink-0 ml-3 max-[375px]:ml-2">
              <p className="text-xl max-[375px]:text-lg font-bold text-foreground leading-tight">${listing.price}</p>
              <p className="text-xs max-[375px]:text-[10px] text-muted-foreground">+ ${listing.shippingPrice} shipping</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default SwipeCard;