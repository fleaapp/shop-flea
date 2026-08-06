import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface ShippingStep {
  key: 'purchased' | 'shipped' | 'in_transit' | 'delivered' | 'completed' | 'refunded';
  label: string;
  icon: string;
  timestamp: string | null;
  note?: string | null;
}

interface ShippingStatusTrackerProps {
  createdAt?: string | null;
  shippedAt: string | null;
  inTransitAt?: string | null;
  deliveredAt: string | null;
  completedAt?: string | null;
  disputeWindowEndsAt?: string | null;
  refundedAt?: string | null;
  role?: 'buyer' | 'seller';
  status: 'awaiting' | 'shipped' | 'delivered' | 'completed' | 'refunded';
}

const formatTimestamp = (ts: string) => format(new Date(ts), "MMM d, h:mmaaa");

const ShippingStatusTracker = ({
  createdAt,
  shippedAt,
  inTransitAt,
  deliveredAt,
  completedAt,
  disputeWindowEndsAt,
  refundedAt,
  role = 'buyer',
  status,
}: ShippingStatusTrackerProps) => {
  const isRefunded = status === 'refunded';
  const isCompleted = status === 'completed' || !!completedAt;

  const completionNote = (() => {
    if (isCompleted) return null;
    if (!deliveredAt) return null;
    const auto = disputeWindowEndsAt ? formatTimestamp(disputeWindowEndsAt) : null;
    if (role === 'seller') {
      return auto
        ? `Payout releases when the buyer confirms, or automatically ${auto}.`
        : 'Payout releases when the buyer confirms.';
    }
    return auto
      ? `Confirm your order or report an issue - auto-completes ${auto}.`
      : 'Confirm your order or report an issue.';
  })();

  const steps: ShippingStep[] = [
    {
      key: 'purchased',
      label: 'Purchased',
      icon: '🛍️',
      timestamp: createdAt || shippedAt,
    },
    {
      key: 'shipped',
      label: 'Shipped',
      icon: '✈️',
      timestamp: shippedAt,
    },
    {
      key: 'in_transit',
      label: 'In transit',
      icon: '🚚',
      timestamp: inTransitAt ?? null,
    },
  ];

  if (isRefunded) {
    steps.push({
      key: 'refunded',
      label: 'Refunded',
      icon: '↩️',
      timestamp: refundedAt ?? null,
    });
  } else {
    steps.push(
      {
        key: 'delivered',
        label: 'Delivered',
        icon: '📫',
        timestamp: deliveredAt,
      },
      {
        key: 'completed',
        label: isCompleted
          ? role === 'seller'
            ? 'Payout released'
            : 'Order complete'
          : 'Complete',
        icon: role === 'seller' ? '💰' : '✅',
        timestamp: completedAt ?? null,
        note: completionNote,
      },
    );
  }

  const completedKeys = new Set<string>();
  completedKeys.add('purchased');
  if (shippedAt) completedKeys.add('shipped');
  if (inTransitAt || deliveredAt) completedKeys.add('in_transit');
  if (deliveredAt) completedKeys.add('delivered');
  if (isCompleted) completedKeys.add('completed');
  if (isRefunded) completedKeys.add('refunded');

  const currentKey = isRefunded
    ? 'refunded'
    : isCompleted
      ? 'completed'
      : deliveredAt
        ? 'delivered'
        : inTransitAt
          ? 'in_transit'
          : shippedAt
            ? 'shipped'
            : 'purchased';

  return (
    <div className="rounded-xl bg-card overflow-hidden">
      <div className="bg-muted-foreground/20 px-4 py-2 text-sm font-medium text-muted-foreground">
        Order Status
      </div>
      <div className="p-4 pl-6">
        {steps.map((step, i) => {
          const stepDone = completedKeys.has(step.key);
          const isCurrent = step.key === currentKey;
          const isLast = i === steps.length - 1;
          const isRefundStep = step.key === 'refunded';

          const nextCompleted = !isLast && completedKeys.has(steps[i + 1].key);

          return (
            <div key={step.key} className="flex gap-3 items-start">
              {/* Timeline column */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-[15px] transition-colors duration-500 shrink-0',
                    stepDone
                      ? isRefundStep
                        ? 'bg-destructive/20'
                        : 'bg-primary'
                      : 'bg-muted',
                  )}
                >
                  {step.icon}
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      'w-1 flex-1 min-h-[24px] transition-colors duration-500',
                      stepDone && nextCompleted ? 'bg-primary' : 'bg-border',
                    )}
                  />
                )}
              </div>

              {/* Content column */}
              <div className={cn('pb-4', isLast && 'pb-0')}>
                <div
                  className={cn(
                    'flex flex-col justify-center',
                    !(stepDone && step.timestamp) && !step.note && 'min-h-[32px]',
                  )}
                >
                  <p
                    className={cn(
                      'text-sm leading-5 transition-all duration-300',
                      stepDone
                        ? isRefundStep
                          ? 'font-semibold text-destructive'
                          : isCurrent
                            ? 'font-semibold text-foreground'
                            : 'font-medium text-foreground'
                        : 'font-medium text-muted-foreground/50',
                    )}
                  >
                    {step.label}
                  </p>
                  {stepDone && step.timestamp && (
                    <p className="text-xs text-muted-foreground mt-0.5 animate-in fade-in duration-500">
                      {formatTimestamp(step.timestamp)}
                    </p>
                  )}
                  {!stepDone && step.note && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                      {step.note}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShippingStatusTracker;
