import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { invokeCloudFunction } from '@/utils/cloudFunctions';
import { clearStripeConnectionState, getStripeConnectedStorageKey } from '@/utils/stripeConnectionState';

interface Profile {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  location: string | null;
  rating: number;
  total_reviews: number;
  preferred_sizes?: string[] | null;
  preferred_gender?: string[] | null;
  pause_selling?: boolean;
  tiered_shipping_enabled?: boolean;
  shipping_tier_1?: number;
  shipping_tier_2?: number;
  shipping_tier_3?: number;
  shipping_preferences_set?: boolean;
  region_id?: string | null;
  country_code?: string | null;
  password_set?: boolean;
  stripe_account_id?: string | null;
  stripe_onboarding_complete?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isBanned: boolean;
  signUp: (email: string, password: string, username: string, countryCode?: string, regionId?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch profile:', error);
        setProfile(null);
        setIsBanned(false);
        return null;
      }

      setProfile(data);

      if (data?.stripe_onboarding_complete) {
        localStorage.setItem(getStripeConnectedStorageKey(userId), 'true');
        localStorage.removeItem('flea_stripe_pending');
      } else if (!data?.stripe_account_id && !data?.stripe_onboarding_complete) {
        clearStripeConnectionState(userId);
      }

      // Check if user is banned via profile status or banned_users table
      const profileStatus = (data as any)?.status;
      let banned = profileStatus === 'blocked';

      if (!banned) {
        try {
          const { data: ban } = await supabase
            .from('banned_users' as any)
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle();
          banned = !!ban;
        } catch {
          // banned_users table may not exist - that's fine
        }
      }
      setIsBanned(banned);

      return data;
    } catch (e) {
      console.error('Unexpected error fetching profile:', e);
      setProfile(null);
      setIsBanned(false);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Mark loading until profile fetch completes so consumers don't
          // briefly see (user && !profile) and flash onboarding UI.
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
            setLoading(true);
          }
          // Defer to avoid blocking the auth callback
          setTimeout(() => {
            fetchProfile(session.user.id).finally(() => setLoading(false));
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Then get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id).then(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Reset stripe verification when user changes (e.g. logout → login)
  const stripeVerifiedRef = useRef(false);
  const lastVerifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!profile || !user) return;

    // Reset ref when user changes so re-login triggers verification
    if (lastVerifiedUserId.current !== user.id) {
      stripeVerifiedRef.current = false;
      lastVerifiedUserId.current = user.id;
    }

    if (stripeVerifiedRef.current) return;

    // Skip if already fully connected in DB
    if (profile.stripe_onboarding_complete) {
      localStorage.setItem(getStripeConnectedStorageKey(user.id), 'true');
      localStorage.removeItem('flea_stripe_pending');
      stripeVerifiedRef.current = true;
      return;
    }

    // ONLY auto-verify if the profile already has a stripe_account_id stored.
    // Never do email-based lookups here — that would auto-connect unrelated
    // Stripe accounts to new users who share the same email.
    // Email-based lookup is only done explicitly in PaymentMethodsSection
    // when the user actively checks their Stripe status.
    if (!profile.stripe_account_id) return;

    stripeVerifiedRef.current = true;

    const verify = async () => {
      try {
        const { data, error } = await invokeCloudFunction('stripe-connect-status', {
          stripeAccountId: profile.stripe_account_id || undefined,
        });
        if (error || !data) return;

        if (data.chargesEnabled && data.payoutsEnabled && data.accountId) {
          localStorage.setItem(getStripeConnectedStorageKey(user.id), 'true');
          localStorage.removeItem('flea_stripe_pending');
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
              stripe_onboarding_complete: true,
              stripe_account_id: data.accountId,
            } as any)
            .eq('user_id', user.id);
          if (updateError) {
            console.error('Failed to persist Stripe status to DB:', updateError);
          }
          setTimeout(() => fetchProfile(user.id), 500);
        } else {
          // Not fully connected (payouts paused, under review, etc.)
          clearStripeConnectionState(user.id);
          clearStripeConnectionState(user.id);
        }
      } catch (e) {
        console.error('Auto Stripe verify on login failed:', e);
      }
    };
    verify();
  }, [profile, user, fetchProfile]);

  const signUp = async (
    email: string, 
    password: string, 
    username: string,
    countryCode?: string,
    regionId?: string
  ) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          username: `@${username.replace(/^@/, '')}`,
          country_code: countryCode,
          region_id: regionId,
        },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    localStorage.removeItem('flea_stripe_connected');
    localStorage.removeItem('flea_oauth_signup');
    // Clear local session immediately so UI reflects logout even if the
    // network call to revoke the server-side session hangs (common on iOS PWA).
    setSession(null);
    setUser(null);
    setProfile(null);
    setIsBanned(false);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.error('signOut failed, clearing local storage anyway', e);
    }
    // Defensive: nuke any leftover supabase auth tokens from localStorage
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, isBanned, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
