import { X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import orderReceiptImage from '@/assets/order-success-receipt.png';

interface OrderSuccessDialogProps {
  open: boolean;
  onClose: () => void;
}

const OrderSuccessDialog = ({ open, onClose }: OrderSuccessDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent 
        className="bg-transparent border-none shadow-none p-0 max-w-[280px] sm:max-w-[320px] md:max-w-[360px] w-[75vw] flex flex-col items-center [&>div]:bg-black/40 [&>div]:backdrop-blur-md"
        hideCloseButton
      >
        {/* Receipt Image with slight tilt */}
        <div className="relative transform -rotate-3 transition-transform hover:rotate-0 duration-300">
          <img 
            src={orderReceiptImage} 
            alt="Order Successful Receipt" 
            className="w-full h-auto drop-shadow-2xl"
          />
        </div>
        
        {/* Close button at bottom */}
        <button
          onClick={onClose}
          className="mt-6 text-white/80 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="h-7 w-7 sm:h-8 sm:w-8" />
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default OrderSuccessDialog;
