Plan:

1. Point all brand reads and writes at the same source of truth
- Update the user-facing brand hook so autocomplete, filters, and listing creation read brands from the external app database, not the separate Cloud-generated client.
- Update the add-brand function so user-created brands are inserted into that same brand table that admin management uses.

2. Fix admin brand editing and deletion
- Keep Admin Brand Management using the admin backend function, but harden update/delete so it reliably edits the external brands table with admin privileges.
- Patch the brand update guard on the real app database if it is still blocking admin renames.
- Make delete remove the brand from autocomplete/admin lists without relisting or changing old listing records.

3. Improve admin brand management UX only where needed
- Show user-added brands in the admin list immediately after refresh.
- Keep search, rename, delete, usage count, and loading/error states consistent with the existing simple settings-style admin UI.
- Use clear errors if a brand cannot be renamed because of a duplicate or invalid name.

4. Validate the flow
- Test adding a new brand as a user.
- Confirm it appears in Brand Management.
- Confirm admin rename updates what users see in autocomplete/filter lists.
- Confirm admin delete removes it from selectable brands.

Technical notes:
- The likely issue is split data paths: user brand code is using the Cloud client/table, while admin brand management is using the external app database via admin-data.
- The fix will consolidate brand operations to the external app database and keep admin operations server-side.