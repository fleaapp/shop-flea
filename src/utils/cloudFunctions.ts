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

  const invokeOptions: Record<string, unknown> = {
    method: options.method ?? 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };

  // Only include body for non-GET methods
  if (options.method !== 'GET' && options.body) {
    invokeOptions.body = options.body;
  }

  const result = await cloudSupabase.functions.invoke(functionPath, invokeOptions);

  if (result.error && result.response) {
    try {
      const contentType = result.response.headers.get('content-type') || '';
      const detail = contentType.includes('application/json')
        ? await result.response.clone().json()
        : await result.response.clone().text();
      const message = typeof detail === 'string'
        ? detail
        : detail?.error || detail?.message || result.error.message;

      if (message) {
        result.error.message = message;
      }
    } catch {
      // Keep the original function error if the body cannot be parsed.
    }
  }

  return result;
}
