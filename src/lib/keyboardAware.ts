/**
 * App-wide keyboard awareness.
 *
 * One implementation for every screen, dialog, drawer and sheet:
 *
 *  - When the on-screen keyboard covers the focused field, the field is brought
 *    back into view by exactly the overlap (plus a small margin) and nothing more.
 *  - If the field lives inside a real scroll container, we scroll that container.
 *  - If there is no scrollable ancestor (centred dialogs, `fixed inset-0` shells),
 *    we translate the owning surface upward using the CSS `translate` property,
 *    which composes with — and therefore never clobbers — existing `transform`
 *    based centring/drag animations.
 *  - Everything is reverted when the keyboard hides, focus moves to a visible
 *    field, or the surface unmounts.
 *
 * There is deliberately NO padding, NO reserved footer strip and NO permanent
 * empty space anywhere: the shift exists only while the keyboard is up.
 */

const MARGIN = 16;
const SHIFT_CLASS = 'kb-shifted';
const FOCUSABLE_SKIP_TYPES = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'];

let installed = false;
let shiftedSurface: HTMLElement | null = null;
let fittedSurface: { el: HTMLElement; maxHeight: string; overflowY: string } | null = null;
let lastFocused: HTMLElement | null = null;
let nativeKeyboardHeight = 0;
let rafId = 0;

const isEditable = (el: EventTarget | null): el is HTMLElement => {
  if (!(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLInputElement) {
    return !FOCUSABLE_SKIP_TYPES.includes((el.type || '').toLowerCase());
  }
  if (el instanceof HTMLTextAreaElement) return true;
  return el.isContentEditable;
};

const activeField = (): HTMLElement | null => {
  const el = document.activeElement as HTMLElement | null;
  return el && isEditable(el) ? el : null;
};

/** Height of the keyboard in CSS px, from the native plugin or visualViewport. */
const keyboardHeight = (): number => {
  if (nativeKeyboardHeight > 0) return nativeKeyboardHeight;
  const vv = window.visualViewport;
  if (!vv) return 0;
  const covered = window.innerHeight - (vv.height + vv.offsetTop);
  return covered > 80 ? covered : 0;
};

const getScrollParent = (el: HTMLElement): HTMLElement | null => {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.body) {
    const { overflowY } = window.getComputedStyle(node);
    const scrollable = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
    if (scrollable && node.scrollHeight > node.clientHeight + 1) return node;
    node = node.parentElement;
  }
  return null;
};

/**
 * The nearest fixed/absolute surface that owns the field — a dialog, sheet or
 * a `fixed inset-0` page shell. This is what we translate when scrolling is
 * not possible.
 */
const getShiftSurface = (el: HTMLElement): HTMLElement | null => {
  let node: HTMLElement | null = el.parentElement;
  let lastFixed: HTMLElement | null = null;
  while (node && node !== document.body) {
    const { position } = window.getComputedStyle(node);
    if (position === 'fixed') lastFixed = node;
    node = node.parentElement;
  }
  return lastFixed;
};

const clearShift = () => {
  if (!shiftedSurface) return;
  shiftedSurface.classList.remove(SHIFT_CLASS);
  shiftedSurface.style.removeProperty('--kb-shift');
  shiftedSurface = null;
};

/**
 * Temporary height cap. When a surface (a centred dialog, for example) is
 * taller than the space left above the keyboard, no amount of lifting can
 * reveal its lower fields — so while the keyboard is open we cap the surface
 * to the visible area and let it scroll internally. Fully reverted the moment
 * the keyboard closes: no padding, no spacer, nothing left behind.
 */
const clearFit = () => {
  if (!fittedSurface) return;
  const { el, maxHeight, overflowY } = fittedSurface;
  el.style.maxHeight = maxHeight;
  el.style.overflowY = overflowY;
  fittedSurface = null;
};

const applyFit = (surface: HTMLElement, available: number) => {
  if (fittedSurface && fittedSurface.el !== surface) clearFit();
  if (!fittedSurface) {
    fittedSurface = {
      el: surface,
      maxHeight: surface.style.maxHeight,
      overflowY: surface.style.overflowY,
    };
  }
  surface.style.maxHeight = `${Math.round(available)}px`;
  surface.style.overflowY = 'auto';
};

const applyShift = (surface: HTMLElement, amount: number) => {
  if (shiftedSurface && shiftedSurface !== surface) clearShift();
  surface.style.setProperty('--kb-shift', `${-Math.round(amount)}px`);
  surface.classList.add(SHIFT_CLASS);
  shiftedSurface = surface;
};

/**
 * The element that should end up visible along with the focused field: the
 * next input/button after it, so the user can tap straight through without
 * closing the keyboard. Falls back to the field itself.
 */
const nextInteractive = (el: HTMLElement): HTMLElement | null => {
  const surface = el.closest('form, [role="dialog"], [data-kb-form]') || document.body;
  const candidates = Array.from(
    surface.querySelectorAll<HTMLElement>('input, textarea, select, button, [contenteditable="true"], a[href]'),
  ).filter((c) => c.offsetParent !== null || c === el);
  const index = candidates.indexOf(el);
  if (index === -1) return null;
  for (let i = index + 1; i < candidates.length; i += 1) {
    const c = candidates[i];
    const r = c.getBoundingClientRect();
    // Ignore zero-size or visually-above elements (close buttons in headers).
    if (r.height < 8 || r.bottom <= el.getBoundingClientRect().bottom) continue;
    return c;
  }
  return null;
};

