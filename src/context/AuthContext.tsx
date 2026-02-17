import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { invokeCloudFunction } from '@/utils/cloudFunctions';

interface Profile {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  location: string | null;
  rating: number;
  total_reviews: number;
  preferred_sizes?: string[] | null;
  preferred_gender?: string | null;
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
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setProfile(data);

    // Check banned_users table
    const { data: ban } = await supabase
      .from('banned_users' as any)
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    setIsBanned(!!ban);

    return data;
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
          // Fetch profile - defer to avoid blocking
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
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
      localStorage.setItem(`flea_stripe_connected_${user.id}`, 'true');
      localStorage.removeItem('flea_stripe_pending');
      stripeVerifiedRef.current = true;
      return;
    }

    // Determine if this is a brand-new signup (auto-generated username like @user_xxx)
    const isNewSignup = profile.username?.startsWith('@user_');

    // For new signups WITHOUT a stored account ID, skip to prevent
    // email-based lookup from auto-inheriting unrelated Stripe accounts.
    // For established users (who completed profile setup), allow email-based
    // lookup as a fallback in case the DB update for stripe_account_id failed.
    if (!profile.stripe_account_id && isNewSignup) return;

    stripeVerifiedRef.current = true;

    const verify = async () => {
      try {
        const { data, error } = await invokeCloudFunction('stripe-connect-status', {
          stripeAccountId: profile.stripe_account_id || undefined,
        });
        if (error || !data) return;

        if ((data.chargesEnabled || data.detailsSubmitted) && data.accountId) {
          localStorage.setItem(`flea_stripe_connected_${user.id}`, 'true');
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
    // Clean up user-scoped localStorage flags
    if (user) {
      localStorage.removeItem(`flea_stripe_connected_${user.id}`);
    }
    // Also remove legacy unscoped key
    localStorage.removeItem('flea_stripe_connected');
    await supabase.auth.signOut();
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
