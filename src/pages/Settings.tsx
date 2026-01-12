import { ChevronRight, Lock, HelpCircle, Info, User, RefreshCw, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useDiscardedListings } from '@/hooks/useDiscardedListings';

const Settings = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { clearDiscarded } = useDiscardedListings();

  const handleRefreshDiscarded = async () => {
    const success = await clearDiscarded();
    if (success) {
      toast.success('Discarded listings refreshed! You can browse them again.');
    } else {
      toast.error('Failed to refresh discarded listings');
    }
  };

  const settingsGroups = [
    {
      title: 'Account',
      items: [
        { icon: <User className="h-5 w-5" />, label: 'Edit Profile' },
        { icon: <RefreshCw className="h-5 w-5" />, label: 'Refresh Discarded Listings', action: handleRefreshDiscarded },
        { icon: <Lock className="h-5 w-5" />, label: 'Privacy & Security' },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: <HelpCircle className="h-5 w-5" />, label: 'FAQ' },
        { icon: <Info className="h-5 w-5" />, label: 'About Flea' },
      ],
    },
    {
      title: '',
      items: [
        { icon: <LogOut className="h-5 w-5" />, label: 'Logout', danger: true },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 sm:pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background px-3 sm:px-4 py-3 sm:py-4">
        <h1 className="text-lg sm:text-xl font-bold text-foreground text-center">Settings</h1>
      </header>
      
      {/* Settings Groups */}
      <div className="px-3 sm:px-4 space-y-4 sm:space-y-6">
        {settingsGroups.map((group, idx) => (
          <div key={group.title || idx}>
            {group.title && (
              <h2 className="mb-2 sm:mb-3 text-xs sm:text-sm font-medium text-muted-foreground uppercase tracking-wide">
                {group.title}
              </h2>
            )}
            
            <div className="space-y-1.5 sm:space-y-2">
              {group.items.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between rounded-2xl bg-card p-3 sm:p-4 card-shadow cursor-pointer ${item.danger ? 'text-destructive' : ''}`}
                  onClick={async () => {
                    if (item.label === 'Logout') {
                      await signOut();
                      toast.success('Logged out');
                      navigate('/auth');
                    } else if (item.label === 'Edit Profile') {
                      navigate('/settings/profile');
                    } else if (item.action) {
                      await item.action();
                    } else if (!item.toggle) {
                      toast(`${item.label} clicked`);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className={item.danger ? 'text-destructive' : 'text-muted-foreground'}>{item.icon}</div>
                    <span className={`text-sm sm:text-base font-medium ${item.danger ? 'text-destructive' : 'text-foreground'}`}>{item.label}</span>
                  </div>
                  
                  {!item.danger && (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* Version */}
      <div className="mt-6 sm:mt-8 text-center">
        <p className="text-xs sm:text-sm text-muted-foreground">Version 1.0.0</p>
      </div>
      
      <BottomNav />
    </div>
  );
};

export default Settings;
