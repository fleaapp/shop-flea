# Seller and admin listing deletion (soft delete, history preserved)

## What exists today

- Sellers can only delete listings that have never been ordered. A database rule blocks deleting any listing with an order, and a second rule blocks changing the status of a listing once it is `sold`, `removed` or `refunded`. So a completed or refunded sale is permanently pinned to the seller's Sold tab.
- Admin "Delete" on a listing currently hard-deletes the listing **and** its orders, order messages, comments and notifications. That contradicts the requirement to keep the information stored.

## What will change

### 1. Sellers can remove finished sales from their profile

- Add a "Delete" action on the seller's own Sold tab cards (long-press / overflow menu, matching the existing card actions and confirmation dialog style).
- The action is only offered when that sale is finished: order status `completed`, `refunded`, or `cancelled`. Awaiting/shipped/disputed sales cannot be removed and show a short explanation instead.
- "Sold elsewhere" listings (marked sold with no order) can always be removed.
- Removing is a hide, not a wipe: the listing row, the order, payouts, receipts, messages and reviews all stay in the database and stay visible to the buyer and to admin. It only disappears from the seller's profile and from public seller profiles.

### 2. Admin can delete any listing, at any status, without losing data

- Admin "Delete" switches from hard-delete to a soft delete: the listing is flagged as removed and drops out of every public surface, but the listing row, its orders, messages and history are kept and remain visible under the admin Deleted filter and in Transactions.
- Works for active, sold, completed and refunded listings alike.
- Existing behaviour is kept for listings with a live (`awaiting`/`shipped`) order: buyer and seller still get the cancellation notification, and the order is refunded rather than deleted.

## Technical details

Database migration:

- `orders.seller_hidden_at timestamptz` and `listings.seller_hidden_at timestamptz`.
- `listings.admin_removed_at timestamptz` (or reuse `status = 'removed'` where the current status allows it; the timestamp column is needed because sold/refunded listings cannot change status).
- Security-definer RPC `seller_hide_sale(p_order_id uuid)` - asserts `auth.uid() = seller_id` and `status in ('completed','refunded','cancelled')`, then stamps `orders.seller_hidden_at`.
- Security-definer RPC `seller_hide_sold_listing(p_listing_id uuid)` - asserts ownership and that no unfinished order references the listing, then stamps `listings.seller_hidden_at`.
- No change to the delete guard or update guard; nothing is actually deleted, so order history, payouts and reviews are untouched.

Frontend:

- `src/hooks/useListings.ts` (`useUserListings`): filter out orders with `seller_hidden_at` and listings with `seller_hidden_at` in the sold branch; same filter in `src/pages/SellerProfile.tsx` for public profiles.
- `src/pages/Profile.tsx`: delete affordance on Sold cards plus the standard confirmation dialog (`max-w-[320px]`, `rounded-2xl`, flex-row footer).
- Public feed/search already filter on status, so admin-removed listings drop out via the removed flag; `admin_removed_at` is added to the same visibility helper (`isHiddenFromProfile`).

Backend:

- `supabase/functions/admin-data/index.ts`: replace `deleteListingAndOrders` with a soft-remove path - stamp `admin_removed_at`, set status to `removed` when the guard permits, keep orders/messages/comments, and clear only cart/favourite/discard rows so nobody can buy it.
- Admin listings query keeps counting these under the Deleted chip.

## Launch readiness

Short answer: the audit items are done, but I would not call it launch ready until the money and delivery paths have been exercised end to end on a real device. Current state:

- Fixed from the audit: navigation dead-ends, coupon reuse, refund self-approval, seller financial data leakage, coupon identity verification, cron authentication, payout/dispute webhook handling, carrier validation, accessibility labels and touch targets, notification copy.
- Not yet verified by a real run: a full purchase on Apple Pay and card in production mode, a real carrier tracking scan through to fund release, a real dispute through Stripe, and push delivery on a TestFlight build.

I can produce a short pre-launch checklist covering those live-path checks after this change lands, if useful.
