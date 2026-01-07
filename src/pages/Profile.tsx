import { ArrowLeft, Camera, ChevronRight, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';

const Profile = () => {
  const navigate = useNavigate();

  const menuItems = [
    { label: 'My Listings', path: '/my-listings' },
    { label: 'Purchase History', path: '/purchases' },
    { label: 'Payment Methods', path: '/payments' },
    { label: 'Notifications', path: '/notifications' },
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
        <h1 className="text-xl font-bold text-foreground">Profile</h1>
      </header>
      
      {/* Profile Card */}
      <div className="mx-4 rounded-3xl bg-card p-6 card-shadow">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=User"
              alt="Profile"
              className="h-20 w-20 rounded-full bg-muted"
            />
            <button className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Camera className="h-4 w-4" />
            </button>
          </div>
          
          <div>
            <h2 className="text-xl font-bold text-foreground">Guest User</h2>
            <p className="text-sm text-muted-foreground">Sign in to access all features</p>
          </div>
        </div>
        
        <Button
          onClick={() => navigate('/auth')}
          className="mt-4 w-full rounded-xl bg-primary text-primary-foreground hover:bg-mint-dark"
        >
          Sign In
        </Button>
      </div>
      
      {/* Menu */}
      <div className="mx-4 mt-6 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => toast('Coming soon!')}
            className="flex w-full items-center justify-between rounded-2xl bg-card p-4 card-shadow transition-all hover:scale-[1.02]"
          >
            <span className="font-medium text-foreground">{item.label}</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        ))}
      </div>
      
      {/* Actions */}
      <div className="mx-4 mt-6 space-y-2">
        <Button
          variant="outline"
          onClick={() => navigate('/settings')}
          className="w-full justify-start rounded-2xl h-14 border-2"
        >
          <SettingsIcon className="mr-3 h-5 w-5" />
          Settings
        </Button>
        
        <Button
          variant="outline"
          onClick={() => toast('Sign out')}
          className="w-full justify-start rounded-2xl h-14 border-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sign Out
        </Button>
      </div>
      
      <BottomNav />
    </div>
  );
};

export default Profile;
