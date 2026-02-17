import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';


interface PasswordSetupDialogProps {
  open: boolean;
  onComplete: () => void;
}

const PasswordSetupDialog = ({ open, onComplete }: PasswordSetupDialogProps) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const validate = () => {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Must include at least one capital letter';
    if (!/[0-9]/.test(password)) return 'Must include at least one number';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Must include at least one symbol';
    if (password !== confirmPassword) return 'Passwords do not match';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError('');

    // Transition UI immediately, update password in background
    toast.success('Password created successfully! 🔒');
    onComplete();

    // Fire password update in background — don't block the UI
    supabase.auth.updateUser({ password }).then(async ({ error: updateError }) => {
      if (updateError) {
        console.error('Error setting password:', updateError);
        toast.error('Password failed to save. Please set it in Settings.');
        return;
      }
      // Update metadata and profile DB column in background
      await Promise.all([
        supabase.auth.updateUser({ data: { password_set: true } }),
        supabase.auth.getUser().then(({ data }) => {
          if (data?.user?.id) {
            return supabase.from('profiles').update({ password_set: true }).eq('user_id', data.user.id);
          }
        }),
      ]);
    }).catch((err) => {
      console.error('Error setting password:', err);
      toast.error('Password failed to save. Please set it in Settings.');
    });
  };

  const isValid = password.length >= 8 && password === confirmPassword;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="w-[90vw] max-w-sm rounded-3xl border-[3px] border-charcoal bg-card p-5"
        hideCloseButton
      >
        <DialogHeader className="text-center space-y-2 pt-2">
          <h2 className="text-xl font-bold text-foreground">Create Your Password</h2>
          <DialogDescription className="text-sm text-muted-foreground text-center">
            One last step before you start swiping!
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-3 px-4">
          {/* Password */}
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">
              Password <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                className="h-11 pr-10 rounded-lg bg-background border border-input text-foreground placeholder:text-muted-foreground text-sm"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">
              Confirm Password <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                className="h-11 pr-10 rounded-lg bg-background border border-input text-foreground placeholder:text-muted-foreground text-sm"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/70 text-center">
            Min 8 characters, 1 capital, 1 number, 1 symbol.
          </p>

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}

          <div className="flex justify-center pt-2 pb-3">
            <Button
              type="submit"
              disabled={isLoading || !isValid}
              className="px-8 h-11 rounded-full bg-primary text-primary-foreground font-medium hover:bg-primary/90"
            >
              {isLoading ? 'Setting up...' : 'Start Swiping 👉'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordSetupDialog;
