import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Returns true when the current page is being viewed as a shared web link
 * by a NOT-signed-in visitor, i.e.:
 *   - Not inside the native Capacitor app
 *   - Not running as an installed PWA (standalone display mode)
 *   - No active Supabase session
 *
 * Used to switch listing details into a "shared link preview" mode that shows
 * the download-the-app banner and hides in-app action buttons, nudging web
 * visitors to install the app rather than log in on the web.
 */
export const useIsWebSharedPreview = (): boolean => {
  const [isWebPreview, setIsWebPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const isWebEnv = (): boolean => {
      try {
        const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
        if (cap?.isNativePlatform?.()) return false;
        const standalone =
          window.matchMedia?.('(display-mode: standalone)').matches ||
          (window.navigator as unknown as { standalone?: boolean }).standalone === true;
        if (standalone) return false;
        return true;
      } catch {
        return true;
      }
    };

    if (!isWebEnv()) {
      setIsWebPreview(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setIsWebPreview(!data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setIsWebPreview(isWebEnv() && !session);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return isWebPreview;
};
