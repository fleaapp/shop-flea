import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';

/**
 * Invoke a Cloud edge function with the external Supabase auth token.
 * The Cloud edge functions validate auth against the external Supabase project,
 * so we need to forward the external session token.
 */
export async function invokeCloudFunction(
  functionName: string,
  body: Record<string, unknown>
) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  return cloudSupabase.functions.invoke(functionName, {
    body,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
