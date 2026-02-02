import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import fleaLogoAuth from '@/assets/flea-logo-auth.jpeg';
import { Button } from '@/components/ui/button';

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

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
        <div className="w-full max-w-[min(300px,85vw)] text-center">
          <div className="w-16 h-16 rounded-full bg-[#423D3D] flex items-center justify-center mx-auto mb-4">
            <Mail className="h-8 w-8 text-card" />
          </div>
          
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Verify your email
          </h1>
          
          <p className="text-sm text-foreground/70 mb-6">
            Check your inbox — we just sent a verification email to{' '}
            {email ? <strong>{email}</strong> : 'your email address'}!
            Click the link to activate your account.
          </p>

          <div className="space-y-3">
            <Button
              onClick={() => navigate('/auth')}
              className="h-10 w-full rounded-full bg-[#423D3D] text-card text-sm font-medium hover:bg-[#423D3D]/90"
            >
              Back to Login
            </Button>
            
            <p className="text-xs text-foreground/50">
              Didn't receive the email? Check your spam folder or try signing up again.
            </p>
          </div>
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

export default VerifyEmail;
