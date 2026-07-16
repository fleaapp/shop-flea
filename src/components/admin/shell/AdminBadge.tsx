import { cn } from '@/lib/utils';

export type AdminBadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'accent';

const toneStyles: Record<AdminBadgeTone, string> = {
  success: 'bg-primary/20 text-foreground border-primary/40',
  warning: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  danger: 'bg-destructive/10 text-destructive border-destructive/30',
  neutral: 'bg-muted text-muted-foreground border-border',
  info: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
  accent: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
};

interface AdminBadgeProps {
  tone?: AdminBadgeTone;
  children: React.ReactNode;
  className?: string;
}

export function AdminBadge({ tone = 'neutral', children, className }: AdminBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap',
        toneStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusToneMap: Record<string, AdminBadgeTone> = {
  active: 'success',
  approved: 'success',
  resolved: 'success',
  delivered: 'success',
  sold: 'info',
  shipped: 'info',
  featured: 'accent',
  pending: 'warning',
  requested: 'warning',
  suspended: 'warning',
  hidden: 'warning',
  refunded: 'warning',
  spam: 'warning',
  removed: 'neutral',
  deleted: 'neutral',
  archived: 'neutral',
  blocked: 'danger',
  banned: 'danger',
  disputed: 'danger',
  failed: 'danger',
};

export function toneForStatus(status?: string | null): AdminBadgeTone {
  if (!status) return 'neutral';
  return statusToneMap[status.toLowerCase()] ?? 'neutral';
}

export function statusLabel(status: string): string {
  if (status === 'removed') return 'Deleted';
  return status.charAt(0).toUpperCase() + status.slice(1);
}
