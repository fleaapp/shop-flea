import { Settings as SettingsIcon, RefreshCw, MessageCircleQuestion, ShieldCheck, FileText, Info, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';

const Settings = () => {
  const navigate = useNavigate();

  const settingsItems = [
    { icon: <User className="h-5 w-5" />, label: 'Edit profile', action: () => navigate('/profile') },
    { icon: <RefreshCw className="h-5 w-5" />, label: 'Refresh discarded listings', action: () => toast('Discarded listings refreshed') },
    { icon: <MessageCircleQuestion className="h-5 w-5" />, label: 'Support', action: () => toast('Opening support...') },
    { icon: <ShieldCheck className="h-5 w-5" />, label: 'Privacy policy', action: () => toast('Opening privacy policy...') },
    { icon: <FileText className="h-5 w-5" />, label: 'Terms & conditions', action: () => toast('Opening terms...') },
    { icon: <Info className="h-5 w-5" />, label: 'FAQ', action: () => toast('Opening FAQ...') },
  ];

  const handleLogout = () => {
    toast('Logged out successfully');
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="flex items-center justify-center gap-2 px-4 py-6">
        <SettingsIcon className="h-6 w-6 text-foreground" />
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
      </header>
      
      {/* Settings Items */}
      <div className="px-4 space-y-3">
        {settingsItems.map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="w-full flex items-center gap-4 rounded-2xl bg-card p-4 card-shadow text-left"
          >
            <div className="text-foreground">{item.icon}</div>
            <span className="font-medium text-foreground">{item.label}</span>
          </button>
        ))}
      </div>
      
      {/* Logout Button */}
      <div className="mt-8 px-4 flex justify-center">
        <Button
          onClick={handleLogout}
          className="rounded-full px-8 bg-muted-foreground hover:bg-muted-foreground/80 text-white"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
      
      <BottomNav />
    </div>
  );
};

export default Settings;
