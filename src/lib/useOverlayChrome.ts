import * as React from "react";
import { pushOverlayAppChrome } from "@/lib/appChrome";

/**
 * Push the dark overlay status-bar chrome while an overlay (Dialog/Sheet/
 * Drawer/AlertDialog) is open.
 *
 * Timing is aligned to the Radix/Vaul backdrop animation so the native
 * status strip and the WebView backdrop change together:
 *  - On open: wait one animation frame + ~30ms so the backdrop has begun
 *    fading in before the native strip dims.
 *  - On close: wait for the overlay's `animationend`/`transitionend` (or a
 *    400ms fallback) before releasing, so the strip stays dimmed until the
 *    backdrop is fully gone.
 */
export function useOverlayChrome<T extends HTMLElement>(
  ref: React.RefObject<T>,
) {
  React.useEffect(() => {
    let released = false;
    let release: (() => void) | null = null;
    let pushTimer: number | null = null;
    let pushRaf: number | null = null;
    let releaseTimer: number | null = null;
    let observer: MutationObserver | null = null;
    let animEl: HTMLElement | null = null;

    const doRelease = () => {
      if (released) return;
      released = true;
      if (releaseTimer !== null) { window.clearTimeout(releaseTimer); releaseTimer = null; }
      if (animEl) {
        animEl.removeEventListener("animationend", onAnimEnd);
        animEl.removeEventListener("transitionend", onAnimEnd);
        animEl = null;
      }
      if (observer) { observer.disconnect(); observer = null; }
      if (release) { release(); release = null; }
    };

    const onAnimEnd = () => doRelease();

    const scheduleRelease = (el: HTMLElement) => {
      if (releaseTimer !== null || animEl) return;
      animEl = el;
      el.addEventListener("animationend", onAnimEnd);
      el.addEventListener("transitionend", onAnimEnd);
      // Fallback in case the animation/transition event never fires
      // (e.g. Vaul drag-to-close paths on some devices).
      releaseTimer = window.setTimeout(doRelease, 400);
    };

    // Delay push by one frame + ~30ms so the WebView backdrop starts fading
    // in before the native strip changes.
    pushRaf = window.requestAnimationFrame(() => {
      pushRaf = null;
      pushTimer = window.setTimeout(() => {
        pushTimer = null;
        if (released) return;
        const el = ref.current;
        // If overlay already closed before the delay fired, skip entirely.
        if (el && el.getAttribute("data-state") === "closed") {
          released = true;
          return;
        }
        release = pushOverlayAppChrome();
        if (!el) return;
        observer = new MutationObserver(() => {
          if (el.getAttribute("data-state") === "closed") {
            if (observer) { observer.disconnect(); observer = null; }
            scheduleRelease(el);
          }
        });
        observer.observe(el, { attributes: true, attributeFilter: ["data-state"] });
      }, 30);
    });

    return () => {
      if (pushRaf !== null) { window.cancelAnimationFrame(pushRaf); pushRaf = null; }
      if (pushTimer !== null) { window.clearTimeout(pushTimer); pushTimer = null; }
      doRelease();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
