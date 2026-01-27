import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://dzglehiopfgfjmxtejve.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Z2xlaGlvcGZnZmpteHRlanZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5NzI0MjUsImV4cCI6MjA4NDU0ODQyNX0.qfOBjubnuod5iGF_G_gH2ZhMDJ1fVwAO9p5BZSxG0xI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
