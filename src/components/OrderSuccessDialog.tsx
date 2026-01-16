import { X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useEffect, useState } from 'react';
import orderReceiptImage from '@/assets/order-success-receipt.png';

// Preload image on module load
const preloadImage = new Image();
preloadImage.src = orderReceiptImage;

interface OrderSuccessDialogProps {
  open: boolean;
  onClose: () => void;
}

const OrderSuccessDialog = ({ open, onClose }: OrderSuccessDialogProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    // Check if already cached
    if (preloadImage.complete) {
      setImageLoaded(true);
    } else {
      preloadImage.onload = () => setImageLoaded(true);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        className="bg-transparent border-none shadow-none p-0 w-full max-w-none h-[100dvh] flex flex-col items-center"
        hideCloseButton
      >
        {/* Receipt centered (slightly lower) */}
        <div className="flex-1 w-full flex items-center justify-center">
          <div className="w-[75vw] max-w-[280px] sm:max-w-[320px] md:max-w-[360px] translate-y-6 max-[413px]:translate-y-4">
            <div className="relative transform -rotate-3 transition-transform hover:rotate-0 duration-300 pointer-events-auto">
              <img 
                src={orderReceiptImage} 
                alt="Order Successful Receipt" 
                className={`w-full h-auto drop-shadow-2xl transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              />
            </div>
          </div>
        </div>

        {/* Close button anchored near bottom (responsive) */}
        <button
          onClick={onClose}
          className="mb-12 max-[413px]:mb-10 text-white/80 hover:text-white transition-colors pointer-events-auto z-10"
          aria-label="Close"
        >
          <X className="h-7 w-7 sm:h-8 sm:w-8" />
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default OrderSuccessDialog;
