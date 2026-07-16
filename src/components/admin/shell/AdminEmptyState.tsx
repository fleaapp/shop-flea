import { Skeleton } from '@/components/ui/skeleton';

interface AdminEmptyStateProps {
  emoji?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function AdminEmptyState({ emoji = '📭', title, description, action }: AdminEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 text-4xl">{emoji}</div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function AdminSkeletonList({ count = 6, className = 'h-16' }: { count?: number; className?: string }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={`w-full rounded-2xl ${className}`} />
      ))}
    </div>
  );
}
