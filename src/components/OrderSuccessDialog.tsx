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
        className="bg-transparent border-none shadow-none p-0 max-w-[280px] sm:max-w-[320px] md:max-w-[360px] w-[75vw] flex flex-col items-center justify-center max-[430px]:mt-[-40px]"
        hideCloseButton
      >
        {/* Close button above receipt - with pointer-events enabled */}
        <button
          onClick={onClose}
          className="mb-4 max-[430px]:mb-6 bg-black/60 hover:bg-black/80 rounded-full p-2 text-white transition-colors pointer-events-auto z-10"
          aria-label="Close"
        >
          <X className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.5} />
        </button>
        
        {/* Receipt Image with slight tilt */}
        <div className="relative transform -rotate-3 transition-transform hover:rotate-0 duration-300 pointer-events-auto">
          <img 
            src={orderReceiptImage} 
            alt="Order Successful Receipt" 
            className={`w-full h-auto drop-shadow-2xl transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderSuccessDialog;
