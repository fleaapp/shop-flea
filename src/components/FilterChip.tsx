import { X } from 'lucide-react';

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

const FilterChip = ({ label, onRemove }: FilterChipProps) => {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground">
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
