import { X } from 'lucide-react';
import { COLOUR_SWATCHES } from '@/utils/colourSwatches';

interface FilterChipProps {
  label: string;
  onRemove: () => void;
  colourSwatch?: string; // colour name to show a swatch circle
}

const FilterChip = ({ label, onRemove, colourSwatch }: FilterChipProps) => {
  const swatchBg = colourSwatch
    ? COLOUR_SWATCHES[colourSwatch] || 'repeating-linear-gradient(90deg, #ff6b6b, #ff6b6b 10px, #ffd93d 10px, #ffd93d 20px, #6bcf7f 20px, #6bcf7f 30px, #4d96ff 30px, #4d96ff 40px)'
    : null;

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground">
      {swatchBg && (
        <span
          className="h-3 w-3 rounded-full flex-shrink-0 border border-border/40"
          style={{ background: swatchBg }}
        />
      )}
      <span>{label}</span>
      <button
        onClick={onRemove}
        className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};

export default FilterChip;
