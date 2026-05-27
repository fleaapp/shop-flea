import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react';
import fleaLogoAuth from '@/assets/flea-logo-auth.jpeg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let settled = false;
    // Safety: never let getSession() hang on iOS WKWebView. Bounce to /auth
    // after 2s so the user can never get stuck on a green hourglass.
    const safety = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn('[reset-password] getSession() timed out — redirecting to /auth');
      navigate('/auth', { replace: true });
    }, 2000);

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (settled) return;
        settled = true;
        clearTimeout(safety);
        if (session) {
          setHasSession(true);
        } else {
          toast.error('Invalid or expired reset link');
          navigate('/auth', { replace: true });
        }
      } catch (err) {
        if (settled) return;
        settled = true;
        clearTimeout(safety);
        console.error('[reset-password] getSession() failed:', err);
        navigate('/auth', { replace: true });
      }
    };
    checkSession();
    return () => {
      settled = true;
      clearTimeout(safety);
    };
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Password validation
    const hasCapital = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'/`~]/.test(password);

    if (password.length < 8) {
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
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setIsLoading(false);

    if (error) {
      toast.error(error.message || 'Failed to reset password');
    } else {
      setResetSuccess(true);
      toast.success('Password reset successfully!');
    }
  };

  if (!hasSession) {
    // Render a neutral background while we check the recovery session. Never
    // show a full-screen lime "green hourglass" here — on slow native boot it
    // looks like the app is stuck. The 2s safety above redirects to /auth.
    return <div className="fixed inset-0 bg-background overflow-hidden" />;
  }

  return (
    <div className="fixed inset-0 bg-primary flex flex-col overflow-hidden">
      {/* Back button */}
      {!resetSuccess && (
        <button
          onClick={() => navigate('/auth')}
          className="absolute top-6 left-6 text-foreground hover:opacity-70 transition-opacity"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
      )}

      {/* Logo */}
      <div className="absolute top-20 max-[375px]:top-12 left-0 right-0 flex justify-center">
        <img 
          src={fleaLogoAuth} 
          alt="FLEA" 
          width={232}
          height={84}
          loading="eager"
          fetchPriority="high"
          className="h-12 max-[375px]:h-10 object-contain"
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-[375px]:px-4 pt-16 pb-10 max-[375px]:pt-12 max-[375px]:pb-8">
        <div className="w-full max-w-[min(300px,85vw)]">
          {!resetSuccess ? (
            <>
              <h1 className="text-xl font-semibold text-foreground text-center mb-2">
                Reset Password
              </h1>
              <p className="text-sm text-foreground/70 text-center mb-6">
                Enter your new password below.
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <Popover open={passwordFocused}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="New password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
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
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
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

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-9 w-auto px-6 mx-auto flex rounded-full bg-[#423D3D] text-card text-sm font-medium hover:bg-[#423D3D]/90"
                >
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <h1 className="text-xl font-semibold text-foreground mb-2">
                Password Reset!
              </h1>
              <p className="text-sm text-foreground/70 mb-6">
                Your password has been reset successfully. You can now log in with your new password.
              </p>
              <Button
                onClick={() => navigate('/auth')}
                className="h-9 w-auto px-6 mx-auto flex rounded-full bg-[#423D3D] text-card text-sm font-medium hover:bg-[#423D3D]/90"
              >
                Back to Login
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
