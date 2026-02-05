 import { useState } from 'react';
 import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
 import { Input } from '@/components/ui/input';
 import { Button } from '@/components/ui/button';
 import { Label } from '@/components/ui/label';
 import { toast } from 'sonner';
 import { supabase } from '@/lib/supabase';
 import { Eye, EyeOff } from 'lucide-react';
 
 interface ChangePasswordSheetProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
 }
 
 const ChangePasswordSheet = ({ open, onOpenChange }: ChangePasswordSheetProps) => {
   const [newPassword, setNewPassword] = useState('');
   const [confirmPassword, setConfirmPassword] = useState('');
   const [showPassword, setShowPassword] = useState(false);
   const [showConfirmPassword, setShowConfirmPassword] = useState(false);
   const [isLoading, setIsLoading] = useState(false);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
     if (!newPassword.trim()) {
       toast.error('Please enter a new password');
       return;
     }
 
     if (newPassword.length < 6) {
       toast.error('Password must be at least 6 characters');
       return;
     }
 
     if (newPassword !== confirmPassword) {
       toast.error('Passwords do not match');
       return;
     }
 
     setIsLoading(true);
     try {
       const { error } = await supabase.auth.updateUser({
         password: newPassword,
       });
 
       if (error) throw error;
 
       toast.success('Password updated successfully');
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
       setNewPassword('');
       setConfirmPassword('');
       setShowPassword(false);
       setShowConfirmPassword(false);
     }
     onOpenChange(open);
   };
 
   return (
     <Sheet open={open} onOpenChange={handleClose}>
       <SheetContent side="bottom" className="rounded-t-3xl px-6 pb-8">
         <SheetHeader className="pb-4">
           <SheetTitle className="text-center">Change Password</SheetTitle>
         </SheetHeader>
 
         <form onSubmit={handleSubmit} className="space-y-4">
           <div>
             <Label className="text-sm font-medium text-foreground mb-2 block">New password</Label>
             <div className="relative">
               <Input
                 type={showPassword ? 'text' : 'password'}
                 placeholder="Enter new password"
                 value={newPassword}
                 onChange={(e) => setNewPassword(e.target.value)}
                 className="h-12 rounded-2xl bg-card border-0 card-shadow pr-12"
               />
               <button
                 type="button"
                 onClick={() => setShowPassword(!showPassword)}
                 className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
               >
                 {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
               </button>
             </div>
           </div>
 
           <div>
             <Label className="text-sm font-medium text-foreground mb-2 block">Confirm new password</Label>
             <div className="relative">
               <Input
                 type={showConfirmPassword ? 'text' : 'password'}
                 placeholder="Confirm new password"
                 value={confirmPassword}
                 onChange={(e) => setConfirmPassword(e.target.value)}
                 className="h-12 rounded-2xl bg-card border-0 card-shadow pr-12"
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
 
           <p className="text-xs text-muted-foreground text-center">
             Password must be at least 6 characters long.
           </p>
 
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
       </SheetContent>
     </Sheet>
   );
 };
 
 export default ChangePasswordSheet;