import { cn } from '@/lib/utils';

interface ListingTagProps {
  label: string;
  variant?: 'default' | 'highlight' | 'muted';
}

const ListingTag = ({ label, variant = 'default' }: ListingTagProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        variant === 'default' && 'bg-tag text-charcoal-light',
        variant === 'highlight' && 'bg-primary text-primary-foreground',
        variant === 'muted' && 'bg-muted-foreground/20 text-muted-foreground'
      )}
    >
      {label}
    </span>
  );
};

export default ListingTag;
