import { cn } from '@/lib/utils';

export interface ChipOption<T extends string> {
  key: T;
  label: string;
  emoji?: string;
  count?: number;
}

interface AdminChipFilterProps<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}

export function AdminChipFilter<T extends string>({ options, value, onChange, className }: AdminChipFilterProps<T>) {
  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors active:scale-[0.97]',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-accent/40',
            )}
          >
            {opt.emoji && <span>{opt.emoji}</span>}
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span
                className={cn(
                  'ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                  active ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground',
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
