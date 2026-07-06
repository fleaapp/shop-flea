import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const GUEST_KEY = 'flea_guest_mode';

interface GuestModeContextType {
  isGuest: boolean;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  promptGuest: () => void;
  /** Returns true if signed in. Returns false + opens prompt if guest/anonymous. */
  requireAuth: () => boolean;
}

const GuestModeContext = createContext<GuestModeContextType | undefined>(undefined);

const readFlag = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(GUEST_KEY) === '1';
  } catch {
    return false;
  }
};

export const GuestModeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [guestFlag, setGuestFlag] = useState<boolean>(readFlag);
  const [promptOpen, setPromptOpen] = useState(false);

  // Any real session cancels guest mode.
  useEffect(() => {
    if (user && guestFlag) {
      try { sessionStorage.removeItem(GUEST_KEY); } catch {}
      setGuestFlag(false);
      setPromptOpen(false);
    }
  }, [user, guestFlag]);

  const enterGuestMode = useCallback(() => {
    try { sessionStorage.setItem(GUEST_KEY, '1'); } catch {}
    setGuestFlag(true);
  }, []);

  const exitGuestMode = useCallback(() => {
    try { sessionStorage.removeItem(GUEST_KEY); } catch {}
    setGuestFlag(false);
  }, []);

  const promptGuest = useCallback(() => {
    setPromptOpen(true);
  }, []);

  const isGuest = !user && guestFlag;

  const requireAuth = useCallback((): boolean => {
    if (user) return true;
    setPromptOpen(true);
    return false;
  }, [user]);

  const goToAuth = (tab: 'login' | 'signup') => {
    setPromptOpen(false);
    try { sessionStorage.removeItem(GUEST_KEY); } catch {}
    navigate('/auth', { state: { initialTab: tab } });
  };

  return (
    <GuestModeContext.Provider
      value={{ isGuest, enterGuestMode, exitGuestMode, promptGuest, requireAuth }}
    >
      {children}
      <AlertDialog open={promptOpen} onOpenChange={setPromptOpen}>
        <AlertDialogContent className="max-w-[320px] rounded-2xl p-5">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-base text-center">
              You're browsing as a guest
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-center">
              Log in or sign up to buy, sell and save on Flea.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={() => goToAuth('login')}
              className="w-full h-10 rounded-full text-sm bg-[#2b303b] text-white hover:bg-[#2b303b]/90"
            >
              Log In
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => goToAuth('signup')}
              className="w-full h-10 rounded-full text-sm bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Sign Up
            </AlertDialogAction>
            <AlertDialogCancel className="w-full mt-0 h-10 rounded-full text-sm">
              Continue Browsing
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </GuestModeContext.Provider>
  );
};

export const useGuestMode = (): GuestModeContextType => {
  const ctx = useContext(GuestModeContext);
  if (!ctx) {
    // Safe fallback when consumers render outside the provider (e.g. /auth).
    return {
      isGuest: false,
      enterGuestMode: () => {
        try { sessionStorage.setItem(GUEST_KEY, '1'); } catch {}
      },
      exitGuestMode: () => {
        try { sessionStorage.removeItem(GUEST_KEY); } catch {}
      },
      promptGuest: () => {},
      requireAuth: () => true,
    };
  }
  return ctx;
};
