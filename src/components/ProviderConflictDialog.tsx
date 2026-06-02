import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type ConflictProvider = 'email' | 'google' | 'apple';

interface Props {
  open: boolean;
  provider: ConflictProvider | null;
  onContinue: () => void;
  onCancel: () => void;
}

const providerCopy: Record<ConflictProvider, { label: string; cta: string }> = {
  google: { label: 'Google', cta: 'Continue with Google' },
  apple: { label: 'Apple', cta: 'Continue with Apple' },
  email: { label: 'email & password', cta: 'Log in with password' },
};

const ProviderConflictDialog = ({ open, provider, onContinue, onCancel }: Props) => {
  const copy = provider ? providerCopy[provider] : null;

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent className="max-w-[320px] rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">Account already exists</AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            This email is already registered with <strong>{copy?.label}</strong>. Use that to sign in instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2">
          <AlertDialogCancel className="h-9 rounded-lg flex-1 mt-0">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onContinue}
            className="h-9 rounded-lg flex-1 bg-primary text-foreground hover:bg-primary/90"
          >
            {copy?.cta ?? 'Continue'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ProviderConflictDialog;