/** Bottom edge we need above the keyboard: focused field, plus what follows it. */
const targetBottom = (el: HTMLElement): number => {
  const own = el.getBoundingClientRect().bottom;
  const next = nextInteractive(el);
  if (!next) return own;
  const nb = next.getBoundingClientRect().bottom;
  // Only chase the next element when it is plausibly part of the same form
  // block (within a screen height), never something far down the page.
  if (nb - own > window.innerHeight * 0.5) return own;
  return Math.max(own, nb);
};

const ensureVisible = () => {
  const el = activeField();
  if (!el) {
    clearShift();
    clearFit();
    return;
  }

  // Chat composers lift themselves above the keyboard already.
  if (el.closest('.native-keyboard-lift')) return;

  const kb = keyboardHeight();
  if (kb <= 0) {
    clearShift();
    clearFit();
    return;
  }

  const surface = getShiftSurface(el);
  const currentShift = surface && surface === shiftedSurface
    ? Math.abs(parseFloat(surface.style.getPropertyValue('--kb-shift')) || 0)
    : 0;

  const safeBottom = window.innerHeight - kb - MARGIN;
  const wanted = targetBottom(el);
  const overlap = wanted - safeBottom;

  if (overlap <= 0) {
    // Everything that matters is visible. Release our own shift only if the
    // content would still be clear without it.
    if (currentShift > 0 && wanted + currentShift <= safeBottom) clearShift();
    return;
  }

  const scrollParent = getScrollParent(el);
  if (scrollParent && scrollParent !== fittedSurface?.el) {
    clearFit();
    const before = scrollParent.scrollTop;
    scrollParent.scrollTop = Math.min(
      scrollParent.scrollHeight - scrollParent.clientHeight,
      before + overlap,
    );
    const moved = scrollParent.scrollTop - before;
    const residual = overlap - moved;
    if (residual <= 1) {
      clearShift();
      return;
    }
    // The container hit its limit — lift the owning surface by the remainder.
    if (surface) {
      const rect = surface.getBoundingClientRect();
      const headroomLeft = Math.max(0, rect.top + currentShift - MARGIN);
      const lift = currentShift + Math.min(residual, headroomLeft);
      if (lift > 0) applyShift(surface, lift);
    } else {
      window.scrollBy({ top: residual, behavior: 'smooth' });
    }
    return;
  }


  if (!surface) {
    window.scrollBy({ top: overlap, behavior: 'smooth' });
    return;
  }

  // Lift as far as needed, stopping only when the top of the surface would
  // leave the screen.
  const surfaceRect = surface.getBoundingClientRect();
  const surfaceTop = surfaceRect.top + currentShift;
  const headroom = Math.max(0, surfaceTop - MARGIN);
  const next = currentShift + Math.min(overlap, headroom);
  if (next > 0) applyShift(surface, next);

  // Last resort only: the surface is genuinely taller than the space left, so
  // even a full lift cannot reveal everything. Cap it and let it scroll.
  const stillHidden = overlap - headroom;
  if (stillHidden > 0) {
    const available = window.innerHeight - kb - MARGIN * 2;
    if (available > 120 && surface.scrollHeight > available) {
      applyFit(surface, available);
      const after = el.getBoundingClientRect().bottom;
      const remaining = after - safeBottom;
      if (remaining > 0) surface.scrollBy({ top: remaining, behavior: 'smooth' });
    }
  } else {
    clearFit();
  }
};



const schedule = () => {
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => ensureVisible());
};

export const installKeyboardAware = (): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  if (installed) return () => undefined;
  installed = true;

  const onFocusIn = (e: Event) => {
    if (!isEditable(e.target)) return;
    lastFocused = e.target as HTMLElement;
    schedule();
    // Second pass once the keyboard animation has settled.
    window.setTimeout(() => {
      if (document.activeElement === lastFocused) ensureVisible();
    }, 300);
  };

  const onFocusOut = () => {
    lastFocused = null;
    // If nothing else takes focus, drop the shift and the temporary cap.
    window.setTimeout(() => {
      if (!activeField()) {
        clearShift();
        clearFit();
      }
    }, 60);
  };

  const onViewportChange = () => schedule();

  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', onFocusOut, true);
  window.visualViewport?.addEventListener('resize', onViewportChange);

  let removeNative: (() => void) | undefined;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) {
    void import('@capacitor/keyboard')
      .then(async ({ Keyboard }) => {
        const show = await Keyboard.addListener('keyboardWillShow', (info) => {
          nativeKeyboardHeight = Math.max(0, Number(info.keyboardHeight) || 0);
          document.documentElement.style.setProperty(
            '--native-keyboard-height',
            `${nativeKeyboardHeight}px`,
          );
          schedule();
        });
        const didShow = await Keyboard.addListener('keyboardDidShow', () => ensureVisible());
        const reset = () => {
          nativeKeyboardHeight = 0;
          document.documentElement.style.setProperty('--native-keyboard-height', '0px');
          clearShift();
          clearFit();
        };
        const willHide = await Keyboard.addListener('keyboardWillHide', reset);
        const didHide = await Keyboard.addListener('keyboardDidHide', reset);
        removeNative = () => {
          void show.remove();
          void didShow.remove();
          void willHide.remove();
          void didHide.remove();
        };
      })
      .catch(() => undefined);
  }

  return () => {
    cancelAnimationFrame(rafId);
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('focusout', onFocusOut, true);
    window.visualViewport?.removeEventListener('resize', onViewportChange);
    removeNative?.();
    clearShift();
    clearFit();
    installed = false;
  };
};

export default installKeyboardAware;
