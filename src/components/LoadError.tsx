import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="flex w-full flex-col items-center justify-center gap-4 px-4 py-12 text-center">
    <p className="text-sm text-muted-foreground">{message}</p>
    <Button variant="outline" onClick={onRetry}><RefreshCw className="mr-2 h-4 w-4" />Try again</Button>
  </div>;
}