import { cn } from '@/lib/utils';
import { COLOUR_SWATCHES } from '@/utils/colourSwatches';

interface ListingTagProps {
  label: string;
  variant?: 'default' | 'highlight' | 'muted';
  isSize?: boolean;
  colourSwatch?: string; // colour name to show a swatch circle
  size?: 'default' | 'sm';
}

// Size values that should be fully uppercased
const SIZE_VALUES = ['xs', 's', 'm', 'l', 'xl', 'xxl', 'one size'];

export const formatTagLabel = (label: string, isSize = false): string => {
  if (isSize || SIZE_VALUES.includes(label.toLowerCase())) {
    return label.toUpperCase();
  }
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const isSizeWithRuler = (label: string, isSize: boolean): boolean => {
  if (!isSize && !SIZE_VALUES.includes(label.toLowerCase())) return false;
  return !label.includes('"');
};

const ListingTag = ({ label, variant = 'default', isSize = false, colourSwatch, size = 'default' }: ListingTagProps) => {
  const formattedLabel = formatTagLabel(label, isSize);
  const showRuler = isSizeWithRuler(label, isSize);
  
  const swatchBg = colourSwatch
    ? COLOUR_SWATCHES[colourSwatch] || COLOUR_SWATCHES[colourSwatch.charAt(0).toUpperCase() + colourSwatch.slice(1)] || COLOUR_SWATCHES['Multi / Patterned']
    : null;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[10px] gap-0.5' : 'px-3 py-1 text-xs gap-1',
        variant === 'default' && 'bg-tag text-charcoal-light',
        variant === 'highlight' && 'bg-primary text-primary-foreground',
        variant === 'muted' && 'bg-muted-foreground/20 text-muted-foreground'
      )}
    >
      {swatchBg && (
        <span
          className="h-2.5 w-2.5 rounded-full flex-shrink-0 border border-border/40"
          style={{ background: swatchBg }}
        />
      )}
      {showRuler && <span className="text-[10px] leading-none">📏</span>}
      {formattedLabel}
    </span>
  );
};

export default ListingTag;
