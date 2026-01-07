import { X, Heart, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SwipeActionsProps {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onUndo?: () => void;
  canUndo?: boolean;
}

const SwipeActions = ({ onSwipeLeft, onSwipeRight, onUndo, canUndo = false }: SwipeActionsProps) => {
  return (
    <div className="flex items-center justify-center gap-6 py-4">
      <Button
        variant="outline"
        size="icon"
        onClick={onSwipeLeft}
        className="h-14 w-14 rounded-full border-2 border-destructive bg-card text-destructive hover:bg-destructive hover:text-destructive-foreground transition-all duration-200"
      >
        <X className="h-6 w-6" />
      </Button>
      
      {canUndo && (
        <Button
          variant="outline"
          size="icon"
          onClick={onUndo}
          className="h-10 w-10 rounded-full border-2 border-muted-foreground bg-card text-muted-foreground hover:bg-muted transition-all duration-200"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      )}
      
      <Button
        variant="outline"
        size="icon"
        onClick={onSwipeRight}
        className="h-14 w-14 rounded-full border-2 border-price bg-card text-price hover:bg-price hover:text-card transition-all duration-200"
      >
        <Heart className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default SwipeActions;
