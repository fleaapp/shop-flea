import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Headphones, MessageCircle, CheckCircle, BarChart3, ArrowLeft, Users, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DashboardHeaderProps {
  totalThreads: number;
  activeThreads: number;
  resolvedThreads: number;
}

export function DashboardHeader({ totalThreads, activeThreads, resolvedThreads }: DashboardHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="border-b border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary sm:h-10 sm:w-10">
            <Headphones className="h-4 w-4 text-primary-foreground sm:h-5 sm:w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground sm:text-xl">Flea Support</h1>
            <p className="hidden text-sm text-muted-foreground sm:block">Manage customer support conversations</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/admin/users')}>
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Users</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/admin/listings')}>
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">Listings</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/admin/transactions')}>
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Transactions</span>
          </Button>
          <div className="hidden items-center gap-2 sm:flex">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total:</span>
            <Badge variant="secondary">{totalThreads}</Badge>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="h-2 w-2 rounded-full bg-status-active" />
            <span className="hidden text-sm text-muted-foreground sm:inline">Active:</span>
            <Badge className="bg-status-active text-status-active-foreground">{activeThreads}</Badge>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <CheckCircle className="h-4 w-4 text-status-resolved" />
            <span className="hidden text-sm text-muted-foreground sm:inline">Resolved:</span>
            <Badge className="bg-status-resolved text-status-resolved-foreground">{resolvedThreads}</Badge>
          </div>
        </div>
      </div>
    </header>
  );
}
