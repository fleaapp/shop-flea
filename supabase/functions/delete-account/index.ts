import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL')!;
    const externalAnonKey = Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY')!;

    const supabaseUser = createClient(
      externalUrl,
      externalAnonKey,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub;

    // Check for outstanding (non-delivered) orders
    const { count: outstandingCount } = await supabaseUser
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .not('status', 'eq', 'delivered');

    if ((outstandingCount ?? 0) > 0) {
      return new Response(JSON.stringify({ error: 'Complete all orders before deleting your account.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check 14-day cooldown after last delivery
    const { data: recentOrders } = await supabaseUser
      .from('orders')
      .select('delivered_at')
      .eq('seller_id', userId)
      .eq('status', 'delivered')
      .order('delivered_at', { ascending: false })
      .limit(1);

    if (recentOrders && recentOrders.length > 0) {
      const lastDelivery = new Date(recentOrders[0].delivered_at);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      if (lastDelivery > fourteenDaysAgo) {
        const daysRemaining = Math.ceil((lastDelivery.getTime() - fourteenDaysAgo.getTime()) / (1000 * 60 * 60 * 24));
        return new Response(JSON.stringify({ error: `Wait ${daysRemaining} more day(s) after your last delivery before deleting your account.` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Use service role key to perform privileged deletions
    const supabaseAdmin = createClient(
      externalUrl,
      Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Delete user data in order (profile will cascade or be cleaned up)
    await supabaseAdmin.from('discarded_listings').delete().eq('user_id', userId);
    await supabaseAdmin.from('favorites').delete().eq('user_id', userId);
    await supabaseAdmin.from('cart_items').delete().eq('user_id', userId);
    await supabaseAdmin.from('notifications').delete().eq('user_id', userId);
    await supabaseAdmin.from('listing_comments').delete().eq('user_id', userId);
    await supabaseAdmin.from('search_queries').delete().eq('user_id', userId);

    // Archive user's listings (hidden from app-wide discovery)
    const { error: archiveListingsError } = await supabaseAdmin
      .from('listings')
      .update({ status: 'archived' })
      .eq('user_id', userId);

    if (archiveListingsError) {
      console.error('Failed to archive user listings:', archiveListingsError);
      return new Response(JSON.stringify({ error: 'Failed to delete account. Please contact support.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Delete the profile
    await supabaseAdmin.from('profiles').delete().eq('user_id', userId);

    // Delete the auth user (this is the privileged call)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return new Response(JSON.stringify({ error: 'Failed to delete account. Please contact support.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Unexpected error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
