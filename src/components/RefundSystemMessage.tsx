import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, ExternalLink, Clock } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface RefundRequestData {
  type: 'refund_request';
  buyer_username: string;
  reason: string;
  details: string;
  image_urls: string[];
  video_urls?: string[];
  media?: { url: string; kind: 'photo' | 'video' }[];
  capture_source?: string;
  payment_method?: string;
  requested_at: string;
}

interface RefundRejectedData {
  type: 'refund_rejected';
  seller_username: string;
  payment_method?: string;
  rejected_at: string;
}

interface RefundInitiatedData {
  type: 'refund_initiated';
  seller_username: string;
  payment_method?: string;
  initiated_at: string;
}

interface RefundReminderData {
  type: 'refund_reminder';
  payment_method?: string;
}

type RefundData = RefundRequestData | RefundRejectedData | RefundInitiatedData | RefundReminderData;

const PROVIDER_NAME = 'payment provider';

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

          {(() => {
            const mediaItems: { url: string; kind: 'photo' | 'video' }[] = d.media?.length
              ? d.media
              : [
                  ...(d.image_urls || []).map(url => ({ url, kind: 'photo' as const })),
                  ...(d.video_urls || []).map(url => ({ url, kind: 'video' as const })),
                ];
            if (!mediaItems.length) return null;
            return (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {mediaItems.map((m, i) =>
                    m.kind === 'video' ? (
                      <video
                        key={i}
                        src={m.url}
                        controls
                        playsInline
                        className="h-24 w-24 rounded-lg object-cover border border-border bg-black"
                      />
                    ) : (
                      <img
                        key={i}
                        src={m.url}
                        alt={`Evidence ${i + 1}`}
                        className="h-16 w-16 rounded-lg object-cover cursor-pointer border border-border hover:opacity-80 transition-opacity"
                        onClick={() => setExpandedImage(m.url)}
                      />
                    )
                  )}
                </div>
                {d.capture_source === 'live_camera' && (
                  <p className="text-[11px] text-muted-foreground">📷 Captured live in the Flea app.</p>
                )}
              </div>
            );
          })()}

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
                onClick={() => onRefund?.('stripe')}
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
                <span>The seller hasn't responded yet. Flea will review this automatically if they don't reply.</span>
              </div>
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
            <span className="text-base">🚫</span>
            <span className="font-semibold text-sm">Refund Rejected</span>
          </div>

          <p className="text-sm text-foreground">
            <span className="font-semibold">{formatUsername(d.seller_username)}</span> has rejected the refund request.
          </p>

          <p className="text-xs text-muted-foreground">
            The request has been escalated to Flea for review. We'll look at the evidence and update you in this chat.
          </p>
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
            <span className="font-semibold">{formatUsername(d.seller_username)}</span> has initiated a refund. It will return to your original payment method.
          </p>
        </div>
      </div>
    );
  }

  return null;
};

export default RefundSystemMessage;
