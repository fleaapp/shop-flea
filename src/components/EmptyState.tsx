import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  /** Big emoji shown above the copy. */
  emoji: string;
  /** Short headline, e.g. "Your cart is empty". */
  title: string;
  /** Optional supporting line explaining what to do next. */
  description?: string;
  /** Optional primary action. */
  actionLabel?: string;
  onAction?: () => void;
  /** Minimum height helper so the state sits nicely mid-screen. */
  minHeightClass?: string;
  children?: ReactNode;
}

/**
 * Single shared empty state used across Cart, Wishlist, Orders, Sales and
 * Notifications so blank screens always look intentional, never broken.
 */
const EmptyState = ({
  emoji,
  title,
  description,
  actionLabel,
  onAction,
  minHeightClass = 'min-h-[50vh]',
  children,
}: EmptyStateProps) => (
  <div className={`flex w-full flex-col items-center justify-center px-4 text-center ${minHeightClass}`}>
    <span className="mb-4 text-6xl opacity-90" aria-hidden="true">{emoji}</span>
    <p className="text-lg font-medium text-muted-foreground">{title}</p>
    {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
    {actionLabel && onAction && (
      <Button
        onClick={onAction}
        className="mt-6 rounded-full bg-primary text-primary-foreground"
      >
        {actionLabel}
      </Button>
    )}
    {children}
  </div>
);

export default EmptyState;
