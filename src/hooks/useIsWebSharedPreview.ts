import { useEffect, useState } from 'react';

/**
 * Returns true when the current page is being viewed as a shared web link,
 * i.e. NOT inside the native Capacitor app and NOT running as an installed PWA.
 * Used to switch listing details into a "shared link preview" mode that shows
 * the download-the-app banner and hides in-app action buttons.
 */
export const useIsWebSharedPreview = (): boolean => {
  const [isWebPreview, setIsWebPreview] = useState(false);

  useEffect(() => {
    try {
      const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
      if (cap?.isNativePlatform?.()) return;

      const standalone =
        window.matchMedia?.('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      if (standalone) return;

      setIsWebPreview(true);
    } catch {
      setIsWebPreview(true);
    }
  }, []);

  return isWebPreview;
};
