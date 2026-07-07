import { useNavigate } from 'react-router-dom';
import BottomNav from '@/components/BottomNav';
import { Button } from '@/components/ui/button';
import { useGuestMode } from '@/context/GuestModeContext';

const GuestGate = () => {
  const navigate = useNavigate();
  const { exitGuestMode } = useGuestMode();

  const go = (tab: 'login' | 'signup') => {
    exitGuestMode();
    navigate('/auth', { state: { initialTab: tab } });
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-background overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-3">
          You're browsing as a guest
        </h1>
        <p className="text-sm text-muted-foreground max-w-[280px] mb-8 leading-relaxed">
          Login or sign up to
          <br />
          buy, sell & save on Flea.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-[260px]">
          <Button
            onClick={() => go('login')}
            className="h-11 rounded-full bg-charcoal-light text-cream font-bold text-sm hover:bg-charcoal-light/90"
          >
            Log In
          </Button>
          <Button
            onClick={() => go('signup')}
            className="h-11 rounded-full bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90"
          >
            Sign Up
          </Button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default GuestGate;
