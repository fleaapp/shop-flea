import { supabase } from '@/lib/supabase';
import { supabase as cloudSupabase } from '@/integrations/supabase/client';

interface InvokeCloudFunctionOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
  query?: Record<string, string | number | boolean | null | undefined>;
}

const isOptionsObject = (
  value: Record<string, unknown> | InvokeCloudFunctionOptions
): value is InvokeCloudFunctionOptions => {
  return 'method' in value || 'body' in value || 'query' in value;
};

/**
 * Invoke a Cloud edge function with the external Supabase auth token.
 * The Cloud edge functions validate auth against the external Supabase project,
 * so we need to forward the external session token.
 */
export async function invokeCloudFunction(
  functionName: string,
  bodyOrOptions: Record<string, unknown> | InvokeCloudFunctionOptions = {}
) {
  const options = isOptionsObject(bodyOrOptions)
    ? bodyOrOptions
    : { body: bodyOrOptions };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const queryString = options.query
    ? new URLSearchParams(
        Object.entries(options.query)
          .filter(([, value]) => value !== undefined && value !== null)
          .map(([key, value]) => [key, String(value)])
      ).toString()
    : '';

  const functionPath = queryString ? `${functionName}?${queryString}` : functionName;

  return cloudSupabase.functions.invoke(functionPath, {
    method: options.method ?? 'POST',
    body: options.body,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}
