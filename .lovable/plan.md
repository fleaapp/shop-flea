## What's happening

Confirmed in the database: the "Jacket" (`a883400b…`) and "Denim" (`2891a653…`) listings both have `status = 'active'`, while their orders are `status = 'refunded'` with `refund_reason = 'auto_unshipped_8d'`.

Root cause: the 8-day auto-refund job (`supabase/functions/auto-refund-unshipped/index.ts`, line ~294) explicitly sets the listing back to `status: "active"` after refunding, with the comment "Reactivate the listing so it's not stuck as sold". That contradicts the manual refund path (`stripe-connect-refund`), which marks listings `status: 'refunded'`.

Result: the listing shows in the seller's active Listings tab, appears in the Home feed, and is purchasable again — while the refunded order still shows it under Sold.

## Fix

1. **Auto-refund job** - change the listing update in `auto-refund-unshipped` from `status: "active"` to `status: "refunded"`, matching the manual refund path. Update the stale comment.
2. **Data backfill** - migration to set `status = 'refunded'` on any listing whose orders are all refunded but whose listing status is still `active` (covers the two current items and any other stragglers).
3. **Verify surfaces** - confirm the Home feed, search, listing detail, and cart/checkout paths all filter to `status = 'active'` so `refunded` listings are excluded everywhere, and that the seller's Sold tab still shows them (it reads from orders, so it will).
4. **Guard** - add a database-level check in the listing update guard so a listing tied to a refunded order can't flip back to `active` via any path (admin restore, edge function, or client).

## Note

If a seller ever wants to re-sell an auto-refunded item, they'd relist it fresh rather than the system silently putting it back on sale. Let me know if you'd instead prefer a "Relist" button on refunded listings, and I'll add that in the same pass.
