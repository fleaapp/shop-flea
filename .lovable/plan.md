## Plan

1. Convert admin detail popups to drawers
   - Replace the Listing Management detail dialog with the existing bottom drawer component.
   - Replace the User Management detail dialog with the same drawer pattern.
   - Keep the admin menu unchanged.

2. Improve Listing Management detail UI
   - Remove the heavy grid of small detail cards for brand, size, category, condition and related metadata.
   - Show those details as horizontally scrollable rounded bubbles, matching the listing details card style.
   - Keep the seller card, image grid, stats and action buttons, but make them fit cleanly in the drawer on mobile.

3. Fix refunded listings missing from Listing Management
   - Update the admin listings backend query so the Refunded filter includes:
     - listings with status `refunded`,
     - listings referenced by refunded orders,
     - refunded orders whose original listing row was hard-deleted.
   - For hard-deleted refunded listings, return a preserved admin-only fallback row using the order data so it can still appear in Listing Management and Refunds/Disputes.
   - Mark order-linked refunded listings as refunded in the admin response even if the listing status is `removed` or another legacy state.

4. Fix counts and labels
   - Count refunded listings using both listing status and refunded-order metadata.
   - Keep `removed` displayed as `Deleted`, as previously requested.

## Technical notes

- Files to update:
  - `src/pages/admin/AdminListings.tsx`
  - `src/pages/admin/AdminUsers.tsx`
  - `src/hooks/admin/useAdminListings.ts`
  - `supabase/functions/admin-data/index.ts`
- No admin menu changes.
- No public buyer or seller UI changes.