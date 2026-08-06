# Verification result and remaining fix: scheduled tracking sync

## What is confirmed working

- **17track webhook**: `tracking-webhook` is configured with `verify_jwt = false` and authenticates via the `?token=` query string. Live carrier pushes are accepted.
- **Seller Stripe status check**: `stripe-connect-status` now handles a failed account lookup - stale accounts are cleared and return a clean "not connected" response, and Stripe outages return a retryable 503 instead of a hard 500.

## What is still broken

The hourly tracking sync ran at 03:15 UTC today and came back **401 Unauthorized**.

Cause: both tracking cron jobs build their `Authorization` header from a vault secret named `email_queue_service_role_key`, and that value does not match the service role key the function checks against, so the header resolves to an invalid bearer token. Every other working cron job in this project instead sends the shared `x-cron-secret` header, which `tracking-sync` also accepts.

## Fix

Reschedule the two tracking cron jobs to use the same `x-cron-secret` header pattern the other working jobs use, dropping the vault lookup:

- `invoke-tracking-sync-fresh-hourly` (`15 * * * *`, body `{"mode":"fresh"}`)
- `invoke-tracking-sync-daily` (`0 9 * * *`, body `{"mode":"daily"}`)

Then wait for the next hourly run and confirm the response recorded for it is a 200 with a `{"scanned":...}` payload rather than `{"error":"Unauthorized"}`.

## Technical notes

- `tracking-sync` authorises on either `Authorization: Bearer <service role key>` or `x-cron-secret: <CRON_SECRET>`; the second path is what the other jobs use successfully.
- No edge function code changes are needed - this is purely a cron job definition change.
