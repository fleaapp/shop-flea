import { useCallback, useEffect, useRef } from 'react';

/**
 * Persists a snapshot object to localStorage so that in-progress form state
 * survives the WebView being killed when the user backgrounds the app.
 *
 * - `key` may be `null` (e.g. while auth is still loading) — in that case the
 *   hook stays inert until a real key is provided.
 * - The snapshot is written debounced on change, and force-flushed when the
 *   page is hidden or unloaded (iOS may terminate the WebView the moment we
 *   go to background, so a debounce alone would lose the last edit).
 * - Hydration happens exactly once, on the first render where a key exists.
 *   Callers pass a `hydrate` callback that unpacks the snapshot back into
 *   their local `useState` setters.
 * - Returns `{ clear, hasHydrated }`. Call `clear()` after a successful
 *   submit to wipe the draft.
 */
export function useSnapshotDraft<T>(
  key: string | null,
  snapshot: T,
  hydrate: (value: T) => void,
): { clear: () => void; hasHydrated: boolean } {
  const hydratedRef = useRef(false);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  // Hydrate once when the key first becomes available.
  useEffect(() => {
    if (!key || hydratedRef.current) return;
    hydratedRef.current = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        hydrate(parsed);
      }
    } catch (err) {
      console.warn('[useSnapshotDraft] hydrate failed:', err);
    }
    // hydrate is intentionally excluded so a new function identity on every
    // render doesn't cause a re-hydration loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Debounced write on change.
  useEffect(() => {
    if (!key || !hydratedRef.current) return;
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(snapshot));
      } catch (err) {
        console.warn('[useSnapshotDraft] persist failed:', err);
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [key, snapshot]);

  // Force-flush on background / unload so we never lose the last keystroke.
  useEffect(() => {
    if (!key) return;
    const flush = () => {
      try {
        localStorage.setItem(key, JSON.stringify(snapshotRef.current));
      } catch (err) {
        console.warn('[useSnapshotDraft] flush failed:', err);
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', flush);
    };
  }, [key]);

  const clear = useCallback(() => {
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  }, [key]);

  return { clear, hasHydrated: hydratedRef.current };
}
