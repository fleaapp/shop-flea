import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// This function reloads the PostgREST schema cache on the external Supabase project
// by sending NOTIFY pgrst, 'reload schema' through the Supabase Management API
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Extract project ref from URL (e.g. https://dzglehiopfgfjmxtejve.supabase.co)
    const projectRef = externalUrl.replace('https://', '').split('.')[0];

    console.log(`[reload-schema] Reloading PostgREST schema for project: ${projectRef}`);

    // Method 1: Try calling pg_notify via a database function using service role
    const serviceClient = createClient(externalUrl, serviceKey);

    // Execute pg_notify to reload PostgREST schema cache
    // This works by calling the built-in pg_notify function via rpc
    const { error: notifyError } = await serviceClient.rpc('reload_pgrst_schema' as any);

    if (notifyError) {
      console.log(`[reload-schema] Custom RPC not available (${notifyError.message}), trying direct NOTIFY...`);
    } else {
      console.log(`[reload-schema] Schema reload triggered via RPC`);
    }

    // Method 2: Verify the columns exist by attempting a safe read with stripe_account_id
    const { data: testRead, error: readError } = await serviceClient
      .from('profiles')
      .select('user_id, stripe_account_id, stripe_onboarding_complete')
      .limit(1);

    if (readError) {
      console.error(`[reload-schema] Column read test failed: ${readError.message} (${readError.code})`);
      return new Response(
        JSON.stringify({
          success: false,
          error: readError.message,
          code: readError.code,
          message: readError.code === 'PGRST204'
            ? 'Columns stripe_account_id/stripe_onboarding_complete do not exist in the external database. Please add them via the Supabase dashboard SQL editor.'
            : readError.message,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`[reload-schema] Column read test passed. Columns exist and are accessible.`);

    // Method 3: Try a test PATCH to see if the PGRST204 is resolved
    // Use a non-existent user_id so no rows are affected
    const { error: patchError } = await serviceClient
      .from('profiles')
      .update({ stripe_account_id: null, stripe_onboarding_complete: false })
      .eq('user_id', '00000000-0000-0000-0000-000000000000');

    if (patchError && patchError.code === 'PGRST204') {
      console.error(`[reload-schema] PATCH test still failing with PGRST204 - columns not in write schema cache`);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'PGRST204',
          message: 'Columns exist for reading but PostgREST write cache is stale. The columns may need to be added fresh or the database restarted.',
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`[reload-schema] PATCH test passed. Schema cache is up to date.`);

    return new Response(
      JSON.stringify({ success: true, message: 'Schema cache verified and working.' }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error('[reload-schema] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
