import { Dialog, DialogContent } from '@/components/ui/dialog';
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
      <DialogContent 
        className="w-[85vw] max-w-xs rounded-3xl border-[3px] border-charcoal bg-card p-6"
        hideCloseButton
        onPointerDownOutside={(e) => e.preventDefault()} 
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="text-center">
          <h2 className="text-[1.625rem] font-bold text-charcoal mb-2 mt-2">
            Connect Payment 💳
          </h2>
          <p className="text-sm text-charcoal/70 mb-6">
            To sell on Flea, connect Stripe or PayPal to receive payments directly.
          </p>
          
          <div className="flex flex-col items-center gap-3 pb-2">
            <Button
              onClick={() => {
                onOpenChange(false);
                navigate('/settings');
              }}
              className="px-6 h-11 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90"
            >
              Connect Stripe&nbsp;💳
            </Button>
            <Button
              disabled
              className="px-6 h-11 rounded-full opacity-50"
              variant="outline"
            >
              PayPal (Coming Soon)&nbsp;🅿️
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
                navigate(-1);
              }}
              className="text-muted-foreground hover:text-foreground h-10"
            >
              Go Back
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectPaymentDialog;
