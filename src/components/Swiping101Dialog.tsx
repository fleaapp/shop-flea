import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface Swiping101DialogProps {
  open: boolean;
  onComplete: () => void;
}

const Swiping101Dialog = ({ open, onComplete }: Swiping101DialogProps) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="w-[90vw] max-w-sm rounded-3xl border-2 border-charcoal/40 bg-card p-6"
        hideCloseButton
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          {/* Header */}
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Swiping 101
          </h2>
          
          {/* Subheader */}
          <p className="text-sm text-muted-foreground mb-6">
            Fundamentals of Flea
          </p>
          
          {/* Body - Gesture Instructions */}
          <div className="space-y-3 text-left px-4 mb-8">
            <div className="flex items-center gap-3 text-base">
              <span className="text-lg">Swipe 👉</span>
              <span className="text-muted-foreground">=</span>
              <span>Add to Wishlist 💌</span>
            </div>
            <div className="flex items-center gap-3 text-base">
              <span className="text-lg">Swipe 👆</span>
              <span className="text-muted-foreground">=</span>
              <span>Add to Cart 🛒</span>
            </div>
            <div className="flex items-center gap-3 text-base">
              <span className="text-lg">Swipe 👈</span>
              <span className="text-muted-foreground">=</span>
              <span>Pass ❌</span>
            </div>
            <div className="flex items-center gap-3 text-base">
              <span className="text-lg">Tap card 👇</span>
              <span className="text-muted-foreground">=</span>
              <span>More details</span>
            </div>
          </div>
          
          {/* Button */}
          <Button
            onClick={onComplete}
            className="px-8 h-12 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90"
          >
            Got it! Let's go! 🤘
          </Button>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default Swiping101Dialog;
