## Goal
Stop the seller payout action from failing with “Payout request could not reach the payment provider” and make the failure mode observable if anything else blocks it.

## What I confirmed
- The payout button calls `invokeCloudFunction('stripe-connect-payout', { method })` from `SellerDashboard`.
- Recent `stripe-connect-payout` logs only show cold starts/boots and no POST log entries, so the browser/native WebView is still not reaching the function handler with the payout POST.
- The shared `invokeCloudFunction` helper constructs a direct backend function URL and uses `fetch`, so any preflight/CORS or native WebView transport issue appears to the UI as `Load failed` / `failed to fetch`.
- The current payout function source now has inline CORS headers, but there is no request-level logging before auth/body parsing, making it hard to distinguish “preflight failed” from “wrong deployed version” or “POST reached but failed before logs”.

## Plan
1. Add minimal request diagnostics to `stripe-connect-payout`:
   - Log every incoming method at the very top of the handler.
   - Log OPTIONS responses and POST entry before parsing auth/body.
   - Keep logs free of tokens, account IDs, and secrets.

2. Make the payout function’s CORS response more robust:
   - Include the same full allowed headers already used by working payment functions.
   - Add explicit `Access-Control-Allow-Methods: POST, OPTIONS`.
   - Add `Access-Control-Max-Age` to reduce repeated native preflight friction.
   - Ensure every error and success response includes the same headers.

3. Add a dedicated client fallback for payout only:
   - If `invokeCloudFunction` throws before receiving an HTTP response, retry once using the official backend client invocation path instead of raw `fetch`.
   - Keep the existing toast copy, but only show the “could not reach” message after both attempts fail.

4. Improve payout error visibility in Admin error logs:
   - When the POST reaches the function and business logic fails, keep structured `logEdgeError` context.
   - Add a client-side error log for true transport failures so the Admin Dashboard can show when a device never reached the function.

5. Validate after implementation:
   - Check the source compiles structurally.
   - Re-check `stripe-connect-payout` logs after the user retries: expected signal is either a POST entry or a client transport error entry, rather than silent boots only.