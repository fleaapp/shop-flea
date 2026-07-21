## Problem confirmed

The backend currently has multiple duplicate notification paths active at the same time:

- The same sale notification exists 4 times for one order.
- The `orders` table has several duplicate `AFTER INSERT` triggers that call the same sold-notification function.
- The checkout finalization function also inserts sold notifications itself, so it overlaps with the database triggers.
- The `notifications` table has 4 push triggers, so a single notification row can fan out to multiple push attempts.

## Fix plan

1. **Stop duplicate notification creation**
   - Keep one authoritative sold-notification path only.
   - Remove duplicate `orders` triggers for sold notifications and listing-sold updates.
   - Update checkout finalization so it does not create the same seller notification again if the trigger is the chosen source, or disable the trigger and keep finalization as the only source.

2. **Stop duplicate push delivery**
   - Keep exactly one `notifications` push trigger.
   - Drop the extra push triggers currently attached to `notifications`.
   - Remove direct push sends where they duplicate the insert-trigger push path.

3. **Add database-level duplicate protection**
   - Add a partial unique index so the same user cannot receive the same notification for the same order/listing/type more than once.
   - Use conflict-safe inserts where needed so retries do not create repeated alerts.

4. **Clean existing duplicates**
   - Keep the oldest notification for each duplicate group.
   - Delete the extra duplicates already visible in Alerts.

5. **Verify**
   - Query the trigger list again and confirm only one notification/push trigger remains per event.
   - Query duplicate notification groups and confirm none remain.

## Technical details

The migration will target `public.orders` and `public.notifications` triggers only, plus a dedupe cleanup on `public.notifications`. No UI redesign is needed.