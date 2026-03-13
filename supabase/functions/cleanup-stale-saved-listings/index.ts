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

type ValidationRequestBody = {
  listingIds?: string[];
  performCleanup?: boolean;
};

type SellerProfileRow = Record<string, unknown>;

const removedSellerStatuses = new Set(['blocked', 'deleted', 'removed']);

const isRemovedSellerStatus = (status: unknown): boolean => {
  if (typeof status !== 'string') return false;
  return removedSellerStatuses.has(status.trim().toLowerCase());
};

const toUniqueIds = (ids: unknown): string[] => {
  if (!Array.isArray(ids)) return [];

  const unique = new Set<string>();
  for (const value of ids) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    unique.add(trimmed);
  }

  return Array.from(unique);
};

const parseBody = async (req: Request): Promise<ValidationRequestBody> => {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') return {};
    return body as ValidationRequestBody;
  } catch {
    return {};
  }
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

    const body = await parseBody(req);
    const requestedListingIds = toUniqueIds(body.listingIds);
    const shouldPerformCleanup = body.performCleanup !== false;

    const adminClient = createClient(externalUrl, externalServiceRoleKey);

    const uniqueListingIds = requestedListingIds.length > 0
      ? requestedListingIds
      : await (async () => {
          const [favoritesResponse, cartResponse] = await Promise.all([
            adminClient.from('favorites').select('listing_id').eq('user_id', user.id),
            adminClient.from('cart_items').select('listing_id').eq('user_id', user.id),
          ]);

          if (favoritesResponse.error || cartResponse.error) {
            console.error('Failed to fetch user saved listing ids', {
              favoritesError: favoritesResponse.error,
              cartError: cartResponse.error,
            });
            throw new Error('FAILED_TO_LOAD_SAVED_ITEMS');
          }

          const savedListingIds = [
            ...(favoritesResponse.data ?? []).map((row) => row.listing_id),
            ...(cartResponse.data ?? []).map((row) => row.listing_id),
          ];

          return Array.from(new Set(savedListingIds));
        })();

    if (uniqueListingIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, removedCount: 0, invalidListingIds: [] }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
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

    const { data: purchasedOrdersData, error: purchasedOrdersError } = await adminClient
      .from('orders')
      .select('listing_id')
      .eq('buyer_id', user.id)
      .in('listing_id', uniqueListingIds);

    if (purchasedOrdersError) {
      console.error('Failed to fetch purchased listings for stale cleanup', purchasedOrdersError);
    }

    const purchasedListingIds = new Set(
      (purchasedOrdersData ?? []).map((order) => String(order.listing_id)),
    );

    let existingSellerIds = new Set<string>();
    let sellerStatusById = new Map<string, string | null>();

    if (uniqueSellerIds.length > 0) {
      const { data: profilesData, error: profilesError } = await adminClient
        .from('profiles')
        .select('*')
        .in('user_id', uniqueSellerIds);

      if (profilesError) {
        console.error('Failed to fetch profiles for stale cleanup', profilesError);
        return new Response(JSON.stringify({ error: 'Failed to load seller profiles' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const normalizedProfiles = (profilesData ?? [])
        .map((profile) => {
          const row = profile as SellerProfileRow;
          const userId = typeof row.user_id === 'string' ? row.user_id : '';
          const status = typeof row.status === 'string' ? row.status : null;
          return { userId, status };
        })
        .filter((profile) => profile.userId);

      existingSellerIds = new Set(normalizedProfiles.map((profile) => profile.userId));
      sellerStatusById = new Map(
        normalizedProfiles.map((profile) => [profile.userId, profile.status]),
      );
    }

    const invalidListingIds = uniqueListingIds.filter((listingId) => {
      const listing = listingMap.get(listingId);
      if (!listing) return true;

      // Keep purchased items accessible for the buyer, even if seller account was removed.
      if (purchasedListingIds.has(listingId)) return false;

      const listingStatus = listing.status ?? '';
      if (listingStatus !== 'active' && listingStatus !== 'sold') return true;

      if (!existingSellerIds.has(listing.user_id)) return true;

      return isRemovedSellerStatus(sellerStatusById.get(listing.user_id));
    });

    if (invalidListingIds.length === 0 || !shouldPerformCleanup) {
      return new Response(
        JSON.stringify({ success: true, removedCount: 0, invalidListingIds }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
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
      JSON.stringify({ success: true, removedCount: invalidListingIds.length, invalidListingIds }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'FAILED_TO_LOAD_SAVED_ITEMS') {
      return new Response(JSON.stringify({ error: 'Failed to load saved items' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.error('Unexpected cleanup-stale-saved-listings error:', error);
    return new Response(JSON.stringify({ error: 'Unexpected error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
