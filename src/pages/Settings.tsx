import { ArrowLeft, ChevronRight, Moon, Bell, Lock, HelpCircle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
        { icon: <Moon className="h-5 w-5" />, label: 'Dark Mode', toggle: true },
      ],
    },
    {
      title: 'Account',
      items: [
        { icon: <Lock className="h-5 w-5" />, label: 'Privacy & Security' },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: <HelpCircle className="h-5 w-5" />, label: 'Help Center' },
        { icon: <Info className="h-5 w-5" />, label: 'About Flea' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="h-10 w-10 rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
      </header>
      
      {/* Settings Groups */}
      <div className="px-4 space-y-6">
        {settingsGroups.map((group) => (
          <div key={group.title}>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {group.title}
            </h2>
            
            <div className="space-y-2">
              {group.items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl bg-card p-4 card-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-muted-foreground">{item.icon}</div>
                    <span className="font-medium text-foreground">{item.label}</span>
                  </div>
                  
                  {item.toggle ? (
                    <Switch onCheckedChange={() => toast(`${item.label} toggled`)} />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
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
