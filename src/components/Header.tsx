import { Search, SlidersHorizontal } from 'lucide-react';
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
  return <header className="flex items-center justify-between px-6 py-4">
      <img src={fleaLogo} alt="FLEA" className="h-8 w-auto" />
      
      <div className="flex items-center gap-[4px]">
        <Button variant="outline" size="icon" onClick={onSearchClick} className="h-12 w-12 rounded-xl border-2 border-border bg-card hover:bg-secondary">
          <Search className="h-5 w-5" />
        </Button>
        
        <Button variant="outline" size="icon" onClick={onFilterClick} className="h-12 w-12 rounded-xl border-2 border-border bg-card hover:bg-secondary">
          <SlidersHorizontal className="h-5 w-5" />
        </Button>
      </div>
    </header>;
};
export default Header;