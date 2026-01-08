import { Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
interface HeaderProps {
  onSearchClick?: () => void;
  onFilterClick?: () => void;
}
const Header = ({
  onSearchClick,
  onFilterClick
}: HeaderProps) => {
  return <header className="flex items-center justify-between px-6 py-4">
      <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
        FLEA
      </h1>
      
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