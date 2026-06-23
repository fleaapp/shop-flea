// Looks up an email in auth.users via the external Supabase service role
// and returns which auth provider it was originally created with.
// Used by the client to prevent duplicate accounts across providers.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const EXTERNAL_URL = Deno.env.get('EXTERNAL_SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!;

type Provider = 'email' | 'google' | 'apple' | null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!rawEmail || rawEmail.length < 3 || rawEmail.length > 320 || !rawEmail.includes('@')) {
      return new Response(JSON.stringify({ error: 'invalid_email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Tight per-IP rate limit (5/min) to slow enumeration.
    const ip =
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';

    const callRl = async (key: string, max: number, windowSeconds: number) => {
      const r = await fetch(`${EXTERNAL_URL}/rest/v1/rpc/check_and_record_rate_limit`, {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ _key: key, _max: max, _window_seconds: windowSeconds }),
      });
      const allowed = await r.json().catch(() => true);
      return allowed !== false;
    };

    if (!(await callRl(`check_email_provider:ip:${ip}`, 5, 60))) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Per-email rate limit caps targeted enumeration of a specific account.
    if (!(await callRl(`check_email_provider:email:${rawEmail}`, 5, 3600))) {
      return new Response(JSON.stringify({ error: 'rate_limited' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    // Look up user via admin API (case-insensitive by Supabase default).
    // Use the listUsers admin endpoint with a filter.
    const lookupRes = await fetch(
      `${EXTERNAL_URL}/auth/v1/admin/users?filter=email.eq.${encodeURIComponent(rawEmail)}`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      },
    );

    let provider: Provider = null;
    if (lookupRes.ok) {
      const data = await lookupRes.json();
      const users = Array.isArray(data?.users) ? data.users : [];
      // Find exact case-insensitive match
      const match = users.find(
        (u: any) => typeof u?.email === 'string' && u.email.toLowerCase() === rawEmail,
      );
      if (match) {
        const p = match?.app_metadata?.provider;
        if (p === 'google' || p === 'apple') {
          provider = p;
        } else {
          provider = 'email';
        }
      }
    }

    return new Response(JSON.stringify({ provider }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('check-email-provider error:', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
