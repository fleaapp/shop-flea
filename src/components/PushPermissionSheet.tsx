import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/context/AuthContext';
import {
  pushPromptCopy,
  recordPushPromptDismissed,
  getPushPermission,
  type PushPromptSource,
} from '@/lib/pushPrompt';

interface PushPermissionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: PushPromptSource;
}

const PushPermissionSheet = ({ open, onOpenChange, source }: PushPermissionSheetProps) => {
  const { user } = useAuth();
  const { triggerSubscribe } = usePushNotifications();
  const [submitting, setSubmitting] = useState(false);
  const copy = pushPromptCopy[source];
  const currentPerm = getPushPermission();
  const isDenied = currentPerm === 'denied';

  const handleEnable = async () => {
    setSubmitting(true);
    try {
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
        const req = await PushNotifications.requestPermissions();
        if (req.receive !== 'granted') {
          toast.error('Notifications were not enabled.');
          onOpenChange(false);
          return;
        }
        await PushNotifications.register();
      } else {
        await triggerSubscribe();
        if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
          toast.error('Notifications were not enabled.');
          onOpenChange(false);
          return;
        }
      }
      toast.success("You're all set. We'll keep you posted.");
      onOpenChange(false);
    } catch (err) {
      console.error('[PushPromptSheet] enable failed:', err);
      toast.error('Could not enable notifications. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = () => {
    recordPushPromptDismissed(user?.id);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleDismiss(); else onOpenChange(v); }}>
      <SheetContent
        side="bottom"
        overlayClassName="data-[state=closed]:animate-none"
        className="rounded-t-3xl border-t-[3px] border-charcoal p-0 flex flex-col bg-background"
      >
        <div className="px-6 pt-8 pb-8 flex flex-col items-center text-center gap-4">
          <div className="text-5xl" aria-hidden>🔔</div>
          <SheetHeader className="space-y-2 items-center text-center">
            <SheetTitle className="text-xl text-center">{copy.title}</SheetTitle>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[300px] mx-auto">
              {copy.body}
            </p>
            {isDenied && (
              <p className="text-xs text-muted-foreground leading-relaxed max-w-[300px] mx-auto pt-1">
                Notifications are currently blocked. Enable them in your device settings under Flea.
              </p>
            )}
          </SheetHeader>
          <div className="w-full flex flex-col items-center gap-2 mt-3">
            <Button
              onClick={handleEnable}
              disabled={submitting || isDenied}
              className="w-52 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 text-[15px] font-semibold disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Enabling...
                </>
              ) : (
                'Turn on notifications'
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={handleDismiss}
              disabled={submitting}
              className="w-auto h-10 px-4 rounded-full bg-transparent text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
            >
              Not now
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PushPermissionSheet;
