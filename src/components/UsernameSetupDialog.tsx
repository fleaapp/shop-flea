import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

interface UsernameSetupDialogProps {
  open: boolean;
  onComplete: () => void;
}

const UsernameSetupDialog = ({ open, onComplete }: UsernameSetupDialogProps) => {
  const { user, refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
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

      // Update the user's profile with the new username
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ username: `@${formattedUsername}` })
        .eq('user_id', user?.id);

      if (updateError) throw updateError;

      await refreshProfile();
      toast.success('Username set successfully!');
      onComplete();
    } catch (err) {
      console.error('Error setting username:', err);
      setError('Failed to set username. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="w-[90vw] max-w-sm rounded-2xl border-none bg-card p-6"
        hideCloseButton
      >
        <DialogHeader className="text-center">
          <DialogTitle className="text-xl font-bold text-foreground">
            Welcome to Flea! 🎉
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-2">
            Choose a unique username to get started
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <span className="absolute left-9 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
            <Input
              type="text"
              placeholder="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase());
                setError('');
              }}
              className="h-11 pl-14 rounded-lg bg-background border border-input text-foreground placeholder:text-muted-foreground text-sm"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}

          <Button
            type="submit"
            disabled={isLoading || !username.trim()}
            className="w-full h-11 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90"
          >
            {isLoading ? 'Setting up...' : 'Continue'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UsernameSetupDialog;
