// Called after a Google/Apple OAuth sign-in completes. Checks if the
// just-authenticated user is a duplicate of an older account with the same
// email but a different provider. If so, deletes the new user and returns
// the original provider so the client can redirect.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXTERNAL_URL = Deno.env.get('EXTERNAL_SUPABASE_URL')!;
const EXTERNAL_ANON_KEY = Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY')!;
const SERVICE_KEY = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!;

type Provider = 'email' | 'google' | 'apple';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cryptographically verify the JWT via the external Supabase auth server.
    const verifier = createClient(EXTERNAL_URL, EXTERNAL_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: verifyErr } = await verifier.auth.getUser(token);
    const currentUserId = userData?.user?.id;
    if (verifyErr || !currentUserId) {
      return new Response(JSON.stringify({ error: 'invalid_token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the current user via admin API
    const meRes = await fetch(`${EXTERNAL_URL}/auth/v1/admin/users/${currentUserId}`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!meRes.ok) {
      return new Response(JSON.stringify({ conflict: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const me = await meRes.json();
    const email: string | undefined = me?.email?.toLowerCase();
    const myProvider: Provider =
      me?.app_metadata?.provider === 'google'
        ? 'google'
        : me?.app_metadata?.provider === 'apple'
          ? 'apple'
          : 'email';
    if (!email) {
      return new Response(JSON.stringify({ conflict: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // List all users with this email
    const listRes = await fetch(
      `${EXTERNAL_URL}/auth/v1/admin/users?filter=email.eq.${encodeURIComponent(email)}`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
    );
    if (!listRes.ok) {
      return new Response(JSON.stringify({ conflict: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const list = await listRes.json();
    const users: any[] = Array.isArray(list?.users) ? list.users : [];
    const matches = users.filter(
      (u) => typeof u?.email === 'string' && u.email.toLowerCase() === email,
    );

    if (matches.length < 2) {
      return new Response(JSON.stringify({ conflict: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the oldest record — that's the "original" account we keep.
    matches.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const original = matches[0];

    // If the current user IS the original, no conflict (the dup is someone else's problem).
    if (original.id === currentUserId) {
      return new Response(JSON.stringify({ conflict: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const originalProvider: Provider =
      original?.app_metadata?.provider === 'google'
        ? 'google'
        : original?.app_metadata?.provider === 'apple'
          ? 'apple'
          : 'email';

    // Same provider — shouldn't usually happen (Supabase would merge). Treat as no conflict.
    if (originalProvider === myProvider) {
      return new Response(JSON.stringify({ conflict: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Safety: only delete the current user if it was created very recently
    // (within the last 5 minutes) to avoid nuking established accounts.
    const ageMs = Date.now() - new Date(me.created_at).getTime();
    if (ageMs > 5 * 60 * 1000) {
      // Not safe to auto-delete; just report the conflict.
      return new Response(
        JSON.stringify({ conflict: true, provider: originalProvider, deleted: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Delete the duplicate (current user)
    const delRes = await fetch(`${EXTERNAL_URL}/auth/v1/admin/users/${currentUserId}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });

    return new Response(
      JSON.stringify({
        conflict: true,
        provider: originalProvider,
        deleted: delRes.ok,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('resolve-oauth-conflict error:', err);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
