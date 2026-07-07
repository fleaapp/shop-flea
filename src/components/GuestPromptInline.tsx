import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useGuestMode } from '@/context/GuestModeContext';

interface Props {
  className?: string;
}

const GuestPromptInline = ({ className = '' }: Props) => {
  const navigate = useNavigate();
  const { exitGuestMode } = useGuestMode();

  const go = (tab: 'login' | 'signup') => {
    exitGuestMode();
    navigate('/auth', { state: { initialTab: tab } });
  };

  return (
    <div className={`flex flex-col items-center px-6 text-center ${className}`}>
      <p className="text-sm text-muted-foreground max-w-[280px] mb-6 leading-relaxed">
        Login or sign up to
        <br />
        buy, sell &amp; save on Flea.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-[220px]">
        <Button
          onClick={() => go('login')}
          className="h-11 rounded-full bg-muted-foreground/20 text-muted-foreground font-bold text-sm hover:bg-muted-foreground/30"
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
  );
};

export default GuestPromptInline;
