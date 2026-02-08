import { AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const BlockedUserBanner = () => {
  return (
    <Alert variant="destructive" className="mx-4 mt-4 rounded-2xl border-destructive/50 bg-destructive/10">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="font-bold">Account Restricted</AlertTitle>
      <AlertDescription className="text-sm">
        Your account has been temporarily restricted due to repeated guideline violations. 
        You can still browse, but cannot create listings, purchase items, or comment. 
        If you believe this is a mistake, please contact support.
      </AlertDescription>
    </Alert>
  );
};

export default BlockedUserBanner;
