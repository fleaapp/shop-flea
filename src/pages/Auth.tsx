import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import fleaLogoAuth from '@/assets/flea-logo-auth.jpeg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { lovable } from '@/integrations/lovable';
import { nativeAppleSignIn, isIosNative as isAppleIosNative } from '@/lib/appleSignIn';
import { nativeGoogleSignIn, isNativeRuntime } from '@/lib/googleSignIn';
import { signInWithOAuthPopup } from '@/lib/oauthPopup';
import { logError } from '@/lib/errorLogger';
import ProviderConflictDialog, { type ConflictProvider } from '@/components/ProviderConflictDialog';
import { useAdminRole } from '@/hooks/useAdminRole';

const CHECK_EMAIL_PROVIDER_URL =
  `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/check-email-provider`;


async function checkEmailProvider(email: string): Promise<ConflictProvider | null> {
  try {
    const resp = await fetch(CHECK_EMAIL_PROVIDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ email }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data?.provider ?? null) as ConflictProvider | null;
  } catch {
    return null;
  }
}


const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const routeState = (location.state as { initialTab?: 'login' | 'signup' } | null) ?? null;
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(routeState?.initialTab ?? 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Auth must never wait on geolocation/IP services. Flea is AU-only at launch,
  // so native and auth startup both use the AU fallback immediately.
  const detectedCountry = { code: 'AU', name: 'Australia' };
  const detectedRegion = 'AU';
  
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [conflictProvider, setConflictProvider] = useState<ConflictProvider | null>(null);
  const [connectingProvider, setConnectingProvider] = useState<'Google' | null>(null);

  // Listen for OAuth conflicts surfaced by AuthContext after redirect.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.provider === 'google' || detail?.provider === 'apple' || detail?.provider === 'email') {
        setConflictProvider(detail.provider);
        toast.error('That email is already registered with a different sign-in method.');
      }
    };
    window.addEventListener('flea-auth-conflict', handler);
    return () => window.removeEventListener('flea-auth-conflict', handler);
  }, []);

  // Tell the user why they were signed out when their session expired.
  useEffect(() => {
    try {
      if (sessionStorage.getItem('flea_session_expired')) {
        sessionStorage.removeItem('flea_session_expired');
        toast('Your session expired. Please sign in again.');
      }
    } catch { /* ignore */ }
  }, []);

  const redirectParam = new URLSearchParams(location.search).get('redirect');
  const redirectTo = redirectParam?.startsWith('/') && !redirectParam.startsWith('//') ? redirectParam : '/';
  const { isAdmin, loading: adminLoading } = useAdminRole();

  // Redirect if already logged in. Admins land on the admin dashboard by default,
  // unless a specific ?redirect= was requested.
  useEffect(() => {
    if (user && !authLoading && !adminLoading) {
      const target = !redirectParam && isAdmin ? '/admin' : redirectTo;
      navigate(target, { replace: true });
    }
  }, [user, authLoading, adminLoading, isAdmin, navigate, redirectTo, redirectParam]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier || !loginPassword) {
      toast.error('Please fill in all fields');
      return;
    }
    setIsLoading(true);
    
    let email = loginIdentifier.trim();
    
    // If it doesn't look like an email, treat as username and look up email
    if (!email.includes('@') || !email.includes('.')) {
      // Normalize: ensure @ prefix, and also try without
      const withAt = email.startsWith('@') ? email.toLowerCase() : `@${email.toLowerCase()}`;
      const withoutAt = email.startsWith('@') ? email.slice(1).toLowerCase() : email.toLowerCase();
      
      // Try RPC first (SECURITY DEFINER bypasses RLS)
      let resolvedEmail: string | null = null;
      
      const { data: rpcData1, error: rpcErr1 } = await supabase.rpc('get_email_by_username', { p_username: withAt });
      console.log('[Login] RPC with @:', { data: rpcData1, error: rpcErr1 });
      
      if (rpcData1) {
        resolvedEmail = rpcData1;
      } else {
        const { data: rpcData2, error: rpcErr2 } = await supabase.rpc('get_email_by_username', { p_username: withoutAt });
        console.log('[Login] RPC without @:', { data: rpcData2, error: rpcErr2 });
        if (rpcData2) {
          resolvedEmail = rpcData2;
        }
      }
      
      // If RPC failed (e.g. permissions), try direct profile lookup + RPC combo
      if (!resolvedEmail) {
        // Direct query to check if profile exists at all
        const { data: profileCheck, error: profileErr } = await supabase
          .from('profiles_public')
          .select('username')
          .or(`username.eq.${withAt},username.eq.${withoutAt}`)
          .limit(1);
        console.log('[Login] Direct profile check:', { data: profileCheck, error: profileErr });
        
        if (!profileCheck || profileCheck.length === 0) {
          toast.error('No account found with that username');
          setIsLoading(false);
          return;
        }
        
        // Profile exists but RPC failed - try RPC with the exact stored username
        const storedUsername = profileCheck[0].username;
        const { data: rpcData3 } = await supabase.rpc('get_email_by_username', { p_username: storedUsername });
        console.log('[Login] RPC with exact stored username:', { stored: storedUsername, data: rpcData3 });
        
        if (!rpcData3) {
          toast.error('Unable to look up account. Please try logging in with your email.');
          setIsLoading(false);
          return;
        }
        resolvedEmail = rpcData3;
      }
      
      email = resolvedEmail;
    }
    
    const { error } = await signIn(email, loginPassword);
    
    if (error) {
      if (error.message?.includes('Invalid login credentials')) {
        toast.error('Incorrect email/username or password');
      } else if (error.message?.includes('Email not confirmed')) {
        toast.error('Please verify your email before logging in');
      } else {
        toast.error(error.message || 'Failed to sign in');
      }
      setIsLoading(false);
    } else {
      // Let the useEffect above handle navigation once auth state syncs,
      // to avoid ProtectedRoute redirecting to /about before user is set.
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail || !signupPassword) {
      toast.error('Please fill in all required fields');
      return;
    }
    // Password validation: min 8 chars, 1 capital letter, 1 number, 1 symbol
    const hasCapital = /[A-Z]/.test(signupPassword);
    const hasNumber = /\d/.test(signupPassword);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>_+=\-[\]\\;'/`~]/.test(signupPassword);
    if (signupPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!hasCapital) {
      toast.error('Password must include at least 1 capital letter');
      return;
    }
    if (!hasNumber) {
      toast.error('Password must include at least 1 number');
      return;
    }
    if (!hasSymbol) {
      toast.error('Password must include at least 1 symbol');
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setIsLoading(true);

    // Device eligibility check: block re-registration on devices with unsettled balances.
    try {
      const { getDeviceId } = await import('@/lib/deviceId');
      const deviceId = await getDeviceId();
      if (deviceId) {
        const resp = await fetch(
          `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/check-device-eligibility`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
            body: JSON.stringify({ deviceId }),
          },
        );
        if (resp.ok) {
          const eligibility = await resp.json();
          if (eligibility?.blocked) {
            toast.error(
              eligibility?.reason ||
                'This device has an unsettled balance from a previous account. Settle the balance before creating a new account.',
              { duration: 6000 },
            );
            setIsLoading(false);
            return;
          }
        }
      }
    } catch {
      // Non-fatal: if the check errors, continue with signup. The server-side gate is the source of truth.
    }

    // Pre-check: is this email already registered with any provider?
    const existingProvider = await checkEmailProvider(signupEmail.trim());

    if (existingProvider === 'google' || existingProvider === 'apple') {
      // Conflict: account exists with a social provider.
      setIsLoading(false);
      setConflictProvider(existingProvider);
      return;
    }

    if (existingProvider === 'email') {
      toast.error(
        'This email is already registered. Try logging in instead.',
        { duration: 5000 },
      );
      setActiveTab('login');
      setLoginIdentifier(signupEmail);
      setSignupEmail('');
      setSignupPassword('');
      setSignupConfirmPassword('');
      setIsLoading(false);
      return;
    }


    
    // Use a placeholder username - user will set it in the welcome popup
    const placeholderUsername = `user_${Date.now()}`;
    
    const { error } = await signUp(
      signupEmail, 
      signupPassword, 
      placeholderUsername,
      detectedCountry?.code,
      detectedRegion || undefined
    );
    
    if (error) {
      const msg = error.message || '';
      if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('User already registered')) {
        toast.error('This email is already registered. Try logging in instead.', { duration: 5000 });
        setActiveTab('login');
        setLoginIdentifier(signupEmail);
        setSignupEmail('');
        setSignupPassword('');
        setSignupConfirmPassword('');
      } else {
        toast.error(msg || 'Failed to create account');
      }
      setIsLoading(false);
    } else {
      try { localStorage.setItem('flea_pending_verify_email', signupEmail); } catch (_) { /* private mode */ }
      // A brand new account always gets the walkthrough + welcome alert.
      try {
        localStorage.removeItem('flea-onboarding-completed');
        localStorage.setItem('flea-new-user-pending-onboarding', 'true');
      } catch (_) { /* private mode */ }
      navigate('/verify-email', { state: { email: signupEmail } });
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      localStorage.setItem('flea_oauth_signup', '1');
      localStorage.removeItem('flea-onboarding-completed');
      localStorage.setItem('flea-new-user-pending-onboarding', 'true');

      // Native (iOS/Android): deliberately fall through to the in-app browser
      // OAuth path. The native Google plugin was removed because it generated a
      // placeholder URL scheme that caused an App Store archive rejection.
      if (isNativeRuntime()) {
        const result = await nativeGoogleSignIn();
        if (result.handled) {
          if (result.error) {
            localStorage.removeItem('flea_oauth_signup');
            localStorage.removeItem('flea-new-user-pending-onboarding');
            if (!result.cancelled) {
              console.error('Native Google sign-in error:', result.error);
              logError({ title: 'Google sign-in failed (native)', message: result.error.message, stack: result.error.stack ?? null, severity: 'error', source: 'auth' });
              toast.error(
                `Google sign-in failed: ${result.error.message || 'Please try again.'}`,
              );
            }
          }
          // On success onAuthStateChange redirects via the useEffect above.
          return;
        }
      }

      // Inside the Lovable editor preview iframe the managed helper already
      // handles the popup + web_message handshake, so keep using it there.
      let isInIframe = false;
      try {
        isInIframe = window.self !== window.top;
      } catch {
        isInIframe = true;
      }

      if (isInIframe) {
        const result = await lovable.auth.signInWithOAuth('google', {
          redirect_uri: window.location.origin,
          extraParams: { prompt: 'select_account' },
        });
        if (result.error) {
          localStorage.removeItem('flea_oauth_signup');
          localStorage.removeItem('flea-new-user-pending-onboarding');
          console.error('Google sign-in error:', result.error);
          logError({ title: 'Google sign-in failed (managed OAuth)', message: result.error.message || String(result.error), severity: 'error', source: 'auth' });
          toast.error(`Google sign-in failed: ${result.error.message || 'Please try again.'}`);
        }
        return;
      }

      // Web: account-picker popup. Native: in-app browser sheet.
      // Both go straight to the app's own auth endpoint using the project's
      // Google Cloud credentials, so only Flea branding is shown.
      setConnectingProvider('Google');
      const result = await signInWithOAuthPopup('google', { prompt: 'select_account' });

      if (result.error) {
        localStorage.removeItem('flea_oauth_signup');
        localStorage.removeItem('flea-new-user-pending-onboarding');
        if (!result.cancelled) {
          console.error('Google sign-in error:', result.error);
          logError({ title: 'Google sign-in failed (managed OAuth)', message: result.error.message || String(result.error), severity: 'error', source: 'auth' });
          toast.error(`Google sign-in failed: ${result.error.message || 'Please try again.'}`);
        }
        return;
      }

      // Session is set (popup) or will be set by the callback route (native).
      // onAuthStateChange redirects via the useEffect above.
    } catch (err: any) {
      localStorage.removeItem('flea_oauth_signup');
      localStorage.removeItem('flea-new-user-pending-onboarding');
      console.error('Google sign-in exception:', err);
      logError({ title: 'Google sign-in exception', message: err?.message || String(err), stack: err?.stack ?? null, severity: 'error', source: 'auth' });
      toast.error(`Google sign-in failed: ${err?.message || 'Please try again.'}`);
    } finally {
      setConnectingProvider(null);
    }
  };


  const handleAppleSignIn = async () => {
    try {
      localStorage.setItem('flea_oauth_signup', '1');
      localStorage.removeItem('flea-onboarding-completed');
      localStorage.setItem('flea-new-user-pending-onboarding', 'true');

      // iOS native: use the system Sign in with Apple sheet (no Safari bounce).
      if (isAppleIosNative()) {
        const result = await nativeAppleSignIn();
        if (result.handled) {
          if (result.error) {
            localStorage.removeItem('flea_oauth_signup');
            localStorage.removeItem('flea-new-user-pending-onboarding');
            if (!result.cancelled) {
              console.error('Native Apple sign-in error:', result.error);
              // Surface the real reason so we can debug TestFlight failures
              // (e.g. "Unacceptable audience in id_token" when the Supabase
              // Apple provider isn't configured with the iOS bundle ID).
              toast.error(
                `Apple sign-in failed: ${result.error.message || 'Please try again.'}`,
              );
            }
          }
          // On success the auth state change triggers redirect via useEffect.
          return;
        }
      }

      // Non-native (web/PWA/Android): Apple Sign-In is iOS-app-only.
      localStorage.removeItem('flea_oauth_signup');
      localStorage.removeItem('flea-new-user-pending-onboarding');
      toast.info('Sign in with Apple is only available in the Flea iOS app.');
      return;

    } catch (err) {
      localStorage.removeItem('flea_oauth_signup');
      localStorage.removeItem('flea-new-user-pending-onboarding');
      console.error('Apple sign-in exception:', err);
      toast.error('Apple sign-in failed. Please try again.');
    }
  };

  const handleFacebookSignIn = () => {
    toast.info('Facebook login is not yet available');
  };

  // NOTE: do NOT gate the splash on authLoading. On iOS WKWebView,
  // supabase.auth.getSession() can hang and leave the user stuck on lime.
  // Render the login form immediately; the redirect effect above will
  // navigate away once a session resolves.

  return (
    <div className="auth-screen native-safe-top fixed inset-0 bg-primary flex flex-col items-center overflow-hidden px-6 max-[375px]:px-4 pb-8">
      <div className="auth-stack flex w-full flex-1 flex-col items-center justify-center pt-6 max-[375px]:pt-4">
        {/* Logo — stays in the same stack as the form so it moves with it */}
        <div className="auth-logo flex justify-center mb-10 max-[375px]:mb-7">
          <img
            src={fleaLogoAuth}
            alt="FLEA"
            width={232}
            height={84}
            loading="eager"
            className="h-12 max-[375px]:h-10 object-contain"
          />
        </div>

        {/* Main Content */}
        <div className="flex flex-col items-center w-full">
        

        
        {/* Tab Toggle */}
        <div className="flex bg-ink rounded-full p-1 mb-6 max-[375px]:mb-4 h-9">
          <button
            onClick={() => setActiveTab('login')}
            className={`px-4 max-[375px]:px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === 'login'
                ? 'bg-primary text-foreground'
                : 'text-card'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setActiveTab('signup')}
            className={`px-4 max-[375px]:px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === 'signup'
                ? 'bg-primary text-foreground'
                : 'text-card'
            }`}
          >
            Sign up
          </button>
        </div>
        
        {/* Forms */}
        <div className="w-full max-w-[min(260px,85vw)]">
          {activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-2.5">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Email or username"
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  className="h-10 pl-9 rounded-lg bg-card border border-foreground text-foreground placeholder:text-muted-foreground text-sm focus-visible:ring-muted-foreground/50 focus-visible:ring-offset-0"
                />
              </div>
              
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="h-10 pl-9 pr-9 rounded-lg bg-card border border-foreground text-foreground placeholder:text-muted-foreground text-sm focus-visible:ring-muted-foreground/50 focus-visible:ring-offset-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              <div className="text-center pt-1">
                <button 
                  type="button" 
                  onClick={() => navigate('/forgot-password')}
                  className="text-xs text-foreground hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              
              <p className="text-[10px] text-foreground/70 text-center pt-2 leading-snug">
                By continuing you agree to our{' '}
                <button type="button" onClick={() => navigate('/terms')} className="underline hover:text-foreground">Terms</button>
                {' & '}
                <button type="button" onClick={() => navigate('/privacy')} className="underline hover:text-foreground">Privacy</button>.
              </p>

              <div className="pt-1">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 w-auto px-8 mx-auto flex rounded-full bg-ink text-card text-sm font-medium hover:bg-ink/90"
                >
                  {isLoading ? 'Signing in...' : 'Login'}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-2.5">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  className="h-10 pl-9 rounded-lg bg-card border border-foreground text-foreground placeholder:text-muted-foreground text-sm focus-visible:ring-muted-foreground/50 focus-visible:ring-offset-0"
                />
              </div>
              
              
              <Popover open={passwordFocused}>
                <PopoverTrigger asChild>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      className="h-10 pl-9 pr-9 rounded-lg bg-card border border-foreground text-foreground placeholder:text-muted-foreground text-sm focus-visible:ring-muted-foreground/50 focus-visible:ring-offset-0"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </PopoverTrigger>
                <PopoverContent 
                  side="top" 
                  align="center" 
                  className="w-auto px-3 py-2 text-xs bg-foreground text-card border-none shadow-lg"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <p className="font-medium">Password must include:</p>
                  <ul className="mt-1 space-y-0.5 text-card/80">
                    <li>• 8+ characters</li>
                    <li>• 1 capital letter</li>
                    <li>• 1 number</li>
                    <li>• 1 symbol</li>
                  </ul>
                </PopoverContent>
              </Popover>
              
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  className="h-10 pl-9 pr-9 rounded-lg bg-card border border-foreground text-foreground placeholder:text-muted-foreground text-sm focus-visible:ring-muted-foreground/50 focus-visible:ring-offset-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              {/* Terms & Privacy notice */}
              <p className="text-[10px] text-foreground/70 text-center pt-2 leading-snug">
                By signing up you agree to our{' '}
                <button type="button" onClick={() => navigate('/terms')} className="underline hover:text-foreground">Terms</button>
                {' & '}
                <button type="button" onClick={() => navigate('/privacy')} className="underline hover:text-foreground">Privacy</button>.
              </p>
              
              <div className="pt-1">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 w-auto px-8 mx-auto flex rounded-full bg-ink text-card text-sm font-medium hover:bg-ink/90"
                >
                  {isLoading ? 'Creating account...' : 'Sign up'}
                </Button>
              </div>
            </form>
          )}
          
          {/* Social Login */}
          <div className="mt-7">
            <p className="text-center text-xs text-foreground mb-3">
              Or {activeTab === 'login' ? 'login' : 'sign up'} with
            </p>

            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-10 h-10 rounded-lg bg-ink flex items-center justify-center hover:bg-ink/90 transition-colors"
                aria-label="Continue with Google"
              >
                <svg className="w-5 h-5 text-card" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"/>
                  <path d="M12 24c3.24 0 5.96-1.08 7.94-2.92l-3.88-3a7.2 7.2 0 0 1-10.72-3.78H1.34v3.09A12 12 0 0 0 12 24z"/>
                  <path d="M5.34 14.3a7.2 7.2 0 0 1 0-4.6V6.61H1.34a12 12 0 0 0 0 10.78l4-3.09z"/>
                  <path d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.2 15.24 0 12 0A12 12 0 0 0 1.34 6.61l4 3.09A7.2 7.2 0 0 1 12 4.77z"/>
                </svg>
              </button>


              <button
                type="button"
                onClick={handleAppleSignIn}
                className="w-10 h-10 rounded-lg bg-ink flex items-center justify-center hover:bg-ink/90 transition-colors"
                aria-label="Sign in with Apple"
              >
                <svg className="w-5 h-5 text-card" fill="currentColor" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              </button>

              {/* TODO: Re-enable Facebook when ready
              <button type="button" onClick={handleFacebookSignIn} className="w-10 h-10 rounded-lg bg-ink flex items-center justify-center hover:bg-ink/90 transition-colors">
                <svg className="w-5 h-5 text-card" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </button>
              */}


            </div>
          </div>

          {/* Guest browse — Apple compliance: allow browsing without account */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => {
                try { sessionStorage.setItem('flea_guest_mode', '1'); } catch {}
                // Always show the app walkthrough when entering guest mode,
                // matching the logged-in onboarding experience.
                try {
                  localStorage.removeItem('flea-onboarding-completed');
                  localStorage.setItem('flea-new-user-pending-onboarding', 'true');
                } catch {}
                navigate('/');
              }}
              className="text-sm text-foreground/70 underline hover:text-foreground"
            >
              Browse as Guest
            </button>
          </div>
        </div>
      </div>
      </div>

      <ProviderConflictDialog
        open={!!conflictProvider}
        provider={conflictProvider}
        onCancel={() => setConflictProvider(null)}
        onContinue={() => {
          const p = conflictProvider;
          setConflictProvider(null);
          if (p === 'google') {
            handleGoogleSignIn();
          } else if (p === 'apple') {
            handleAppleSignIn();
          } else if (p === 'email') {
            setActiveTab('login');
            setLoginIdentifier(signupEmail || loginIdentifier);
            setSignupEmail('');
            setSignupPassword('');
            setSignupConfirmPassword('');
          }
        }}
      />

      {connectingProvider && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-primary">
          <span className="text-3xl font-extrabold tracking-tight text-primary-foreground">FLEA</span>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
          <p className="text-sm text-primary-foreground/80">Connecting to {connectingProvider}...</p>
        </div>
      )}
    </div>
  );
};


export default Auth;
