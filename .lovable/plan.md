## Plan

1. **Make order chats feel instant**
   - Optimistically add the sender’s message to the chat before the backend response returns.
   - Avoid the immediate extra refetch after sending when the inserted message is already returned.
   - Update realtime handling to merge new messages into the existing chat instead of invalidating/refetching the whole thread every time.
   - Keep a slow fallback refresh only for missed realtime events.

2. **Reduce backend chat latency**
   - Remove noisy per-request `console.log` statements from `order-messages`.
   - Ensure notification creation/push work cannot delay the message send response.
   - Keep actual failures logged, but stop logging normal request lifecycle events.

3. **Make read receipts clear badges faster**
   - After opening an order chat, mark unread messages read and immediately invalidate the order-message/nav badge queries.
   - Avoid repeated PATCH calls for the same already-cleared message set.

4. **Stop error logs recording normal actions/warnings**
   - Tighten the `log-error` function so only `error` and `critical` severity are stored by default.
   - Drop or ignore `warning` entries unless explicitly needed for a true failure path.
   - Remove admin error-log polling side effects from creating more console noise.

5. **Validate**
   - Check the chat path loads and sends without extra refetch loops.
   - Confirm admin error logs show actual failures only, not notification warnings or normal actions.