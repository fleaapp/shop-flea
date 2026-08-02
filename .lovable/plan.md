## Add 🛒 / 💌 count badges to all listing cards

### What I found first

The badges on the listing detail drawer count rows in `cart_items` and `favorites` for that listing. But both tables have RLS `SELECT` policies of `auth.uid() = user_id`, so those count queries only ever see **your own** rows. Today the badge can only ever show 0 or 1, and only reflects you - not "3 people have this in their cart". So this needs fixing at the data layer before spreading it to four more surfaces.

### 1. Data layer (new)

Add a security-definer RPC returning true public counts for a batch of listings:

```sql
get_listing_engagement_counts(_listing_ids uuid[])
  -> table(listing_id uuid, cart_count int, wishlist_count int)
```

Security definer, `set search_path = public`, `grant execute to authenticated` (and `anon` so guest browsing sees badges). Only aggregate counts are exposed, never who saved the item. Input array capped at ~100 ids per call.

New hook `src/hooks/useListingEngagementCounts.ts` - takes listing ids, calls the RPC via React Query, returns a `Map<listingId, {cart, wishlist}>` with a short stale time.

### 2. Shared badge component

`src/components/EngagementBadges.tsx` - extracts the markup currently inline in `ListingDetails.tsx` (vertical stack, 🛒 / 💌 in a `bg-background/70 backdrop-blur-sm` circle with the number chip beneath). Two sizes: `lg` for the detail drawer and swipe cards, `sm` for grid cards. Renders nothing when both counts are 0.

**Display cap:** any count above 99 renders as `99+`, on every surface including the detail drawer.

### 3. Surfaces

| Surface | File | Placement |
|---|---|---|
| Detail drawer | `src/pages/ListingDetails.tsx` | Replace inline markup with the shared component, switch to the RPC |
| Home card stack | `src/components/SwipeCard.tsx` | `absolute top-3 left-3`, size `lg`, pointer-events-none so it never blocks a swipe |
| User profile grid | `src/components/ProfileGridCard.tsx` | `absolute top-1.5 left-1.5`, size `sm` (edit ✏️ button is on the right, no clash) |
| Seller profile grid | same component | inherited |
| Wishlist grid | `src/components/WishlistGridCard.tsx` | The ❌ remove button sits at `top-1.5 left-1.5`, so badges go below it |
| Wishlist list card | `src/components/WishlistCard.tsx` | Same - badges below the ❌ button (`top-14 left-2`), size `sm` |

Ids are batched per screen: `Index.tsx` for the visible stack, `Profile.tsx` / `SellerProfile.tsx` for the visible tab, `Favorites.tsx` for the wishlist. One RPC round-trip per screen, not one per card.

### 4. Your question on maximums

- **Cart:** a server-side cap of **50 items** exists in `stripe-connect-payment-intent`, enforced only at checkout. No client-side cap and no warning while adding, so a user can add a 51st item and only hit the wall at payment.
- **Wishlist:** no maximum at all, client or server.

Not in scope for this change - tell me if you want `CartContext.addToCart` to block at 50 with a toast, and a wishlist cap added.

### Technical notes

- The RPC is the only new database object; no table or column changes.
- Counts include all users' rows; no filtering of the seller's own row (rare and harmless).
- Badges are display-only and read from one source, so the drawer and the card can never disagree.
