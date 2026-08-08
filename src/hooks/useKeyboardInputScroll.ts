import { useEffect } from 'react';

/**
 * Keeps the focused input visible above the on-screen keyboard.
 *
 * Capacitor's `KeyboardResize.Body` only pads <body>, so WebKit's native
 * scroll-to-focused-input never reaches fields that live inside their own
 * scroll container (sheets, drawers, dialogs). This hook scrolls the focused
 * element's nearest scrollable ancestor so the field sits comfortably above
 * the keyboard, and undoes everything when the keyboard hides — no permanent
 * padding, no coloured strip at the bottom.
 */

const FOCUSABLE = 'input, textarea, [contenteditable="true"]';
const MARGIN = 24; // breathing room between the field and the keyboard

const getScrollParent = (el: HTMLElement): HTMLElement | null => {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;
    const scrollable = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    if (scrollable && node.scrollHeight > node.clientHeight + 1) return node;
    node = node.parentElement;
  }
  return null;
};

export const useKeyboardInputScroll = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let keyboardHeight = 0;
    let rafId = 0;

    const activeField = (): HTMLElement | null => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      return el.matches?.(FOCUSABLE) ? el : null;
    };

    const ensureVisible = () => {
      const el = activeField();
      if (!el) return;

      const viewportBottom =
        (window.visualViewport?.height ?? window.innerHeight) -
        (keyboardHeight > 0 ? keyboardHeight - (window.innerHeight - (window.visualViewport?.height ?? window.innerHeight)) : 0);

      const rect = el.getBoundingClientRect();
      const overflow = rect.bottom + MARGIN - viewportBottom;
      if (overflow <= 0 && rect.top > MARGIN) return;

      const parent = getScrollParent(el);
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        const target = rect.top - parentRect.top + parent.scrollTop;
        const desiredTop = Math.max(
          0,
          target - Math.max(MARGIN, (Math.min(parentRect.bottom, viewportBottom) - parentRect.top) / 2 - rect.height),
        );
        parent.scrollTo({ top: desiredTop, behavior: 'smooth' });
      } else if (overflow > 0) {
        window.scrollBy({ top: overflow, behavior: 'smooth' });
      } else {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    };

    const schedule = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => setTimeout(ensureVisible, 60));
    };

    const onFocusIn = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target?.matches?.(FOCUSABLE)) return;
      schedule();
      // Second pass after the keyboard animation settles.
      setTimeout(ensureVisible, 320);
    };

    document.addEventListener('focusin', onFocusIn);

    const onViewportResize = () => {
      if (!activeField()) return;
      schedule();
    };
    window.visualViewport?.addEventListener('resize', onViewportResize);

    // Native keyboard events give us the exact keyboard height on iOS/Android.
    let removeShow: (() => void) | undefined;
    let removeHide: (() => void) | undefined;
    const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (cap?.isNativePlatform?.()) {
      void import('@capacitor/keyboard')
        .then(async ({ Keyboard }) => {
          const showHandle = await Keyboard.addListener('keyboardWillShow', (info) => {
            keyboardHeight = info.keyboardHeight || 0;
            schedule();
            setTimeout(ensureVisible, 280);
          });
          const hideHandle = await Keyboard.addListener('keyboardWillHide', () => {
            keyboardHeight = 0;
          });
          removeShow = () => void showHandle.remove();
          removeHide = () => void hideHandle.remove();
        })
        .catch(() => undefined);
    }

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('focusin', onFocusIn);
      window.visualViewport?.removeEventListener('resize', onViewportResize);
      removeShow?.();
      removeHide?.();
    };
  }, []);
};

export default useKeyboardInputScroll;
