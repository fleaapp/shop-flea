import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import fleaLogo from '@/assets/flea-logo.png';

interface HeaderProps {
  onSearchClick?: () => void;
  onFilterClick?: () => void;
}

const Header = ({
  onSearchClick,
  onFilterClick
}: HeaderProps) => {
  return <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
      <img src={fleaLogo} alt="FLEA" className="h-6 sm:h-8 w-auto" />
      
      <div className="flex items-center gap-1 sm:gap-[4px]">
        <Button variant="outline" size="icon" onClick={onSearchClick} className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl border-2 border-border bg-card hover:bg-secondary text-base sm:text-lg">
          🔍
        </Button>
        
        <Button variant="outline" size="icon" onClick={onFilterClick} className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl border-2 border-border bg-card hover:bg-secondary">
          <SlidersHorizontal className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>
      </div>
    </header>;
};
export default Header;