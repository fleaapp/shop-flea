import { cn } from '@/lib/utils';

interface AdminStatChipProps {
  label: string;
  value: number | string;
  emoji?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

const toneMap = {
  default: 'bg-card text-foreground border-border',
  success: 'bg-primary/15 text-foreground border-primary/30',
  warning: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30',
  danger: 'bg-destructive/10 text-destructive border-destructive/30',
};

export function AdminStatChip({ label, value, emoji, tone = 'default', className }: AdminStatChipProps) {
  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap',
        toneMap[tone],
        className,
      )}
    >
      {emoji && <span>{emoji}</span>}
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

export function AdminStatChipRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}
