# Tracking webhook URL: accept both `token` and `secret`

## Current state (verified by live test)

The deployed webhook validates only the `token` query parameter:

- `?token=<secret>` returns 200 and processes the payload
- `?secret=<secret>` returns 401 Unauthorized
- no parameter returns 401

Your 17track webhook is currently configured with `?secret=`, so pushes are being rejected.

## Option A - no code change (fastest)

Set the 17track webhook URL back to:

```text
https://teaicrimlqdayqpmxasc.supabase.co/functions/v1/tracking-webhook?token=26443fcfaba6773996c193009329f2e75c8e161a95e75bd4667c6deb4a39f53d
```

Nothing else to do - everything else is already deployed and working.

## Option B - make the endpoint tolerant (recommended)

Update the webhook so either parameter name works, plus a standard header. This removes the whole class of "wrong param name" outage, so whichever URL is saved in 17track keeps working.

Change in `supabase/functions/tracking-webhook/index.ts`:

- Read the provided secret from, in order: `?token=`, `?secret=`, then the `x-webhook-token` request header.
- Compare with a constant-time comparison instead of `!==`.
- Keep the 401 response shape unchanged.

Then redeploy `tracking-webhook` and re-run the same three curl checks (`token`, `secret`, none) to confirm the first two return 200 and the third still returns 401.

## Note

Whichever option you pick, the secret value itself stays the same, so no change to the stored `TRACKING_WEBHOOK_SECRET`.
