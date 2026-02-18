import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const externalProjectRef = externalUrl.replace('https://', '').split('.')[0];

    console.log(`[add-stripe-columns] Adding Stripe columns to external project: ${externalProjectRef}`);

    // Use Supabase Management API to execute SQL on the external project
    // This requires calling the Supabase platform API with the service role key
    // Alternative: use the pg REST endpoint available via the Supabase REST API

    // Supabase exposes a /pg endpoint for direct SQL execution with service role
    const sqlStatements = [
      `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;`,
      `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;`,
      `NOTIFY pgrst, 'reload schema';`,
    ];

    const results = [];

    for (const sql of sqlStatements) {
      // Use the Supabase REST API's pg endpoint
      const response = await fetch(`${externalUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.log(`[add-stripe-columns] exec_sql not available: ${response.status} ${text}`);
        // Try alternative approach via the Supabase management API
        break;
      }

      results.push({ sql: sql.substring(0, 50), success: true });
    }

    // Primary method: use the Supabase pg API (available on all projects)
    // POST to /pg/query with service role
    const pgResponse = await fetch(`${externalUrl}/pg/query`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
          ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;
          NOTIFY pgrst, 'reload schema';
        `,
      }),
    });

    const pgText = await pgResponse.text();
    console.log(`[add-stripe-columns] /pg/query response: ${pgResponse.status} ${pgText}`);

    if (pgResponse.ok) {
      return new Response(
        JSON.stringify({ success: true, message: 'Columns added and schema cache reloaded.' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // If /pg/query fails, try the Supabase database API
    const dbApiResponse = await fetch(`${externalUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
    });

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Could not add columns automatically. Manual SQL needed.',
        sql: [
          'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;',
          "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;",
          "NOTIFY pgrst, 'reload schema';",
        ],
        pgQueryStatus: pgResponse.status,
        pgQueryBody: pgText,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error('[add-stripe-columns] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
