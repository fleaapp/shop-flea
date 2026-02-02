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
        className="w-[85vw] max-w-xs rounded-3xl border-2 border-charcoal bg-card p-6"
        hideCloseButton
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center"
        >
          {/* Header */}
          <h2 className="text-2xl font-bold text-foreground mb-2 mt-2">
            Swiping 101
          </h2>
          
          {/* Subheader */}
          <p className="text-sm text-muted-foreground mb-6">
            Fundamentals of Flea
          </p>
          
          {/* Body - Gesture Instructions */}
          <div className="space-y-3 text-center mb-8">
            <p className="text-base">Swipe 👉 = Add to Wishlist 💌</p>
            <p className="text-base">Swipe 👆 = Add to Cart 🛒</p>
            <p className="text-base">Swipe 👈 = Pass ❌</p>
            <p className="text-base">Tap card 👇 = More details</p>
          </div>
          
          {/* Button */}
          <div className="pb-2">
            <Button
              onClick={onComplete}
              className="px-8 h-12 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90"
            >
              Got it. Let's go! 🤘
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default Swiping101Dialog;
