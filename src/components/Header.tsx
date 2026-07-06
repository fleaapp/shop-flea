import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import fleaLogo from '@/assets/flea-logo.png';

interface HeaderProps {
  onSearchClick?: () => void;
  onFilterClick?: () => void;
  onUndoClick?: () => void;
  canUndo?: boolean;
}

const Header = ({
  onSearchClick,
  onFilterClick,
  onUndoClick,
  canUndo = false
}: HeaderProps) => {
  return <header className="flex items-center justify-between px-6 max-[375px]:px-4 py-4 max-[375px]:py-3">
      <img src={fleaLogo} alt="FLEA" className="h-8 max-[375px]:h-6 w-auto" decoding="async" />
      
      <div className="flex items-center gap-[4px] max-[375px]:gap-1">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={onUndoClick} 
          disabled={!canUndo}
          data-onboarding="undo-button"
          className="h-12 w-12 max-[375px]:h-10 max-[375px]:w-10 rounded-xl border-2 border-border bg-card hover:bg-secondary text-lg max-[375px]:text-base disabled:opacity-40"
        >
          ↩️
        </Button>
        
        <Button variant="outline" size="icon" onClick={onSearchClick} className="h-12 w-12 max-[375px]:h-10 max-[375px]:w-10 rounded-xl border-2 border-border bg-card hover:bg-secondary text-lg max-[375px]:text-base">
          🔍
        </Button>
        
        <Button variant="outline" size="icon" onClick={onFilterClick} className="h-12 w-12 max-[375px]:h-10 max-[375px]:w-10 rounded-xl border-2 border-border bg-card hover:bg-secondary">
          <SlidersHorizontal className="h-5 w-5 max-[375px]:h-4 max-[375px]:w-4" />
        </Button>
      </div>
    </header>;
};
export default Header;