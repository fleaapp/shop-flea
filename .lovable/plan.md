## Plan

1. **Fix the payout edge function CORS response**
   - Update `stripe-connect-payout` to use the same native-safe CORS header coverage as the working seller dashboard function.
   - Include the extra headers native/WebView requests can send, so the browser is allowed to continue from `OPTIONS` to the real `POST`.

2. **Keep the payout logic unchanged**
   - Do not change available-funds math, buyer-protection holds, instant payout fee, or verification rules.
   - This is a transport/preflight fix only.

3. **Improve the client error message for network-level failures**
   - If the payout call fails before a JSON response is returned, show a clearer payout-specific retry message instead of the generic `Load failed`.

4. **Deploy and verify the payout function**
   - Deploy `stripe-connect-payout`.
   - Test the deployed function with a preflight-style request and a protected POST.
   - Re-check function logs/HTTP logs to confirm the actual `POST` reaches the function, not just `OPTIONS`.

## Technical details

The latest backend logs show the user’s payout attempts reaching `stripe-connect-payout` as `OPTIONS | 200`, but no following `POST`. That pattern points to the browser/native WebView blocking the request after preflight, most likely because `stripe-connect-payout` has narrower `Access-Control-Allow-Headers` than nearby working payment functions such as `stripe-connect-dashboard`.