import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import fleaLogoAuth from '@/assets/flea-logo-auth.jpeg';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setIsLoading(false);

    if (error) {
      toast.error(error.message || 'Failed to send reset email');
    } else {
      setEmailSent(true);
      toast.success('Password reset email sent!');
    }
  };

  return (
    <div className="fixed inset-0 bg-primary flex flex-col overflow-hidden">
      {/* Back button */}
      <button
        onClick={() => navigate('/auth')}
        className="absolute top-6 left-6 text-foreground hover:opacity-70 transition-opacity"
      >
        <ArrowLeft className="h-6 w-6" />
      </button>

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
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-[375px]:px-4 py-10 max-[375px]:py-8">
        <div className="w-full max-w-[min(300px,85vw)]">
          {!emailSent ? (
            <>
              <h1 className="text-xl font-semibold text-foreground text-center mb-2">
                Forgot Password?
              </h1>
              <p className="text-sm text-foreground/70 text-center mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 pl-9 rounded-lg bg-card border border-foreground text-foreground placeholder:text-muted-foreground text-sm focus-visible:ring-muted-foreground/50 focus-visible:ring-offset-0"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-10 w-full rounded-full bg-[#423D3D] text-card text-sm font-medium hover:bg-[#423D3D]/90"
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#423D3D] flex items-center justify-center mx-auto mb-4">
                <Mail className="h-8 w-8 text-card" />
              </div>
              <h1 className="text-xl font-semibold text-foreground mb-2">
                Check your email
              </h1>
              <p className="text-sm text-foreground/70 mb-6">
                Check your email for a password reset link. We sent it to <strong>{email}</strong>
              </p>
              <Button
                onClick={() => navigate('/auth')}
                className="h-10 w-full rounded-full bg-[#423D3D] text-card text-sm font-medium hover:bg-[#423D3D]/90"
              >
                Back to Login
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 text-center">
        <p className="text-sm text-foreground">
          <button className="hover:underline">Terms & Conditions</button>
          <span className="mx-2">|</span>
          <button className="hover:underline">Privacy Policy</button>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
