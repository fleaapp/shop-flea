import { createClient } from "@supabase/supabase-js";

// Get URL and anon key from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Make sure the environment variables exist
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Check your .env file.");
}

// Export the Supabase client for the rest of the app
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
