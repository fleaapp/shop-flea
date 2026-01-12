import { cn } from '@/lib/utils';

interface ListingTagProps {
  label: string;
  variant?: 'default' | 'highlight' | 'muted';
  isSize?: boolean;
}

// Size values that should be fully uppercased
const SIZE_VALUES = ['xs', 's', 'm', 'l', 'xl', 'xxl', 'one size'];

export const formatTagLabel = (label: string, isSize = false): string => {
  if (isSize || SIZE_VALUES.includes(label.toLowerCase())) {
    return label.toUpperCase();
  }
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const ListingTag = ({ label, variant = 'default', isSize = false }: ListingTagProps) => {
  const formattedLabel = formatTagLabel(label, isSize);
  
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap',
        variant === 'default' && 'bg-tag text-charcoal-light',
        variant === 'highlight' && 'bg-primary text-primary-foreground',
        variant === 'muted' && 'bg-muted-foreground/20 text-muted-foreground'
      )}
    >
      {formattedLabel}
    </span>
  );
};

export default ListingTag;
