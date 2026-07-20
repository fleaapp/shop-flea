import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
 import { Input } from '@/components/ui/input';
 import { Button } from '@/components/ui/button';
 import { Label } from '@/components/ui/label';
 import { toast } from 'sonner';
 import { supabase } from '@/lib/supabase';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
 
 interface ChangePasswordSheetProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 const ChangePasswordSheet = ({ open, onOpenChange }: ChangePasswordSheetProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
   const [newPassword, setNewPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
   const [showPassword, setShowPassword] = useState(false);
   const [showConfirmPassword, setShowConfirmPassword] = useState(false);
   const [isLoading, setIsLoading] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
    if (!currentPassword.trim()) {
      toast.error('Please enter your current password');
       return;
     }
 
    if (!newPassword.trim()) {
      toast.error('Please enter a new password');
       return;
     }
 
    // Password validation: 8 chars, 1 capital, 1 number, 1 symbol
    const hasCapital = /[A-Z]/.test(newPassword);
    const hasNumber = /\d/.test(newPassword);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'/`~]/.test(newPassword);

    if (newPassword.length < 8) {
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

     if (newPassword !== confirmPassword) {
       toast.error('Passwords do not match');
       return;
     }
 
     setIsLoading(true);
     try {
      // First verify the current password by re-authenticating
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('Unable to verify current password');
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('Current password is incorrect');
      }

      // Now update to the new password
       const { error } = await supabase.auth.updateUser({
         password: newPassword,
       });
 
       if (error) throw error;
 
       toast.success('Password updated successfully');
      setCurrentPassword('');
       setNewPassword('');
       setConfirmPassword('');
       onOpenChange(false);
     } catch (error: any) {
       toast.error(error.message || 'Failed to update password');
     } finally {
       setIsLoading(false);
     }
   };
 
   const handleClose = (open: boolean) => {
     if (!open) {
      setCurrentPassword('');
       setNewPassword('');
       setConfirmPassword('');
      setShowCurrentPassword(false);
       setShowPassword(false);
       setShowConfirmPassword(false);
     }
     onOpenChange(open);
   };
 
   return (
    <Drawer open={open} onOpenChange={handleClose}>
      <DrawerContent className="px-6 pb-8">
        <DrawerHeader className="pb-4">
          <DrawerTitle className="text-center">Change Password</DrawerTitle>
        </DrawerHeader>
 
         <form onSubmit={handleSubmit} className="space-y-4">
           <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">Current password</Label>
             <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
               <Input
                type={showCurrentPassword ? 'text' : 'password'}
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-12 pl-10 rounded-2xl bg-card border-0 card-shadow pr-12"
               />
               <button
                 type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                 className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
               >
                {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
               </button>
             </div>
           </div>
 
           <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">New password</Label>
            <Popover open={passwordFocused}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    className="h-12 pl-10 rounded-2xl bg-card border-0 card-shadow pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
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
           </div>
 
          <div>
            <Label className="text-sm font-medium text-foreground mb-2 block">Confirm new password</Label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 pl-10 rounded-2xl bg-card border-0 card-shadow pr-12"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
 
           <div className="flex justify-center pt-2">
             <Button
               type="submit"
               disabled={isLoading}
               className="w-48 h-12 rounded-full bg-primary text-primary-foreground font-medium"
             >
               {isLoading ? 'Updating...' : 'Update Password'}
             </Button>
           </div>
         </form>
      </DrawerContent>
    </Drawer>
   );
 };
 
 export default ChangePasswordSheet;