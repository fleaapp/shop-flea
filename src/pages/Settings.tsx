import { ChevronRight, Bell, Lock, HelpCircle, Info, User, RefreshCw, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Switch } from '@/components/ui/switch';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';

const Settings = () => {
  const navigate = useNavigate();

  const settingsGroups = [
    {
      title: 'Preferences',
      items: [
        { icon: <Bell className="h-5 w-5" />, label: 'Push Notifications', toggle: true },
      ],
    },
    {
      title: 'Account',
      items: [
        { icon: <User className="h-5 w-5" />, label: 'Edit Profile' },
        { icon: <RefreshCw className="h-5 w-5" />, label: 'Refresh Discarded Listings' },
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
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="px-4 py-4">
        <h1 className="text-xl font-bold text-foreground text-center">Settings</h1>
      </header>
      
      {/* Settings Groups */}
      <div className="px-4 space-y-6">
        {settingsGroups.map((group, idx) => (
          <div key={group.title || idx}>
            {group.title && (
              <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                {group.title}
              </h2>
            )}
            
            <div className="space-y-2">
              {group.items.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between rounded-2xl bg-card p-4 card-shadow cursor-pointer ${item.danger ? 'text-destructive' : ''}`}
                  onClick={() => {
                    if (item.label === 'Logout') {
                      toast('Logged out');
                    } else if (!item.toggle) {
                      toast(`${item.label} clicked`);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={item.danger ? 'text-destructive' : 'text-muted-foreground'}>{item.icon}</div>
                    <span className={`font-medium ${item.danger ? 'text-destructive' : 'text-foreground'}`}>{item.label}</span>
                  </div>
                  
                  {item.toggle ? (
                    <Switch onCheckedChange={() => toast(`${item.label} toggled`)} />
                  ) : !item.danger ? (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      {/* Version */}
      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">Version 1.0.0</p>
      </div>
      
      <BottomNav />
    </div>
  );
};

export default Settings;
