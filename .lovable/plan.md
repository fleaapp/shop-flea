## Problem

The last "CORS fix" to `supabase/functions/stripe-connect-payout/index.ts` imported `corsHeaders` from `npm:@supabase/supabase-js@2/cors`, but that subpath export doesn't exist. The import resolves to `undefined`, so the spread `{ ...baseCorsHeaders, ... }` silently drops `Access-Control-Allow-Origin: *`. The OPTIONS preflight returns 200 but without an allowed origin, so the browser/WebView blocks the follow-up POST — which is why edge function logs still show boots but zero POST requests, and the client shows the "could not reach the payment provider" toast.

Every other working Stripe Connect function (`stripe-connect-status`, `stripe-connect-topup`, etc.) uses a plain inline `corsHeaders` object with `Access-Control-Allow-Origin: *` — the payout function is the odd one out.

## Fix

Replace the broken CORS setup in `supabase/functions/stripe-connect-payout/index.ts` with the same inline plain object used across the other Stripe Connect functions:

- Remove the `import { corsHeaders as baseCorsHeaders } from "npm:@supabase/supabase-js@2/cors"` line.
- Define `corsHeaders` inline with:
  - `Access-Control-Allow-Origin: *`
  - `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version`
  - `Access-Control-Allow-Methods: POST, OPTIONS`
- Leave the rest of the payout logic (held-funds guard, instant vs standard, fee capture, error logging) untouched.

## Verify

After the edit deploys:
1. Trigger a payout from Seller Dashboard.
2. Check `stripe-connect-payout` edge function logs — a POST entry should now appear alongside the boot.
3. Expect either a success toast or a real business-logic error (e.g. "No available balance"), not "could not reach the payment provider".
