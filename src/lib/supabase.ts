import { createClient } from "@supabase/supabase-js";

// Get URL and publishable key from environment variables (Lovable Cloud)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Make sure the environment variables exist
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables. Check your .env file.");
}

// Export the Supabase client for the rest of the app
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
