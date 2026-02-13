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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-lg">
            Connect a Payment Method
          </DialogTitle>
          <DialogDescription className="text-center">
            To sell on Flea, connect Stripe or PayPal to receive payments directly.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate('/settings');
            }}
            className="w-full h-12 rounded-full bg-charcoal text-white hover:bg-charcoal-light"
          >
            💳 Connect Stripe
          </Button>
          <Button
            disabled
            className="w-full h-12 rounded-full opacity-50"
            variant="outline"
          >
            🅿️ Connect PayPal (Coming Soon)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectPaymentDialog;
