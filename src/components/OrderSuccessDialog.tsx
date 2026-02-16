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

  // iOS 18 (Safari) can report a different visible viewport height due to browser chrome;
  // we nudge the close button up only there, and only for iPhone 12–15-ish viewports.
  const iosMajorVersion = (() => {
    if (typeof navigator === 'undefined') return null;
    const match = navigator.userAgent.match(/OS (\d+)[._]\d+/);
    return match ? Number(match[1]) : null;
  })();

  const shouldNudgeCloseForIOS18 = (() => {
    if (iosMajorVersion !== 18 || typeof window === 'undefined') return false;

    const screenW = Math.min(window.screen.width, window.screen.height);
    const screenH = Math.max(window.screen.width, window.screen.height);

    // iPhone 12 mini → 15 Pro Max (CSS px): ~360–430w, ~780–932h
    return screenW <= 430 && screenH >= 780 && screenH <= 932;
  })();

  const closeButtonStyle = shouldNudgeCloseForIOS18
    ? { marginBottom: 'calc(6rem + env(safe-area-inset-bottom))' }
    : undefined;

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
          style={closeButtonStyle}
          className="mb-12 max-[413px]:mb-14 text-white/80 hover:text-white transition-colors pointer-events-auto z-10 outline-none focus:outline-none focus-visible:outline-none"
          aria-label="Close"
        >
          <X className="h-7 w-7 sm:h-8 sm:w-8" />
        </button>
      </DialogContent>
    </Dialog>
  );
};

export default OrderSuccessDialog;
