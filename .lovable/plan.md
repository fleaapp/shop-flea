## Fix account deletion blocked by refunded orders

**Root cause (confirmed):** `src/pages/EditProfile.tsx` line 107-116 client-side check queries orders with `.not('status', 'eq', 'delivered')` — so refunded orders count as "outstanding" and set `deleteBlockReason = 'Complete all orders first'`. The server (`supabase/functions/delete-account/index.ts` line 69) already correctly excludes both `delivered` and `refunded`, but the UI blocks the tap before it ever hits the server.

### Change
In `src/pages/EditProfile.tsx`, update the outstanding-orders query to exclude both `delivered` and `refunded` statuses, matching the edge function:

```ts
.not('status', 'in', '(delivered,refunded)');
```

That's the only change needed — @sarahhearn2's refunded order will then no longer block deletion.