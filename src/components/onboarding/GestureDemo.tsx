import { motion } from 'framer-motion';

interface GestureDemoProps {
  type: 'swipe-left-right' | 'swipe-up' | 'tap' | 'cart-swipe';
}

const GestureDemo = ({ type }: GestureDemoProps) => {
  if (type === 'swipe-left-right') {
    return (
      <div className="relative w-48 h-32 mx-auto">
        {/* Mock card */}
        <motion.div
          className="absolute inset-x-4 top-2 h-24 rounded-xl bg-cream/20 border border-cream/30"
          animate={{ x: [-40, 40, -40] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        {/* Direction labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-cream/80 text-xs font-medium">
          <span>❌ Pass</span>
          <span>👆 Cart</span>
          <span>💌 Save</span>
        </div>
      </div>
    );
  }

  if (type === 'swipe-up') {
    return (
      <div className="relative w-32 h-32 mx-auto">
        <motion.div
          className="absolute inset-x-2 bottom-8 h-20 rounded-xl bg-cream/20 border border-cream/30"
          animate={{ y: [0, -20, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute bottom-0 left-0 right-0 text-center text-cream/80 text-xs font-medium">
          👆 Add to cart
        </div>
      </div>
    );
  }

  if (type === 'tap') {
    return (
      <div className="relative w-32 h-28 mx-auto">
        {/* Mock card */}
        <div className="absolute inset-x-2 top-0 h-20 rounded-xl bg-cream/20 border border-cream/30" />
        {/* Tap indicator */}
        <motion.div
          className="absolute top-8 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border-2 border-cream/60"
          animate={{ scale: [1, 0.85, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="absolute bottom-0 left-0 right-0 text-center text-cream/80 text-xs font-medium">
          👆 Tap to view
        </div>
      </div>
    );
  }

  if (type === 'cart-swipe') {
    return (
      <div className="relative w-56 h-24 mx-auto">
        {/* Mock cart item card */}
        <motion.div
          className="absolute top-2 left-1/2 -translate-x-1/2 w-40 h-14 rounded-lg bg-cream/20 border border-cream/30 flex items-center justify-center"
          animate={{ x: [0, 30, 0, -30, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="text-cream/50 text-xs">Cart item</span>
        </motion.div>
        {/* Direction labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-4 text-cream/80 text-xs font-medium">
          <span>💌 Wishlist</span>
          <span>❌ Delete</span>
        </div>
      </div>
    );
  }

  return null;
};

export default GestureDemo;
