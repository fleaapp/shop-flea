import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import fleaLogoAuth from '@/assets/flea-logo-auth.jpeg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { supabase } from '@/lib/supabase';
import { detectUserLocation, checkRegionActive } from '@/services/geolocation';
import RegionBlockedScreen from '@/components/RegionBlockedScreen';

const Auth = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const { markUserAsOnboarded } = useOnboarding();
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Splash screen state
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Region detection state
  const [isDetectingLocation, setIsDetectingLocation] = useState(true);
  const [detectedCountry, setDetectedCountry] = useState<{ code: string; name: string } | null>(null);
  const [detectedRegion, setDetectedRegion] = useState<string | null>(null);
  const [isRegionBlocked, setIsRegionBlocked] = useState(false);
  
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  // Splash screen: end on video finish or fallback timeout
  useEffect(() => {
    const video = videoRef.current;
    
    const endSplash = () => {
      setSplashFading(true);
      setTimeout(() => setShowSplash(false), 600);
    };
    
    if (video) {
      video.play().catch(() => {
        // Video failed to play (autoplay blocked), skip splash
        endSplash();
      });
      video.addEventListener('ended', endSplash);
    }
    
    // Fallback: if video is too long or stalls, end after 6s
    const fallback = setTimeout(endSplash, 6000);
    
    return () => {
      clearTimeout(fallback);
      video?.removeEventListener('ended', endSplash);
    };
  }, []);
  
  // Detect user location on mount
  useEffect(() => {
    const detectLocation = async () => {
      try {
        const location = await detectUserLocation();
        setDetectedCountry({ code: location.country_code, name: location.country_name });
        setDetectedRegion(location.region_id);
        
        // Check if their region is active
        if (location.region_id) {
          const isActive = await checkRegionActive(location.region_id);
          setIsRegionBlocked(!isActive);
        } else {
          // Unknown region - block access
          setIsRegionBlocked(true);
        }
      } catch (error) {
        console.error('Location detection failed:', error);
        // On error, block access to be safe
        setIsRegionBlocked(true);
        setDetectedCountry({ code: 'UNKNOWN', name: 'Unknown' });
      } finally {
        setIsDetectingLocation(false);
      }
    };
    
    detectLocation();
  }, []);
  
  // Redirect if already logged in
  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

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
          .from('profiles')
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
      navigate('/');
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
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'/`~]/.test(signupPassword);
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
    
    // Pre-check: see if this email is already registered
    // Try signing in with a dummy password to detect existing accounts
    const { data: existingCheck, error: checkError } = await supabase.auth.signInWithPassword({
      email: signupEmail.trim(),
      password: '__dummy_check_' + Date.now(),
    });
    
    if (checkError) {
      const msg = checkError.message || '';
      // "Invalid login credentials" means account exists (wrong password)
      if (msg.includes('Invalid login credentials')) {
        // Check if account might be OAuth-based by looking for profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id')
          .limit(1);
        
        // We can't easily determine OAuth vs email, so show a helpful message
        toast.error(
          'This email is already registered. Try logging in or use "Continue with Google" if you signed up with Google.',
          { duration: 6000 }
        );
        setActiveTab('login');
        setLoginIdentifier(signupEmail);
        setSignupEmail('');
        setSignupPassword('');
        setSignupConfirmPassword('');
        setIsLoading(false);
        return;
      }
      // "Email not confirmed" also means account exists
      if (msg.includes('Email not confirmed')) {
        toast.error(
          'This email is already registered but not yet verified. Check your inbox for the verification email.',
          { duration: 6000 }
        );
        setActiveTab('login');
        setLoginIdentifier(signupEmail);
        setSignupEmail('');
        setSignupPassword('');
        setSignupConfirmPassword('');
        setIsLoading(false);
        return;
      }
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
      navigate('/verify-email', { state: { email: signupEmail } });
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      // Mark that user is signing in via Google BEFORE redirect — this flag survives the OAuth redirect
      localStorage.setItem('flea_oauth_signup', '1');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      
      if (error) {
        localStorage.removeItem('flea_oauth_signup');
        console.error('Google sign-in error:', error);
        toast.error('Google sign-in failed. Please try again.');
      }
    } catch (err) {
      localStorage.removeItem('flea_oauth_signup');
      console.error('Google sign-in exception:', err);
      toast.error('Google sign-in failed. Please try again.');
    }
  };

  const handleAppleSignIn = async () => {
    try {
      // Mark that user is signing in via OAuth BEFORE redirect
      localStorage.setItem('flea_oauth_signup', '1');
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: window.location.origin,
        },
      });
      
      if (error) {
        localStorage.removeItem('flea_oauth_signup');
        console.error('Apple sign-in error:', error);
        toast.error('Apple sign-in failed. Please try again.');
      }
    } catch (err) {
      localStorage.removeItem('flea_oauth_signup');
      console.error('Apple sign-in exception:', err);
      toast.error('Apple sign-in failed. Please try again.');
    }
  };

  const handleFacebookSignIn = () => {
    toast.info('Facebook login is not yet available');
  };

  // Show loading while detecting location
  if (authLoading || isDetectingLocation) {
    return (
      <div className="fixed inset-0 bg-primary flex items-center justify-center overflow-hidden">
        <span className="text-5xl">⏳</span>
      </div>
    );
  }

  // Show region blocked screen if user is outside active regions
  if (isRegionBlocked && detectedCountry) {
    return (
      <RegionBlockedScreen 
        countryCode={detectedCountry.code} 
        countryName={detectedCountry.name} 
      />
    );
  }

  return (
    <>
      {/* Splash Screen Video Overlay */}
      {showSplash && (
        <div 
          className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-[600ms] ${
            splashFading ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <video
            ref={videoRef}
            src="/splash-screen.mov"
            autoPlay
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      )}
    <div className="auth-screen fixed inset-0 bg-primary flex flex-col overflow-hidden">
      {/* Logo - positioned at top */}
      <div className="auth-logo absolute top-20 max-[375px]:top-12 left-0 right-0 flex justify-center">
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
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-[375px]:px-4 pt-16 pb-10 max-[375px]:pt-12 max-[375px]:pb-8">
        
        {/* Tab Toggle */}
        <div className="flex bg-[#423D3D] rounded-full p-1 mb-6 max-[375px]:mb-4 h-9">
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
              
              <div className="pt-1">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 w-auto px-8 mx-auto flex rounded-full bg-[#423D3D] text-card text-sm font-medium hover:bg-[#423D3D]/90"
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
              <p className="text-[10px] text-foreground/70 text-center pt-2">
                By signing up, you agree to our{' '}
                <button type="button" className="underline hover:text-foreground">Terms</button>
                {' & '}
                <button type="button" className="underline hover:text-foreground">Privacy</button>.
              </p>
              
              <div className="pt-1">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 w-auto px-8 mx-auto flex rounded-full bg-[#423D3D] text-card text-sm font-medium hover:bg-[#423D3D]/90"
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
            
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-10 h-10 rounded-lg bg-[#423D3D] flex items-center justify-center hover:bg-[#423D3D]/90 transition-colors"
              >
                <svg className="w-5 h-5 text-card" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </button>

              {/* TODO: Re-enable when ready
              <button type="button" onClick={handleFacebookSignIn} className="w-10 h-10 rounded-lg bg-[#423D3D] flex items-center justify-center hover:bg-[#423D3D]/90 transition-colors">
                <svg className="w-5 h-5 text-card" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              </button>
              <button type="button" onClick={handleAppleSignIn} className="w-10 h-10 rounded-lg bg-[#423D3D] flex items-center justify-center hover:bg-[#423D3D]/90 transition-colors">
                <svg className="w-5 h-5 text-card" fill="currentColor" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              </button>
              */}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default Auth;
