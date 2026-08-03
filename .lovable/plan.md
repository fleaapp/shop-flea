# Lock listings once they are sold

You are right - a buyer should never be refunded just because a seller tidied up their listings. The fix is to stop the deletion, not to compensate for it.

## What I found (verified)

- Sellers can permanently delete their own listing rows at any time, including listings with live orders.
- The link from orders to listings is set to "cascade delete". So deleting a sold listing **deletes the order records with it** - the buyer's purchase, tracking, messages and refund history disappear. This is worse than the audit described.
- The status rules already lock a listing once it is `sold`, `removed`, `blocked` or `refunded`, so status changes are safe. Only hard deletion is unguarded.
- The in-app "Delete" button on a listing does a soft remove (sets status to `removed`), so the risk is the raw delete path, not the normal UI action.

## The rule to enforce

A listing can only be permanently deleted when it has **no orders at all**. If it has any order, deletion is blocked forever - order history must stay intact for receipts, disputes, tax and admin review. Sellers can still hide or remove the listing from view; the record simply stays.

For active (unsold) listings nothing changes - remove works exactly as today.

## Changes

1. **Stop the cascade.** Change the order-to-listing link so deleting a listing can never delete orders.
2. **Block the delete.** Add a database guard that rejects deletion of any listing that has orders attached, with a clear message.
3. **Tighten permissions.** Restrict the seller delete rule so it only applies to listings with no orders.
4. **Clear message in the app.** When a seller tries to delete a sold listing, show: "This item has been sold, so it can't be deleted. You can hide it instead." Keep the hide/remove option available.
5. **Admin.** Admin delete in the Listings screen already soft-deletes to the "Deleted" tab - keep that behaviour and surface the same message if a hard delete is attempted.

## Technical notes

- Migration: `ALTER TABLE public.orders DROP CONSTRAINT orders_listing_id_fkey`, re-add with `ON DELETE RESTRICT`.
- Add `listings_delete_guard()` BEFORE DELETE trigger raising an exception when `EXISTS (SELECT 1 FROM public.orders WHERE listing_id = OLD.id)`.
- Replace the `Users can delete their own listings` policy with a `USING` clause that adds `NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.listing_id = id)`.
- Frontend: in `src/pages/ListingDetails.tsx`, keep the soft `status = 'removed'` update and add error handling/copy for a blocked hard delete.
- No change to refund logic - the audit item about refunding on deletion becomes unnecessary once deletion is impossible.
