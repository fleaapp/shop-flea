import { useState } from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import fleaLogoAuth from '@/assets/flea-logo-auth.jpeg';

interface RegionBlockedScreenProps {
  countryCode: string;
  countryName?: string;
}

const RegionBlockedScreen = ({ countryCode, countryName }: RegionBlockedScreenProps) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('waitlist')
        .insert({
          email: email.toLowerCase().trim(),
          country_code: countryCode,
        });

      if (error) {
        // Check for unique constraint violation
        if (error.code === '23505') {
          toast.success("You're already on the waitlist! We'll notify you soon.");
          setIsSubmitted(true);
        } else {
          throw error;
        }
      } else {
        toast.success("You're on the list! We'll let you know when Flea launches in your country.");
        setIsSubmitted(true);
      }
    } catch (error) {
      console.error('Waitlist signup error:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
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
      <div className="flex-1 flex flex-col items-center justify-center px-6 max-[375px]:px-4 pt-16 pb-10">
        <div className="w-full max-w-[320px] text-center">
          {/* Australia flag and message */}
          <div className="mb-8">
           <p className="text-lg font-bold text-foreground whitespace-nowrap">
              Flea has landed in 🇦🇺
            </p>
            <p className="text-sm text-foreground/70 mt-3">
              We're expanding to more countries very soon. Drop your email below and we'll let you know as soon as Flea goes live in your country.
            </p>
          </div>

          {!isSubmitted ? (
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
                disabled={isSubmitting}
                className="h-10 w-auto px-8 mx-auto flex rounded-full bg-[#423D3D] text-card text-sm font-medium hover:bg-[#423D3D]/90"
              >
                {isSubmitting ? 'Joining...' : 'Join Waitlist'}
              </Button>
            </form>
          ) : (
            <div className="bg-card/10 rounded-xl p-6">
              <p className="text-2xl mb-2">✉️</p>
              <p className="text-sm text-foreground font-medium">
                You're on the list!
              </p>
              <p className="text-xs text-foreground/70 mt-1">
                We'll email you when Flea launches {countryName ? `in ${countryName}` : 'in your country'}.
              </p>
            </div>
          )}

          {/* Detected location indicator */}
          {countryCode && countryCode !== 'UNKNOWN' && (
            <p className="text-xs text-foreground/50 mt-6">
              Detected location: {countryName || countryCode}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegionBlockedScreen;
