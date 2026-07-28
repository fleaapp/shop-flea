## Root cause (likely)

`supabase/functions/stripe-connect-payout/index.ts` is the only Stripe edge function still importing an older, non-standard Stripe SDK:

```
import Stripe from "https://esm.sh/stripe@17.7.0?target=denonext";
```

Every other Stripe function in the project uses `https://esm.sh/stripe@18.5.0`. The `?target=denonext` variant on esm.sh can return a stale/broken redirect, and the recent edge-function logs for this function show only a `Boot` event with no matching `Listening on http://localhost:9999/` line — a strong signal the module is failing to initialise on cold start. When the client fetches while the function is mid-crash, Safari surfaces the network error as **"Load failed"**.

A secondary risk: the function makes several serial Stripe calls (`balance.retrieve`, `accounts.retrieve`, optional `transfers.create`, then `payouts.create`) with no per-call error surfacing, so real failures get swallowed as a generic 400 or timeout.

## Fix

1. **Align the Stripe import** in `supabase/functions/stripe-connect-payout/index.ts` with the rest of the codebase:
   - Replace with `import Stripe from "https://esm.sh/stripe@18.5.0";`
   - Keep `apiVersion: "2025-08-27.basil"` (matches other functions).

2. **Add structured error logging** using the existing `supabase/functions/_shared/logError.ts` helper. Wrap each Stripe call so a failure writes a row to `error_logs` with the user id, chosen method, and the Stripe error `code`/`type`/`message` before returning the 400. This gives us real diagnostics in Admin → Error Logs if it happens again.

3. **Return CORS headers on the network-error path too** — the current `catch` uses the `json()` helper which already includes them, so no change needed here; just verifying.

4. **Sanity check after deploy:** trigger a standard payout from the Seller Dashboard and confirm either success or a specific error message (not "Load failed"). If it now fails with a real Stripe message, we address that as a follow-up.

## Out of scope

- No change to payout math, held-funds guard, instant-payout fee logic, or UI copy.
- No schema changes.
