import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type ListingRow = {
  id: string;
  user_id: string;
  status: string | null;
};

type ProfileRow = {
  user_id: string;
  status: string | null;
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

    const externalUrl = Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '';
    const externalAnonKey = Deno.env.get('EXTERNAL_SUPABASE_ANON_KEY') ?? '';
    const externalServiceRoleKey = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!externalUrl || !externalAnonKey || !externalServiceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(externalUrl, externalAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(externalUrl, externalServiceRoleKey);

    const [favoritesResponse, cartResponse] = await Promise.all([
      adminClient
        .from('favorites')
        .select('listing_id')
        .eq('user_id', user.id),
      adminClient
        .from('cart_items')
        .select('listing_id')
        .eq('user_id', user.id),
    ]);

    if (favoritesResponse.error || cartResponse.error) {
      console.error('Failed to fetch user saved listing ids', {
        favoritesError: favoritesResponse.error,
        cartError: cartResponse.error,
      });
      return new Response(JSON.stringify({ error: 'Failed to load saved items' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const savedListingIds = [
      ...(favoritesResponse.data ?? []).map((row) => row.listing_id),
      ...(cartResponse.data ?? []).map((row) => row.listing_id),
    ];

    const uniqueListingIds = Array.from(new Set(savedListingIds));

    if (uniqueListingIds.length === 0) {
      return new Response(JSON.stringify({ success: true, removedCount: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: listingsData, error: listingsError } = await adminClient
      .from('listings')
      .select('id, user_id, status')
      .in('id', uniqueListingIds);

    if (listingsError) {
      console.error('Failed to fetch listings for stale cleanup', listingsError);
      return new Response(JSON.stringify({ error: 'Failed to load listings' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const listings = (listingsData ?? []) as ListingRow[];
    const listingMap = new Map(listings.map((listing) => [listing.id, listing]));

    const uniqueSellerIds = Array.from(new Set(listings.map((listing) => listing.user_id)));

    const { data: profilesData, error: profilesError } = uniqueSellerIds.length
      ? await adminClient
          .from('profiles')
          .select('user_id, status')
          .in('user_id', uniqueSellerIds)
      : { data: [], error: null };

    if (profilesError) {
      console.error('Failed to fetch profiles for stale cleanup', profilesError);
      return new Response(JSON.stringify({ error: 'Failed to load seller profiles' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const profileMap = new Map(
      ((profilesData ?? []) as ProfileRow[]).map((profile) => [profile.user_id, profile]),
    );

    const isInvalidListing = (listingId: string) => {
      const listing = listingMap.get(listingId);

      if (!listing) return true; // listing row removed

      const status = listing.status ?? '';
      if (status !== 'active' && status !== 'sold') return true;

      const sellerProfile = profileMap.get(listing.user_id);
      if (!sellerProfile) return true; // deleted profile
      if (sellerProfile.status === 'blocked') return true;

      return false;
    };

    const invalidListingIds = uniqueListingIds.filter(isInvalidListing);

    if (invalidListingIds.length === 0) {
      return new Response(JSON.stringify({ success: true, removedCount: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const [favoritesDelete, cartDelete, discardedDelete] = await Promise.all([
      adminClient
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .in('listing_id', invalidListingIds),
      adminClient
        .from('cart_items')
        .delete()
        .eq('user_id', user.id)
        .in('listing_id', invalidListingIds),
      adminClient
        .from('discarded_listings')
        .delete()
        .eq('user_id', user.id)
        .in('listing_id', invalidListingIds),
    ]);

    if (favoritesDelete.error || cartDelete.error || discardedDelete.error) {
      console.error('Failed to delete stale rows', {
        favoritesDeleteError: favoritesDelete.error,
        cartDeleteError: cartDelete.error,
        discardedDeleteError: discardedDelete.error,
      });
      return new Response(JSON.stringify({ error: 'Failed to purge stale saved items' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({ success: true, removedCount: invalidListingIds.length }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Unexpected cleanup-stale-saved-listings error:', error);
    return new Response(JSON.stringify({ error: 'Unexpected error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
