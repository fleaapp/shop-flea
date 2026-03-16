import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const CONDITIONS_INFO = [
  {
    name: 'New',
    description: 'Item has never been used or worn and is in perfect, unused condition.',
  },
  {
    name: 'Like New',
    description: 'Item has been used very lightly and shows no noticeable signs of wear.',
  },
  {
    name: 'Good',
    description: 'Item has visible signs of use, such as minor scratches, marks, or fading, but is fully functional.',
  },
  {
    name: 'Fair',
    description: 'Item shows significant signs of wear, including noticeable damage, stains, or imperfections, but remains usable.',
  },
];

const ConditionInfoPopover = () => (
  <Popover>
    <PopoverTrigger asChild>
      <button type="button" className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors">
        <Info className="h-4 w-4 text-muted-foreground" />
      </button>
    </PopoverTrigger>
    <PopoverContent className="w-72 p-4 rounded-2xl" side="top" align="start">
      <p className="text-sm font-semibold mb-3">Condition Guide</p>
      <div className="space-y-3">
        {CONDITIONS_INFO.map((c) => (
          <div key={c.name}>
            <p className="text-xs font-semibold text-foreground">{c.name}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{c.description}</p>
          </div>
        ))}
      </div>
    </PopoverContent>
  </Popover>
);

export default ConditionInfoPopover;
