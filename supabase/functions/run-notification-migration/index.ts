import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '',
      Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Add new columns to notifications table
    const { error: alterError } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.notifications 
          ADD COLUMN IF NOT EXISTS related_order_id uuid,
          ADD COLUMN IF NOT EXISTS related_thread_id uuid;
      `
    });

    // If rpc doesn't work, try raw SQL via REST
    // The columns and triggers need to be added via direct SQL
    
    return new Response(JSON.stringify({ 
      ok: true, 
      note: 'Migration attempted. Columns and triggers may need manual setup on external DB.',
      alterError: alterError?.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
