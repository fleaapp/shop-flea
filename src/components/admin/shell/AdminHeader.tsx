import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AdminHeaderProps {
  title: string;
  emoji?: string;
  onBack?: () => void;
  backTo?: string;
  right?: React.ReactNode;
  className?: string;
}

export function AdminHeader({ title, emoji, onBack, backTo = '/admin', right, className }: AdminHeaderProps) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate(backTo));
  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex items-center gap-2 bg-background/95 px-3 backdrop-blur-md',
        'pt-[calc(env(safe-area-inset-top)+12px)] pb-3',
        className,
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={handleBack}
        className="h-9 w-9 shrink-0 rounded-full"
        aria-label="Back"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <h1 className="flex-1 truncate text-center text-lg font-bold text-foreground">
        {emoji && <span className="mr-1.5">{emoji}</span>}
        {title}
      </h1>
      <div className="flex h-9 w-9 shrink-0 items-center justify-end">{right}</div>
    </header>
  );
}
