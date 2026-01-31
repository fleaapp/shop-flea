import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import fleaLogoHeader from '@/assets/flea-logo-welcome-header.png';

interface WelcomeSetupDialogProps {
  open: boolean;
  onComplete: () => void;
}

const WelcomeSetupDialog = ({ open, onComplete }: WelcomeSetupDialogProps) => {
  const { user, refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username is required');
      return;
    }

    // Validate username format (lowercase, alphanumeric, underscores)
    const formattedUsername = username.toLowerCase().trim();
    if (!/^[a-z0-9_]+$/.test(formattedUsername)) {
      setError('Username can only contain lowercase letters, numbers, and underscores');
      return;
    }

    if (formattedUsername.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (formattedUsername.length > 20) {
      setError('Username must be 20 characters or less');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Check if username is already taken
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', `@${formattedUsername}`)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingUser) {
        setError('This username is already taken');
        setIsLoading(false);
        return;
      }

      // Update the user's profile with all fields
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          username: `@${formattedUsername}`,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null
        })
        .eq('user_id', user?.id);

      if (updateError) throw updateError;

      await refreshProfile();
      toast.success('Profile setup complete! Welcome to Flea! 🎉');
      onComplete();
    } catch (err) {
      console.error('Error setting up profile:', err);
      setError('Failed to set up profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="w-[90vw] max-w-sm rounded-3xl border-2 border-charcoal/40 bg-card p-5"
        hideCloseButton
      >
        <DialogHeader className="text-center space-y-3 pt-3">
          <div className="flex justify-center">
            <img src={fleaLogoHeader} alt="FLEA" className="h-10 w-auto" />
          </div>
          <DialogDescription className="text-sm text-muted-foreground text-center pt-1">
            The future of fashion is circular, and it starts with <em>you</em>. Introduce yourself!
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3 px-4">
          {/* Username - Required */}
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">
              Username <span className="text-destructive">*</span>
            </label>
          <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
              <Input
                type="text"
                placeholder="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase());
                  setError('');
                }}
                className="h-11 pl-8 rounded-lg bg-background border border-input text-foreground placeholder:text-muted-foreground text-sm"
                autoFocus
              />
            </div>
          </div>

          {/* First Name */}
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">
              First Name
            </label>
            <Input
              type="text"
              placeholder="Your first name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="h-11 rounded-lg bg-background border border-input text-foreground placeholder:text-muted-foreground text-sm"
            />
          </div>

          {/* Last Name */}
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">
              Last Name
            </label>
            <Input
              type="text"
              placeholder="Your last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="h-11 rounded-lg bg-background border border-input text-foreground placeholder:text-muted-foreground text-sm"
            />
          </div>

          <p className="text-[11px] text-muted-foreground/70 text-center">
            Your name is only shared when you make a purchase.
          </p>

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}

          <div className="flex justify-center pt-2 pb-3">
            <Button
              type="submit"
              disabled={isLoading || !username.trim()}
              className="px-8 h-11 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90"
            >
              {isLoading ? 'Setting up...' : 'Start Swiping! 👉'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeSetupDialog;
