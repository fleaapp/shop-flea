// Client-side runtime error logger. Sends errors to the log-error edge function
// with deduplication so a broken screen cannot flood the log.
import { supabase } from '@/lib/supabase';

const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/log-error`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type LogInput = {
  title: string;
  message: string;
  stack?: string | null;
  severity?: 'warning' | 'error' | 'critical';
  source?: 'client' | 'auth';
  route?: string;
  context?: Record<string, unknown>;
};

const seen = new Map<string, number>();
const DEDUPE_MS = 30_000;

const getDevice = () => {
  if (typeof navigator === 'undefined') return {};
  const w = typeof window !== 'undefined' ? window : (undefined as any);
  return {
    platform: navigator.platform,
    user_agent: navigator.userAgent,
    viewport: w ? `${w.innerWidth}x${w.innerHeight}` : null,
    app_version: (import.meta.env.VITE_APP_VERSION as string) || null,
  };
};

export async function logError(input: LogInput): Promise<void> {
  try {
    if (input.severity === 'warning') return;

    const title = (input.title || 'Error').slice(0, 200);
    const message = (input.message || '').slice(0, 2000);
    const dedupeKey = `${input.source ?? 'client'}:${title}:${message.slice(0, 120)}`;
    const now = Date.now();
    const last = seen.get(dedupeKey);
    if (last && now - last < DEDUPE_MS) return;
    seen.set(dedupeKey, now);
    // Trim map occasionally
    if (seen.size > 200) {
      for (const [k, t] of seen) if (now - t > DEDUPE_MS) seen.delete(k);
    }

    let token: string | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    } catch { /* ignore */ }

    const route = typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined;

    await fetch(FN_URL, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON,
        Authorization: token ? `Bearer ${token}` : `Bearer ${ANON}`,
      },
      body: JSON.stringify({
        source: input.source ?? 'client',
        severity: input.severity ?? 'error',
        title,
        message,
        stack: input.stack ?? null,
        route: input.route ?? route,
        device: getDevice(),
        context: input.context ?? null,
        dedupe_key: dedupeKey,
      }),
    });
  } catch (e) {
    // Never let the logger throw.
    console.warn('[errorLogger] failed to log', e);
  }
}

let installed = false;
export function installGlobalErrorHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    const err = event.error;
    const message = err?.message || event.message || 'Unknown error';
    // Filter out noisy vite HMR / dynamic import errors that only occur during dev.
    if (/Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|ChunkLoadError|^Load failed$/i.test(message)) return;
    void logError({
      title: 'Uncaught error',
      message,
      stack: err?.stack ?? null,
      context: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason: any = event.reason;
    const message = reason?.message || (typeof reason === 'string' ? reason : 'Unhandled promise rejection');
    void logError({
      title: 'Unhandled promise rejection',
      message,
      stack: reason?.stack ?? null,
    });
  });
}
