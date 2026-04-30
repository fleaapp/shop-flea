import { Skeleton } from '@/components/ui/skeleton';

/**
 * Lightweight skeleton shown while a route's lazy chunk is loading.
 * Mimics the general app layout (header strip + content + bottom nav gap)
 * so the perceived load feels instant and not blank.
 */
const PageSkeleton = () => (
  <div className="fixed inset-0 flex flex-col bg-background">
    {/* Header strip */}
    <div className="flex items-center justify-between px-4 pt-6 pb-3">
      <Skeleton className="h-9 w-9 rounded-full" />
      <Skeleton className="h-6 w-24 rounded-md" />
      <Skeleton className="h-9 w-9 rounded-full" />
    </div>

    {/* Content blocks */}
    <div className="flex-1 overflow-hidden px-4 space-y-3">
      <Skeleton className="h-44 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
        <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
      </div>
    </div>

    {/* Bottom nav placeholder */}
    <div className="flex justify-center pb-9 pt-3">
      <Skeleton className="h-12 w-72 rounded-full" />
    </div>
  </div>
);

export default PageSkeleton;
