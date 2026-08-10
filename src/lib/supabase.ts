import { createClient } from "@supabase/supabase-js";
import { authStorage } from "@/lib/authStorage";



// Lovable Cloud (Supabase) project credentials — read from Vite env at build time
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string;
const supabaseProjectRef = (import.meta.env.VITE_SUPABASE_PROJECT_ID as string) ||
  new URL(supabaseUrl).hostname.split('.')[0];

// Export the Supabase client for the rest of the app
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: authStorage,
    storageKey: `sb-${supabaseProjectRef}-auth-token`,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const originalSignInWithOAuth = supabase.auth.signInWithOAuth.bind(supabase.auth);

supabase.auth.signInWithOAuth = ((credentials: any) => {
  if (credentials?.provider === 'google' && isIosRuntime()) {
    console.error('[supabase] Blocked Google web OAuth on iOS runtime');
    return Promise.resolve({
      data: { provider: 'google', url: null },
      error: new Error('Google web OAuth is blocked on iOS because it opens Safari. Use Apple or email sign-in.'),
    } as any);
  }

  return originalSignInWithOAuth(credentials);
}) as typeof supabase.auth.signInWithOAuth;
