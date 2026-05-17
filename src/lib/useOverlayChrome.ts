import * as React from "react";
import { pushOverlayAppChrome } from "@/lib/appChrome";

/**
 * Push the dark overlay status-bar chrome while an overlay (Dialog/Sheet/
 * Drawer/AlertDialog) is open. Releases chrome as soon as the overlay's
 * `data-state` flips to "closed" — not on unmount — so the status bar
 * doesn't stay black during the exit animation.
 */
export function useOverlayChrome<T extends HTMLElement>(
  ref: React.RefObject<T>,
) {
  React.useLayoutEffect(() => {
    const release = pushOverlayAppChrome();
    const el = ref.current;
    let released = false;
    const releaseOnce = () => {
      if (released) return;
      released = true;
      release();
    };
    if (!el) return releaseOnce;

    if (el.getAttribute("data-state") === "closed") {
      releaseOnce();
      return () => undefined;
    }

    const observer = new MutationObserver(() => {
      if (el.getAttribute("data-state") === "closed") releaseOnce();
    });
    observer.observe(el, { attributes: true, attributeFilter: ["data-state"] });

    return () => {
      observer.disconnect();
      releaseOnce();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
