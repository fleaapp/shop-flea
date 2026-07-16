Plan:

1. Fix admin listing terminology
- Rename the `removed` status everywhere in Listings Management UI to `Deleted`.
- Keep the database value as `removed` unless a schema change is truly needed, so existing data and actions remain compatible.
- Update the delete/remove confirmation copy to say deleted listings are preserved for admin history.

2. Keep refunded and deleted as separate states
- Refunded listings will use status `refunded` and appear under the `Refunded` filter.
- Seller or admin deleted listings will use status `removed` but be displayed as `Deleted` and appear under the `Deleted` filter.
- Update listing header counts to show Active, Sold, Refunded, and Deleted separately.

3. Restore refund/dispute visibility for previously deleted refunded listings
- Update the admin refund/dispute backend so refund rows still show listing details even when a listing was previously deleted or missing from the normal listings query.
- If a refunded order references an existing listing, ensure that listing is marked `refunded`, not `removed`.
- For any previously affected deleted refunded listing rows that still exist with the wrong status, update them from `removed` to `refunded`.

4. Fix the admin data source behavior
- Make `listRefunds` fetch listing details for refunded orders regardless of listing status.
- Add a fallback display for missing listing records so Refunds & disputes does not lose the order, buyer, seller, price, refund date, or reason if the listing row cannot be recovered.

5. Deploy and verify
- Deploy the updated admin/refund functions.
- Verify that:
  - Refunds & disputes shows refunded sales and their listing details.
  - Listings Management has a Refunded filter for refunded sales.
  - Listings Management has a Deleted filter for admin/seller deleted items.
  - Deleted does not contain refunded listings unless they were actually deleted and not tied to a refund.