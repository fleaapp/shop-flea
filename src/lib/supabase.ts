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
