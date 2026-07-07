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
import { mergeGuestSessionToAccount } from '@/utils/mergeGuestSession';

const GUEST_KEY = 'flea_guest_mode';

type PromptVariant = 'default' | 'sell';

interface GuestModeContextType {
  isGuest: boolean;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  promptGuest: () => void;
  promptGuestSell: () => void;
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
  const [promptVariant, setPromptVariant] = useState<PromptVariant>('default');

  // Any real session cancels guest mode. Before clearing, transfer the
  // guest's wishlist + passed items over to the newly authenticated account.
  useEffect(() => {
    if (user) {
      // Fire-and-forget: merge runs whether or not the guest flag is set,
      // so anything stored in the guest session survives sign-in/sign-up.
      mergeGuestSessionToAccount(user.id);
      if (guestFlag) {
        try { sessionStorage.removeItem(GUEST_KEY); } catch {}
        setGuestFlag(false);
        setPromptOpen(false);
      }
    }
  }, [user, guestFlag]);

  const enterGuestMode = useCallback(() => {
    try { sessionStorage.setItem(GUEST_KEY, '1'); } catch {}
    setGuestFlag(true);
  }, []);

  const exitGuestMode = useCallback(() => {
    // Keep guest wishlist + discards in sessionStorage so they can be merged
    // into the user's account after successful sign-in/sign-up. Only the
    // guest-mode flag is cleared here.
    try { sessionStorage.removeItem(GUEST_KEY); } catch {}
    setGuestFlag(false);
  }, []);

  const promptGuest = useCallback(() => {
    setPromptVariant('default');
    setPromptOpen(true);
  }, []);

  const promptGuestSell = useCallback(() => {
    setPromptVariant('sell');
    setPromptOpen(true);
  }, []);

  const isGuest = !user && guestFlag;

  const requireAuth = useCallback((): boolean => {
    if (user) return true;
    setPromptVariant('default');
    setPromptOpen(true);
    return false;
  }, [user]);

  const goToAuth = (tab: 'login' | 'signup') => {
    setPromptOpen(false);
    try { sessionStorage.removeItem(GUEST_KEY); } catch {}
    navigate('/auth', { state: { initialTab: tab } });
  };

  const title = promptVariant === 'sell' ? 'Ready to sell?' : "You're browsing as a guest";
  const body =
    promptVariant === 'sell' ? (
      <>Log in or sign up to start selling on Flea.</>
    ) : (
      <>
        Login or sign up to
        <br />
        buy, sell &amp; save on Flea.
      </>
    );

  return (
    <GuestModeContext.Provider
      value={{ isGuest, enterGuestMode, exitGuestMode, promptGuest, promptGuestSell, requireAuth }}
    >
      {children}
      <AlertDialog open={promptOpen} onOpenChange={setPromptOpen}>
        <AlertDialogContent className="max-w-[320px] rounded-2xl p-5">
          <AlertDialogHeader className="space-y-2">
            <AlertDialogTitle className="text-base text-center">
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-center">
              {body}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <AlertDialogAction
              onClick={() => goToAuth('login')}
              className="w-full h-10 rounded-full text-sm bg-charcoal-light text-cream hover:bg-charcoal-light/90"
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
      promptGuestSell: () => {},
      requireAuth: () => true,
    };
  }
  return ctx;
};
