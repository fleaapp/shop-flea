## Short answer

That specific error is PWA-only. It comes from saving a **web push** subscription (browser `PushManager` endpoint) into the `push_subscriptions` table. Native iOS uses APNs via Capacitor and writes to a different flow (device token), so this exact duplicate-key error won't hit the native build.

## What the error means

`duplicate key value violates unique constraint "push_subscriptions_user_id_endpoint_key"` means the code is doing a plain `insert` into `push_subscriptions` for a `(user_id, endpoint)` pair that already exists. The row is already there from a previous test in the same browser, so re-registering blows up instead of being a no-op.

## Should we fix it anyway?

Yes, small fix, worth doing:
- It's a real bug in the web push save path and will show every time a returning PWA user re-registers.
- Even though launch is native, PWA is the fastest way for you to test flows, and the toast is noisy/misleading.
- Fix is one line of SQL semantics: upsert instead of insert.

## Plan

1. Locate the web push save path (likely `src/hooks/useWebPushNotifications.ts` or similar, plus any edge function that writes to `push_subscriptions`) and confirm it's doing `.insert()` rather than `.upsert()`.
2. Change the write to `upsert` on conflict target `(user_id, endpoint)` with `updated_at = now()`, so re-subscribing is idempotent. No schema change needed — the unique constraint stays.
3. Swallow the "already subscribed" case silently instead of surfacing a red toast. Keep real errors (network, permission denied) visible.
4. Confirm the native push path (`useNativePushNotifications` / Capacitor `PushNotifications`) writes device tokens through its own upsert and is unaffected — no change there.
5. Retest in PWA: toggle notifications off/on, refresh, toggle again — no duplicate-key toast, row count in `push_subscriptions` stays at 1 per endpoint.

No native-side changes required for launch.