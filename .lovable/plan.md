No code changes — just a backend diagnostic to confirm the `sk_live_...` key you pasted has replaced the restricted key and removed the `accounts_kyc_basic_read` permission error.

Steps:
1. Call the `stripe-config` edge function to confirm the backend now reports `livemode: true` and the key type in use.
2. Call the `stripe-connect-payment-intent` edge function with a minimal preflight payload to confirm `stripe.accounts.retrieve` no longer throws a permission error.
3. Query `public.error_logs` for any recent Stripe permission-denied entries tied to checkout.
4. Report the result: if clean, manual card / Apple Pay / saved cards should no longer be blocked by the scope error.

Expected outcome: the permission error from IMG_6792 is gone and checkout can proceed.