import { cn } from '@/lib/utils';

interface ListingTagProps {
  label: string;
  variant?: 'default' | 'highlight';
}

const ListingTag = ({ label, variant = 'default' }: ListingTagProps) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium',
        variant === 'default' 
          ? 'bg-charcoal text-cream' 
          : 'bg-primary text-primary-foreground'
      )}
    >
      {label}
    </span>
  );
};

export default ListingTag;
