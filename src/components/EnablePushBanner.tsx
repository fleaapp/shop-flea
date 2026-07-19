import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/context/AuthContext';
import PushPermissionSheet from '@/components/PushPermissionSheet';
import { shouldShowPushPromptAsync, recordPushPromptDismissed } from '@/lib/pushPrompt';

/**
 * Passive banner surfaced on the Alerts page and Seller Dashboard when the
 * user hasn't opted in to push notifications yet. Respects a 7-day cooldown
 * and a 3-dismissal cap via helpers in `@/lib/pushPrompt`.
 */
const EnablePushBanner = ({ variant = 'default' }: { variant?: 'default' | 'compact' }) => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const show = await shouldShowPushPromptAsync(user?.id, 'passive');
      if (!cancelled) setVisible(show);
    };
    check();

    let remove: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      const handle = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) check();
      });
      remove = () => { handle.then((h) => h.remove()); };
    }
    return () => { cancelled = true; remove?.(); };
  }, [user?.id]);


  if (!visible) return null;

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    recordPushPromptDismissed(user?.id);
    setVisible(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className={`w-full flex items-center gap-3 rounded-2xl border border-border bg-card px-4 ${
          variant === 'compact' ? 'py-2.5' : 'py-3'
        } text-left active:opacity-80 transition-opacity`}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bell className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">Turn on notifications</p>
          <p className="text-xs text-muted-foreground leading-snug">
            Never miss a sale, message, or price drop.
          </p>
        </div>
        <span
          role="button"
          tabIndex={0}
          aria-label="Dismiss"
          onClick={handleDismiss}
          className="p-1 -mr-1 rounded-full hover:bg-muted/60 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </span>
      </button>

      <PushPermissionSheet
        open={sheetOpen}
        onOpenChange={(v) => {
          setSheetOpen(v);
          if (!v) shouldShowPushPromptAsync(user?.id, 'passive').then(setVisible);
        }}
        source="passive"
      />
    </>
  );
};

export default EnablePushBanner;
