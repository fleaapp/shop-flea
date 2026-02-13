import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface ConnectPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ConnectPaymentDialog = ({ open, onOpenChange }: ConnectPaymentDialogProps) => {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent hideCloseButton className="w-[88vw] max-w-sm rounded-3xl border-[3px] border-charcoal bg-card p-6 pt-8 pb-6" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-lg">
            💳 Connect a Payment Method
          </DialogTitle>
          <DialogDescription className="text-center text-balance max-w-[260px] mx-auto">
            To sell on Flea, connect Stripe or PayPal to receive payments directly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2 flex flex-col items-center w-full max-w-[220px] mx-auto">
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate('/settings');
            }}
            className="w-full h-11 rounded-full bg-charcoal text-white hover:bg-charcoal-light border-none"
          >
            💳 Connect Stripe
          </Button>
          <Button
            disabled
            className="w-full h-11 rounded-full opacity-50 border-none"
            variant="outline"
          >
            🅿️ Connect PayPal (Coming Soon)
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              navigate(-1);
            }}
            className="w-full h-10 text-muted-foreground mb-1"
          >
            Go Back
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectPaymentDialog;
