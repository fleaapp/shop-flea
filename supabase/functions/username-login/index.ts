// Signs a user in with @username + password entirely on the server, so the
// email behind a username is never returned to the client.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const FAIL = { error: 'invalid_credentials' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const raw = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const bare = raw.replace(/^@/, '');
    if (!/^[a-z0-9._-]{1,40}$/.test(bare) || password.length < 1 || password.length > 200) {
      return json(FAIL, 400);
    }

    const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });

    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const [{ data: ipOk }, { data: userOk }] = await Promise.all([
      svc.rpc('check_and_record_rate_limit', { _key: `ulogin:ip:${ip}`, _max: 20, _window_seconds: 600 }),
      svc.rpc('check_and_record_rate_limit', { _key: `ulogin:u:${bare}`, _max: 10, _window_seconds: 600 }),
    ]);
    if (ipOk === false || userOk === false) return json({ error: 'rate_limited' }, 429);

    let email: string | null = null;
    for (const candidate of [`@${bare}`, bare]) {
      const { data } = await svc.rpc('get_email_by_username', { p_username: candidate });
      if (data) { email = data as string; break; }
    }
    if (!email) return json(FAIL, 401);

    const anon = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error || !data?.session) {
      const msg = String(error?.message || '');
      if (/email not confirmed/i.test(msg)) return json({ error: 'email_not_confirmed' }, 401);
      return json(FAIL, 401);
    }
    return json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (_e) {
    return json({ error: 'server_error' }, 500);
  }
});
