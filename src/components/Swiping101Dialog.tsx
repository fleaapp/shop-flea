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
        className="w-[85vw] max-w-xs rounded-3xl border-[3px] border-charcoal bg-card p-6"
        hideCloseButton
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          {/* Header */}
          <h2 className="text-[1.625rem] font-bold text-charcoal mb-2 mt-2">
            Swiping 101
          </h2>
          
          {/* Subheader */}
          <p className="text-sm text-charcoal/70 mb-6">
            Fundamentals of Flea
          </p>
          
          {/* Body - Gesture Instructions */}
          <div className="space-y-3 mb-8 flex flex-col items-center">
            <div className="grid grid-cols-[auto_auto_auto] gap-x-2 gap-y-3 text-base text-muted-foreground">
              <span className="text-right">Swipe 👉</span>
              <span className="text-center">=</span>
              <span className="text-left">Add to Wishlist 💌</span>
              
              <span className="text-right">Swipe 👆</span>
              <span className="text-center">=</span>
              <span className="text-left">Add to Cart 🛒</span>
              
              <span className="text-right">Swipe 👈</span>
              <span className="text-center">=</span>
              <span className="text-left">Pass ❌</span>
              
              <span className="text-right">Tap card 👇</span>
              <span className="text-center">=</span>
              <span className="text-left">More details</span>
            </div>
          </div>
          
          {/* Button */}
          <div className="pb-2">
            <Button
              onClick={onComplete}
              className="px-6 h-11 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90"
            >
              Got it. Let's go!&nbsp;🤘
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default Swiping101Dialog;
