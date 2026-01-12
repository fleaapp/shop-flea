import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import fleaLogoAuth from '@/assets/flea-logo-auth.jpeg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const Auth = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [signupEmail, setSignupEmail] = useState('');
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error('Please fill in all fields');
      return;
    }
    setIsLoading(true);
    
    const { error } = await signIn(loginEmail, loginPassword);
    
    if (error) {
      toast.error(error.message || 'Failed to sign in');
      setIsLoading(false);
    } else {
      toast.success('Welcome back!');
      navigate('/');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail || !signupUsername || !signupPassword) {
      toast.error('Please fill in all required fields');
      return;
    }
    // Password validation: min 8 chars, 1 number, 1 symbol
    const hasNumber = /\d/.test(signupPassword);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(signupPassword);
    if (signupPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
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
    
    const { error } = await signUp(signupEmail, signupPassword, signupUsername);
    
    if (error) {
      toast.error(error.message || 'Failed to create account');
      setIsLoading(false);
    } else {
      toast.success('Account created!');
      navigate('/');
    }
  };

  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    
    if (error) {
      toast.error('Google sign-in failed');
    }
  };

  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-primary flex items-center justify-center overflow-hidden">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-foreground"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-primary flex flex-col overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        {/* Logo */}
        <img 
          src={fleaLogoAuth} 
          alt="FLEA" 
          className="h-12 mb-6 -mt-12 object-contain"
        />
        
        {/* Tab Toggle */}
        <div className="flex bg-[#423D3D] rounded-full p-1 mb-6">
          <button
            onClick={() => setActiveTab('login')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === 'login'
                ? 'bg-primary text-foreground'
                : 'text-card'
            }`}
          >
            Login
          </button>
          <button
            onClick={() => setActiveTab('signup')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === 'signup'
                ? 'bg-primary text-foreground'
                : 'text-card'
            }`}
          >
            Sign up
          </button>
        </div>
        
        {/* Forms */}
        <div className="w-full max-w-[260px]">
          {activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-2.5">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
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
                <button type="button" className="text-xs text-foreground hover:underline">
                  Forgot password?
                </button>
              </div>
              
              <div className="pt-1">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-9 w-auto px-8 mx-auto flex rounded-full bg-[#423D3D] text-card text-sm font-medium hover:bg-[#423D3D]/90"
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
              
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Username"
                  value={signupUsername}
                  onChange={(e) => setSignupUsername(e.target.value)}
                  className="h-10 pl-9 rounded-lg bg-card border border-foreground text-foreground placeholder:text-muted-foreground text-sm focus-visible:ring-muted-foreground/50 focus-visible:ring-offset-0"
                />
              </div>
              
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
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
              
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-9 w-auto px-8 mx-auto flex rounded-full bg-[#423D3D] text-card text-sm font-medium hover:bg-[#423D3D]/90"
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
                onClick={() => toast.info('Facebook login coming soon!')}
                className="w-10 h-10 rounded-lg bg-[#423D3D] flex items-center justify-center hover:bg-[#423D3D]/90 transition-colors"
              >
                <svg className="w-5 h-5 text-card" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </button>
              
              <button
                type="button"
                onClick={() => toast.info('Apple login coming soon!')}
                className="w-10 h-10 rounded-lg bg-[#423D3D] flex items-center justify-center hover:bg-[#423D3D]/90 transition-colors"
              >
                <svg className="w-5 h-5 text-card" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </button>
              
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
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="pb-8 text-center">
        <p className="text-sm text-foreground">
          <button className="hover:underline">Terms & Conditions</button>
          <span className="mx-2">|</span>
          <button className="hover:underline">Privacy Policy</button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
