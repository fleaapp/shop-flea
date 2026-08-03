import { Skeleton } from '@/components/ui/skeleton';

interface ListingGridSkeletonProps {
  /** Number of placeholder cards to render. */
  count?: number;
}

/**
 * Placeholder grid shown while a user's listings load.
 * Mirrors the 2-column, 4:5 card layout used across profile and wishlist grids.
 */
const ListingGridSkeleton = ({ count = 4 }: ListingGridSkeletonProps) => (
  <div className="grid grid-cols-2 gap-3 px-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="space-y-2">
        <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
        <Skeleton className="h-3 w-3/4 rounded-md" />
        <Skeleton className="h-3 w-1/3 rounded-md" />
      </div>
    ))}
  </div>
);

export default ListingGridSkeleton;
