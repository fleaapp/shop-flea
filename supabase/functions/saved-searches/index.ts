import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EXTERNAL_URL = Deno.env.get('EXTERNAL_SUPABASE_URL') ?? 'https://dzglehiopfgfjmxtejve.supabase.co';
const EXTERNAL_ANON_KEY = Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY') ?? '';
const EXTERNAL_SERVICE_ROLE_KEY = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '';

type SavedSearchFilters = Record<string, unknown>;

type SavedSearchBody = {
  query?: unknown;
  filters?: unknown;
  region_id?: unknown;
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const parseBody = async (req: Request): Promise<SavedSearchBody> => {
  try {
    return await req.json();
  } catch {
    return {};
  }
};

const normalizeFilters = (filters: unknown): SavedSearchFilters => {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) return {};

  return Object.fromEntries(
    Object.entries(filters as Record<string, unknown>).filter(([, value]) => {
      if (value === null || value === undefined || value === '') return false;
      if (Array.isArray(value)) return value.length > 0;
      return true;
    })
  );
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const makeSignature = async (query: string, filters: SavedSearchFilters, regionId: string | null) => {
  const payload = `${query.trim().toLowerCase()}|${stableStringify(filters)}|${regionId ?? ''}`;
  const encoded = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const getUserId = async (req: Request): Promise<string | null> => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ') || !EXTERNAL_ANON_KEY) return null;

  const authClient = createClient(EXTERNAL_URL, EXTERNAL_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();

  if (error || !user?.id) return null;
  return user.id;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  if (!EXTERNAL_URL || !EXTERNAL_ANON_KEY || !EXTERNAL_SERVICE_ROLE_KEY) {
    return json({ error: 'Server misconfiguration' }, 500);
  }

  const userId = await getUserId(req);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const admin = createClient(EXTERNAL_URL, EXTERNAL_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (req.method === 'GET') {
      const { data, error } = await admin
        .from('saved_searches')
        .select('id, query, filters, region_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return json({ saved: data ?? [] });
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      const query = typeof body.query === 'string' ? body.query.trim() : '';
      const filters = normalizeFilters(body.filters);
      const regionId = typeof body.region_id === 'string' && body.region_id.trim() ? body.region_id.trim() : null;
      const hasFilters = Object.keys(filters).length > 0;

      if (!query && !hasFilters) {
        return json({ error: 'Search or filters required' }, 400);
      }

      const label = query || `Filters (${Object.keys(filters).length})`;
      const signature = await makeSignature(query, filters, regionId);

      const { data, error } = await admin
        .from('saved_searches')
        .insert({
          user_id: userId,
          query: label,
          filters,
          region_id: regionId,
          signature,
        })
        .select('id, query, filters, region_id, created_at')
        .single();

      if (error) {
        if (error.code === '23505') return json({ duplicate: true, error: 'Already saved' }, 409);
        throw error;
      }

      return json({ saved: data });
    }

    if (req.method === 'DELETE') {
      const id = new URL(req.url).searchParams.get('id');
      if (!id) return json({ error: 'Missing saved search id' }, 400);

      const { error } = await admin
        .from('saved_searches')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (error) {
    console.error('[saved-searches] error', error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
