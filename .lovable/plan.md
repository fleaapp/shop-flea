Migration from the external Supabase project to Lovable Cloud is essentially complete for runtime traffic, but a few dangling references and cleanup steps remain.

## Confirmed already migrated
- `src/integrations/supabase/client.ts`, `.env`, and `supabase/config.toml` all point to the Cloud project (`teaicrimlqdayqpmxasc`).
- Auth users and public profiles are synced (5 users / 5 profiles in Cloud).
- Stripe webhook secrets and endpoint are now Cloud-based; a test seller-onboarding event delivered successfully.
- Apple Sign In is using Lovable Cloud managed auth; Google Sign In is paused as requested.
- Edge functions read Cloud env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`) and have recent logs.

## What is still left to do

### 1. Remove old preconnect hints in `index.html`
Lines 78–79 still tell browsers to preconnect to the old external URL `https://dzglehiopfgfjmxtejve.supabase.co`. This should be removed so no client traffic touches the old project.

### 2. Clean up migration-only edge function
`supabase/functions/admin-migrate-from-external/index.ts` is a one-shot migration tool that requires the old `EXTERNAL_SUPABASE_*` secrets. Once you confirm no more users/data need migrating, this function should be deleted.

### 3. Update stale "external" error messages/comments
A few functions still mention the old env names in error strings or comments even though they now read Cloud env vars:
- `supabase/functions/admin-seed-coupon/index.ts:17`
- `supabase/functions/create-saved-searches-table/index.ts:14`
- `supabase/functions/admin-reset-seller/index.ts:2` (comment only)

### 4. Delete old external secrets
The following secrets are no longer used by code and can be removed:
- `EXTERNAL_SUPABASE_URL`
- `EXTERNAL_SUPABASE_ANON_KEY`
- `EXTERNAL_SUPABASE_SERVICE_ROLE_KEY`
- `EXTERNAL_SUPABASE_DB_URL`

### 5. Verify edge function deployment coverage
All active edge functions need to be confirmed deployed to the Cloud project. Recent `stripe-webhook` logs exist, but a full deploy sweep should be run to ensure none were missed during cutover.

### 6. Confirm storage and third-party hooks
- Only 1 object currently exists in Cloud storage. If listing images or avatars remain in the old external storage bucket, they should be copied over.
- Confirm any non-Stripe webhooks (e.g., AfterShip, PayPal if enabled) are pointed at the new Cloud function URLs rather than the old project.

## Other issues found while inspecting
Two high-severity project findings are unrelated to migration but should be fixed soon:
1. **Admin listing removal deletes completed order history** (`supabase/functions/admin-data/index.ts`).
2. **Refunds succeed at Stripe but the app cannot mark orders as `refunded`** because the `orders.status` check constraint does not include `refunded`.

## Recommended order
1. Remove old preconnect lines and stale error messages.
2. Delete `admin-migrate-from-external` and the old external secrets.
3. Run a full edge function deploy to Cloud.
4. Verify storage completeness and any third-party webhooks.
5. Address the two high-severity findings separately.