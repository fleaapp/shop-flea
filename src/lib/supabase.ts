import { createClient } from "@supabase/supabase-js";

function isIosRuntime(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const cap = (window as any).Capacitor;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1) ||
    window.location.protocol === 'capacitor:' ||
    cap?.getPlatform?.() === 'ios' ||
    !!cap?.isNativePlatform?.() ||
    !!(window as any).webkit?.messageHandlers?.bridge
  );
}

// External Supabase project credentials
const supabaseUrl = "https://dzglehiopfgfjmxtejve.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Z2xlaGlvcGZnZmpteHRlanZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzI0MjUsImV4cCI6MjA4NDU0ODQyNX0.qfOBjubnuod5iGF_G_gH2ZhMDJ1fVwAO9p5BZSxG0xI";

// Export the Supabase client for the rest of the app
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

const originalSignInWithOAuth = supabase.auth.signInWithOAuth.bind(supabase.auth);

supabase.auth.signInWithOAuth = ((credentials: any) => {
  if (credentials?.provider === 'google' && isIosRuntime()) {
    console.error('[supabase] Blocked Google web OAuth on iOS runtime');
    return Promise.resolve({
      data: { provider: 'google', url: null },
      error: new Error('Google web OAuth is blocked on iOS because it opens Safari. Use native Google sign-in.'),
    } as any);
  }

  return originalSignInWithOAuth(credentials);
}) as typeof supabase.auth.signInWithOAuth;
