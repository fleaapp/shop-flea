# Speed up posting comments

## Problem
Posting a comment currently calls the `add-listing-comment` edge function. A cold start adds a multi-second delay before the input clears and the new comment appears, so users assume the button didn't work and often tap again.

## Fix
Same approach used for chat messages: post directly to the database and give the composer instant feedback.

### `src/components/ListingComments.tsx`
- Replace the `invokeCloudFunction('add-listing-comment', …)` call inside the `addComment` mutation with a direct `supabase.from('listing_comments').insert({ listing_id, user_id, parent_id, content })`. RLS already allows this (`INSERT` policy: `auth.uid() = user_id`), and the existing update guard, report trigger, and mention notifier all run on the DB side.
- Keep the client-side `checkCommentContent` moderation and the `isBlocked` gate exactly as-is (both run before the insert).
- Keep the fire-and-forget `comment-mentions` edge call for @mention notifications.
- Move the composer reset (`setNewComment('')`, `setReplyingTo(null)`) to fire the moment the mutation starts (via `onMutate`) so the input clears immediately — the user sees the button "worked" even while the insert round-trips.
- On error, restore the draft text so nothing is lost, and surface the toast as today.
- After `onSuccess`, keep the existing `invalidateQueries` for `listing-comments` and `listing-comments-count`.

### Not changing
- The `add-listing-comment` edge function itself (leave deployed; nothing else calls it, but removing it is out of scope for this UX fix).
- Query/threading logic, moderation, reporting, deletion, or notifications.
- Comment ordering — the refetch after insert will place the new row correctly.

## Validation
- Typecheck.
- Manually: post a top-level comment and a reply; confirm the composer clears instantly and the comment appears within a moment; confirm mention notifications still fire; confirm blocked users still see the restriction toast.
