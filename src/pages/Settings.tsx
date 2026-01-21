import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useDiscardedListings } from '@/hooks/useDiscardedListings';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

const Settings = () => {
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const { clearDiscarded } = useDiscardedListings();

  const handleRefreshDiscarded = async () => {
    const success = await clearDiscarded();
    if (success) {
      toast.success('Passed listings refreshed! You can browse them again.');
    } else {
      toast.error('Failed to refresh passed listings');
    }
  };

  const ProfileAvatar = () => (
    <Avatar className="h-5 w-5">
      <AvatarImage src={profile?.avatar_url || ''} alt="Profile" />
      <AvatarFallback className="text-xs">👤</AvatarFallback>
    </Avatar>
  );

  const settingsGroups = [
    {
      title: 'Account',
      items: [
        { icon: <ProfileAvatar />, label: 'Edit Profile' },
        { icon: <span className="text-base">🔁</span>, label: 'Refresh Passed Listings', action: handleRefreshDiscarded },
        { icon: <span className="text-base">🔒</span>, label: 'Privacy & Security' },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: <span className="text-base">❓</span>, label: 'FAQ' },
        { icon: <span className="text-base">🛠️</span>, label: 'Contact Support' },
      ],
    },
    {
      title: '',
      items: [
        { icon: <span className="text-base">🚪</span>, label: 'Logout', danger: true },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24 max-[375px]:pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background px-4 max-[375px]:px-3 py-4 max-[375px]:py-3">
        <h1 className="text-xl max-[375px]:text-lg font-bold text-foreground text-center">Settings</h1>
      </header>
      
      {/* Settings Groups */}
      <div className="px-4 max-[375px]:px-3 space-y-6 max-[375px]:space-y-4">
        {settingsGroups.map((group, idx) => (
          <div key={group.title || idx}>
            {group.title && (
              <h2 className="mb-3 max-[375px]:mb-2 text-sm max-[375px]:text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {group.title}
              </h2>
            )}
            
            <div className="space-y-2 max-[375px]:space-y-1.5">
              {group.items.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between rounded-2xl bg-card p-4 max-[375px]:p-3 card-shadow cursor-pointer ${item.danger ? 'text-destructive' : ''}`}
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
                  <div className="flex items-center gap-3 max-[375px]:gap-2">
                    <div className={item.danger ? 'text-destructive' : 'text-muted-foreground'}>{item.icon}</div>
                    <span className={`text-base max-[375px]:text-sm font-medium ${item.danger ? 'text-destructive' : 'text-foreground'}`}>{item.label}</span>
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
      <div className="mt-8 max-[375px]:mt-6 text-center">
        <p className="text-sm max-[375px]:text-xs text-muted-foreground">Version 1.0.0</p>
      </div>
      
      <BottomNav />
    </div>
  );
};

export default Settings;
