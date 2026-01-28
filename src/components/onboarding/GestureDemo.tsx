import { motion } from 'framer-motion';

interface GestureDemoProps {
  type: 'swipe-left-right' | 'swipe-up' | 'tap' | 'swipe-left';
}

const GestureDemo = ({ type }: GestureDemoProps) => {
  if (type === 'swipe-left-right') {
    return (
      <div className="flex items-center justify-center gap-8 py-4">
        {/* Left swipe indicator */}
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1, x: [-10, 0, -10] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.span className="text-2xl">👈</motion.span>
          <span className="text-cream text-sm font-medium">Pass</span>
        </motion.div>

        {/* Up swipe indicator */}
        <motion.div
          className="flex flex-col items-center gap-1"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1, y: [-8, 0, -8] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        >
          <motion.span className="text-2xl">👆</motion.span>
          <span className="text-cream text-sm font-medium">Cart</span>
        </motion.div>

        {/* Right swipe indicator */}
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1, x: [10, 0, 10] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.25 }}
        >
          <span className="text-cream text-sm font-medium">Save</span>
          <motion.span className="text-2xl">👉</motion.span>
        </motion.div>
      </div>
    );
  }

  if (type === 'swipe-up') {
    return (
      <div className="flex items-center justify-center py-4">
        <motion.div
          className="flex flex-col items-center gap-2"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1, y: [-12, 0, -12] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.span className="text-3xl">👆</motion.span>
          <span className="text-cream text-sm font-medium">Swipe up to add to cart</span>
        </motion.div>
      </div>
    );
  }

  if (type === 'tap') {
    return (
      <div className="flex items-center justify-center py-4">
        <motion.div
          className="flex flex-col items-center gap-2"
          animate={{ scale: [1, 0.9, 1] }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.div
            className="w-12 h-12 rounded-full border-2 border-cream/50 flex items-center justify-center"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <span className="text-2xl">👆</span>
          </motion.div>
          <span className="text-cream text-sm font-medium">Tap to view details</span>
        </motion.div>
      </div>
    );
  }

  if (type === 'swipe-left') {
    return (
      <div className="flex items-center justify-center py-4">
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1, x: [-15, 0, -15] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <motion.span className="text-2xl">👈</motion.span>
          <span className="text-cream text-sm font-medium">Swipe left to remove or move</span>
        </motion.div>
      </div>
    );
  }

  return null;
};

export default GestureDemo;
