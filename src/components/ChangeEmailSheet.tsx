import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
 import { Input } from '@/components/ui/input';
 import { Button } from '@/components/ui/button';
 import { Label } from '@/components/ui/label';
 import { toast } from 'sonner';
 import { supabase } from '@/lib/supabase';
 
 interface ChangeEmailSheetProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   currentEmail: string;
 }
 
 const ChangeEmailSheet = ({ open, onOpenChange, currentEmail }: ChangeEmailSheetProps) => {
   const [newEmail, setNewEmail] = useState('');
   const [isLoading, setIsLoading] = useState(false);
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     
     if (!newEmail.trim()) {
       toast.error('Please enter a new email address');
       return;
     }
 
     if (newEmail === currentEmail) {
       toast.error('New email must be different from current email');
       return;
     }
 
     // Basic email validation
     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
     if (!emailRegex.test(newEmail)) {
       toast.error('Please enter a valid email address');
       return;
     }
 
     setIsLoading(true);
     try {
       const { error } = await supabase.auth.updateUser({
         email: newEmail.trim(),
       });
 
       if (error) throw error;
 
       toast.success('Verification email sent to your new address. Please check both inboxes.');
       setNewEmail('');
       onOpenChange(false);
     } catch (error: any) {
       toast.error(error.message || 'Failed to update email');
     } finally {
       setIsLoading(false);
     }
   };
 
   return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-6 pb-8">
        <DrawerHeader className="pb-4">
          <DrawerTitle className="text-center">Change Email</DrawerTitle>
        </DrawerHeader>
 
         <form onSubmit={handleSubmit} className="space-y-4">
           <div>
             <Label className="text-sm font-medium text-foreground mb-2 block">Current email</Label>
             <div className="h-12 rounded-2xl bg-muted px-4 flex items-center">
               <span className="text-muted-foreground">{currentEmail}</span>
             </div>
           </div>
 
           <div>
             <Label className="text-sm font-medium text-foreground mb-2 block">New email</Label>
             <Input
               type="email"
               placeholder="Enter new email address"
               value={newEmail}
               onChange={(e) => setNewEmail(e.target.value)}
               className="h-12 rounded-2xl bg-card border-0 card-shadow"
             />
           </div>
 
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            You'll need to verify your new email address<br />before the change takes effect.
           </p>
 
           <div className="flex justify-center pt-2">
             <Button
               type="submit"
               disabled={isLoading}
               className="w-48 h-12 rounded-full bg-primary text-primary-foreground font-medium"
             >
               {isLoading ? 'Sending...' : 'Update Email'}
             </Button>
           </div>
         </form>
      </DrawerContent>
    </Drawer>
   );
 };
 
 export default ChangeEmailSheet;