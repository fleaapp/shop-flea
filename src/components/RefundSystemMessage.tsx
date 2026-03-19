import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, XCircle, ExternalLink, Clock } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface RefundRequestData {
  type: 'refund_request';
  buyer_username: string;
  reason: string;
  details: string;
  image_urls: string[];
  payment_method: string;
  requested_at: string;
}

interface RefundRejectedData {
  type: 'refund_rejected';
  seller_username: string;
  payment_method: string;
  rejected_at: string;
}

interface RefundInitiatedData {
  type: 'refund_initiated';
  seller_username: string;
  payment_method: string;
  initiated_at: string;
}

interface RefundReminderData {
  type: 'refund_reminder';
  payment_method: string;
}

type RefundData = RefundRequestData | RefundRejectedData | RefundInitiatedData | RefundReminderData;

const getPaymentProviderUrl = (paymentMethod: string, role: 'buyer' | 'seller') => {
  if (paymentMethod === 'paypal') {
    return role === 'buyer'
      ? 'https://www.paypal.com/disputes'
      : 'https://www.paypal.com/disputes';
  }
  return role === 'buyer'
    ? 'https://support.stripe.com'
    : 'https://dashboard.stripe.com/payments';
};

const getPaymentProviderName = (paymentMethod: string) => {
  return paymentMethod === 'paypal' ? 'PayPal' : 'Stripe';
};

const formatUsername = (u: string) => u.startsWith('@') ? u : `@${u}`;

interface RefundSystemMessageProps {
  messageType: string;
  messageContent: string;
  isSeller: boolean;
  onReject?: () => void;
  onRefund?: (paymentMethod: string) => void;
  isActioning?: boolean;
  hasSellerResponded?: boolean;
  showAutoReminder?: boolean;
}

const RefundSystemMessage = ({
  messageType,
  messageContent,
  isSeller,
  onReject,
  onRefund,
  isActioning,
  hasSellerResponded,
  showAutoReminder,
}: RefundSystemMessageProps) => {
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  let data: RefundData;
  try {
    data = JSON.parse(messageContent);
  } catch {
    return <p className="text-sm text-muted-foreground italic">System message</p>;
  }

  if (data.type === 'refund_request') {
    const d = data as RefundRequestData;
    return (
      <div className="mx-4 my-3">
        <div className="rounded-2xl border-2 border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <span className="text-base">⚠️</span>
            <span className="font-semibold text-sm">Refund Request</span>
          </div>

          <p className="text-sm text-foreground">
            <span className="font-semibold">{formatUsername(d.buyer_username)}</span> has requested a refund.
          </p>

          <div className="space-y-1">
            <p className="text-sm"><span className="font-medium">Reason:</span> {d.reason}</p>
            {d.details && (
              <p className="text-sm"><span className="font-medium">Details:</span> {d.details}</p>
            )}
          </div>

          {d.image_urls?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {d.image_urls.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Evidence ${i + 1}`}
                  className="h-16 w-16 rounded-lg object-cover cursor-pointer border border-border hover:opacity-80 transition-opacity"
                  onClick={() => setExpandedImage(url)}
                />
              ))}
            </div>
          )}

          {isSeller && !hasSellerResponded && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={onReject}
                disabled={isActioning}
                className="rounded-full flex-1 h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90 border-destructive gap-1.5 items-center justify-center"
              >
                <span className="leading-none">🚫</span>
                Reject
              </Button>
              <Button
                size="sm"
                onClick={() => onRefund?.(d.payment_method)}
                disabled={isActioning}
                className="rounded-full flex-1 h-12 bg-charcoal text-white hover:bg-charcoal-light gap-1.5 items-center justify-center"
              >
                <span className="leading-none">↩️</span>
                Refund Order
              </Button>
            </div>
          )}

          {!isSeller && !hasSellerResponded && showAutoReminder && (
            <div className="pt-2 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>The seller hasn't responded yet. You can request your refund directly.</span>
              </div>
              <Button
                size="sm"
                onClick={() => window.open(getPaymentProviderUrl(d.payment_method, 'buyer'), '_blank')}
                className="rounded-full w-full bg-charcoal text-white hover:bg-charcoal-light"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Request Refund via {getPaymentProviderName(d.payment_method)}
              </Button>
            </div>
          )}
        </div>

        <Dialog open={!!expandedImage} onOpenChange={() => setExpandedImage(null)}>
          <DialogContent className="max-w-[95vw] max-h-[90vh] p-1 bg-transparent border-none shadow-none">
            {expandedImage && (
              <img src={expandedImage} alt="Evidence" className="w-full h-full object-contain rounded-xl" />
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (data.type === 'refund_rejected') {
    const d = data as RefundRejectedData;
    return (
      <div className="mx-4 my-3">
        <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="h-4 w-4" />
            <span className="font-semibold text-sm">Refund Rejected</span>
          </div>

          <p className="text-sm text-foreground">
            <span className="font-semibold">{formatUsername(d.seller_username)}</span> has rejected the refund request.
          </p>

          <p className="text-xs text-muted-foreground">
            Flea does not hold payments and cannot process refunds directly. Please escalate this request via your original payment provider.
          </p>

          {!isSeller && (
            <Button
              size="sm"
              onClick={() => window.open(getPaymentProviderUrl(d.payment_method, 'buyer'), '_blank')}
              className="rounded-full w-full bg-charcoal text-white hover:bg-charcoal-light"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Request Refund via {getPaymentProviderName(d.payment_method)}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (data.type === 'refund_initiated') {
    const d = data as RefundInitiatedData;
    return (
      <div className="mx-4 my-3">
        <div className="rounded-2xl border-2 border-green-400/50 bg-green-50 dark:bg-green-950/30 p-4 space-y-2">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span className="font-semibold text-sm">Refund Initiated</span>
          </div>

          <p className="text-sm text-foreground">
            <span className="font-semibold">{formatUsername(d.seller_username)}</span> has initiated a refund via {getPaymentProviderName(d.payment_method)}.
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default RefundSystemMessage;
