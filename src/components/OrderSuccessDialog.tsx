import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogOverlay } from '@/components/ui/dialog';
import orderReceiptImage from '@/assets/order-success-receipt.png';

interface OrderSuccessDialogProps {
  open: boolean;
  onClose: () => void;
}

const OrderSuccessDialog = ({ open, onClose }: OrderSuccessDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
      <DialogContent 
        className="bg-transparent border-none shadow-none p-0 max-w-[280px] sm:max-w-[320px] md:max-w-[360px] w-[75vw] flex flex-col items-center"
        hideCloseButton
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 text-white/80 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="h-6 w-6 sm:h-7 sm:w-7" />
        </button>
        
        {/* Receipt Image with slight tilt */}
        <div className="relative transform -rotate-3 transition-transform hover:rotate-0 duration-300">
          <img 
            src={orderReceiptImage} 
            alt="Order Successful Receipt" 
            className="w-full h-auto drop-shadow-2xl"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderSuccessDialog;
