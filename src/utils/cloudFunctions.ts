import { supabase } from '@/lib/supabase';

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

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  const functionPath = queryString ? `${functionName}?${queryString}` : functionName;
  const url = `https://${projectId}.supabase.co/functions/v1/${functionPath}`;
  const method = options.method ?? 'POST';

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: token ? `Bearer ${token}` : `Bearer ${anonKey}`,
    },
    body: method !== 'GET' && options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => null);

  if (!response.ok) {
    const message = typeof data === 'string'
      ? data
      : data?.error || data?.message || `Function ${functionName} failed`;
    const code = typeof data === 'object' && data ? (data as any).code : undefined;
    return {
      data: null,
      error: Object.assign(new Error(message), { status: response.status, response, code, body: data }),
      response,
    };
  }


  return { data, error: null, response };
}
