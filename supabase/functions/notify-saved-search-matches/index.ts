import 'https://deno.land/x/xhr@0.1.0/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('EXTERNAL_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY =
  Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PUBLISHABLE_KEY =
  Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;

interface SavedSearchRow {
  id: string;
  user_id: string;
  query: string;
  filters: Record<string, any>;
  region_id: string | null;
  last_notified_at: string;
}

const matchesQuery = (listing: any, q: string) => {
  const needle = q.toLowerCase().trim();
  if (!needle) return false;
  const hay = [
    listing.title,
    listing.brand,
    listing.category,
    listing.subcategory,
    ...(listing.tags || []),
  ]
    .filter(Boolean)
    .map((s: string) => String(s).toLowerCase())
    .join(' ');
  return hay.includes(needle);
};

const matchesFilters = (listing: any, f: Record<string, any>) => {
  if (!f) return true;
  if (f.sizes?.length && !f.sizes.includes(listing.size)) return false;
  if (f.categories?.length && !f.categories.includes(listing.category)) return false;
  if (f.genders?.length && !f.genders.includes(listing.gender)) return false;
  if (f.condition && listing.condition !== f.condition) return false;
  if (f.brands?.length && !f.brands.includes(listing.brand)) return false;
  if (typeof f.minPrice === 'number' && Number(listing.price) < f.minPrice) return false;
  if (typeof f.maxPrice === 'number' && Number(listing.price) > f.maxPrice) return false;
  return true;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { data: searches, error } = await admin
      .from('saved_searches')
      .select('id, user_id, query, filters, region_id, last_notified_at');
    if (error) throw error;

    let totalNotified = 0;
    const now = new Date().toISOString();

    for (const s of (searches || []) as SavedSearchRow[]) {
      // Find new active listings since last_notified_at, region-matched
      let q = admin
        .from('listings')
        .select('id, title, brand, category, subcategory, size, gender, condition, price, tags, user_id, region_id, created_at')
        .eq('status', 'active')
        .gt('created_at', s.last_notified_at)
        .neq('user_id', s.user_id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (s.region_id) q = q.eq('region_id', s.region_id);

      const { data: listings } = await q;
      if (!listings?.length) continue;

      const matches = listings.filter(
        (l) => matchesQuery(l, s.query) && matchesFilters(l, s.filters || {})
      );
      if (!matches.length) {
        // Still bump the cursor so we don't re-scan old rows
        await admin
          .from('saved_searches')
          .update({ last_notified_at: now })
          .eq('id', s.id);
        continue;
      }

      const top = matches[0];
      const extra = matches.length - 1;
      const message =
        extra > 0
          ? `🔔 New match for "${s.query}": ${top.title} and ${extra} more. Tap to view.`
          : `🔔 New match for "${s.query}": ${top.title}. Tap to view.`;

      await admin.from('notifications').insert({
        user_id: s.user_id,
        type: 'saved_search_match',
        title: 'New match for saved search',
        message,
        related_listing_id: top.id,
      });

      // Push notification
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            user_id: s.user_id,
            notification: {
              type: 'saved_search_match',
              title: 'New match for saved search',
              message,
              related_listing_id: top.id,
            },
          }),
        });
      } catch (pushErr) {
        console.error('Push send failed:', pushErr);
      }

      await admin
        .from('saved_searches')
        .update({ last_notified_at: now })
        .eq('id', s.id);

      totalNotified += 1;
    }

    return new Response(
      JSON.stringify({ ok: true, notified: totalNotified }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('notify-saved-search-matches error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
