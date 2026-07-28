// Detects benign "stale chunk" dynamic-import failures that happen when a
// user has an old bundle hash cached after a redeploy. These are not real
// crashes — the fix is a one-shot reload to fetch the fresh index.html.
// Also matches Safari's "Can't find variable: X" and "undefined is not an
// object (evaluating '...')" which are how iOS/Safari surface a stale bundle
// referencing symbols removed in the current deploy.
const PATTERN = /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|ChunkLoadError|Can't find variable|undefined is not an object \(evaluating|Unexpected token '<'/i;
const GUARD_KEY = 'flea:chunk-reload';

export function isStaleChunkError(err: unknown): boolean {
  const msg =
    (err as { message?: string } | null)?.message ??
    (typeof err === 'string' ? err : '');
  return !!msg && PATTERN.test(msg);
}

/**
 * Attempts a one-shot reload to recover from a stale-chunk error.
 * Returns true if a reload was scheduled, false if we've already tried
 * this session (so the caller can fall through to the normal error UI).
 */
export function tryRecoverStaleChunk(): boolean {
  try {
    if (sessionStorage.getItem(GUARD_KEY)) return false;
    sessionStorage.setItem(GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable — reload anyway; worst case the user retries.
  }
  try {
    window.location.reload();
  } catch {
    return false;
  }
  return true;
}

let installed = false;
export function installStaleChunkGuard() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('unhandledrejection', (event) => {
    if (isStaleChunkError(event.reason)) {
      event.preventDefault?.();
      tryRecoverStaleChunk();
    }
  });
  window.addEventListener('error', (event) => {
    if (isStaleChunkError(event.error) || isStaleChunkError(event.message)) {
      tryRecoverStaleChunk();
    }
  });
}
