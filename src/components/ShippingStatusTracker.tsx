import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export interface ShippingStep {
  key: 'shipped' | 'in_transit' | 'delivered';
  label: string;
  icon: string;
  timestamp: string | null;
}

interface ShippingStatusTrackerProps {
  createdAt?: string | null;
  shippedAt: string | null;
  inTransitAt?: string | null;
  deliveredAt: string | null;
  status: 'awaiting' | 'shipped' | 'delivered';
}

const formatTimestamp = (ts: string) => {
  const d = new Date(ts);
  return format(d, "MMM d, h:mmaaa");
};

const ShippingStatusTracker = ({
  createdAt,
  shippedAt,
  inTransitAt,
  deliveredAt,
  status,
}: ShippingStatusTrackerProps) => {
  // Build steps with timestamps
  const steps: ShippingStep[] = [
    {
      key: 'shipped',
      label: 'Purchased',
      icon: '🛍️',
      timestamp: createdAt || shippedAt,
    },
    {
      key: 'in_transit',
      label: 'Shipped',
      icon: '📦',
      timestamp: shippedAt,
    },
    {
      key: 'delivered',
      label: 'Delivered',
      icon: '📫',
      timestamp: deliveredAt,
    },
  ];

  // Determine which steps are completed
  // "purchased" is always completed once the order exists
  const completedKeys = new Set<string>();
  completedKeys.add('shipped'); // purchased step always done
  if (shippedAt) completedKeys.add('in_transit');
  if (deliveredAt) completedKeys.add('delivered');

  // Current step is the last completed one
  const currentKey =
    status === 'delivered'
      ? 'delivered'
      : status === 'shipped'
        ? 'in_transit'
        : 'shipped';

  return (
    <div className="rounded-xl bg-card overflow-hidden">
      <div className="bg-muted-foreground/20 px-4 py-2 text-sm font-medium text-muted-foreground">
        Shipping Status
      </div>
      <div className="p-4 pl-6">
        {steps.map((step, i) => {
          const isCompleted = completedKeys.has(step.key);
          const isCurrent = step.key === currentKey;
          const isLast = i === steps.length - 1;

          // Next step completed?
          const nextCompleted = !isLast && completedKeys.has(steps[i + 1].key);

          return (
             <div key={step.key} className="flex gap-3 items-start">
              {/* Timeline column */}
              <div className="flex flex-col items-center">
                {/* Circle indicator */}
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-[15px] transition-colors duration-500 shrink-0',
                    isCompleted
                      ? 'bg-primary'
                      : 'bg-muted'
                  )}
                >
                  {step.icon}
                </div>
                {/* Connecting line */}
                {!isLast && (
                  <div
                    className={cn(
                      'w-1 flex-1 min-h-[24px] transition-colors duration-500',
                      isCompleted && nextCompleted
                        ? 'bg-primary'
                        : 'bg-border'
                    )}
                  />
                )}
              </div>

              {/* Content column */}
              <div className={cn('pb-4', isLast && 'pb-0')}>
                <div className={cn(
                  'flex flex-col justify-center',
                  !(isCompleted && step.timestamp) && 'min-h-[32px]'
                )}>
                  <p
                    className={cn(
                      'text-sm leading-5 transition-all duration-300',
                      isCompleted
                        ? isCurrent
                          ? 'font-semibold text-foreground'
                          : 'font-medium text-foreground'
                        : 'font-medium text-muted-foreground/50'
                    )}
                  >
                    {step.label}
                  </p>
                  {isCompleted && step.timestamp && (
                    <p className="text-xs text-muted-foreground mt-0.5 animate-in fade-in duration-500">
                      {formatTimestamp(step.timestamp)}
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
