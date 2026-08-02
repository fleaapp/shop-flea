import { useListingEngagementCounts } from '@/hooks/useListingEngagementCounts';

interface EngagementBadgesProps {
  listingId?: string | null;
  /** lg = detail drawer + swipe cards, sm = grid / small cards */
  size?: 'sm' | 'lg';
  className?: string;
}

export const formatEngagementCount = (n: number) => (n > 99 ? '99+' : String(n));

const EngagementBadges = ({ listingId, size = 'lg', className = '' }: EngagementBadgesProps) => {
  const { cart, wishlist } = useListingEngagementCounts(listingId);

  if (cart <= 0 && wishlist <= 0) return null;

  const circle =
    size === 'lg'
      ? 'h-8 w-8 text-sm'
      : 'h-6 w-6 text-[11px]';
  const label =
    size === 'lg'
      ? 'text-[10px] px-1.5'
      : 'text-[9px] px-1';

  const badge = (emoji: string, value: number) => (
    <div className="flex flex-col items-center">
      <div className={`${circle} rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center`}>
        {emoji}
      </div>
      <span
        className={`${label} font-semibold text-foreground mt-0.5 bg-background/70 backdrop-blur-sm rounded-full leading-tight`}
      >
        {formatEngagementCount(value)}
      </span>
    </div>
  );

  return (
    <div
      className={`pointer-events-none flex flex-col items-center ${size === 'lg' ? 'gap-2' : 'gap-1.5'} ${className}`}
    >
      {cart > 0 && badge('🛒', cart)}
      {wishlist > 0 && badge('💌', wishlist)}
    </div>
  );
};

export default EngagementBadges;
