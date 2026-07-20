Plan: Save Stripe webhook secrets and update webhook handler for dual-scope events

1. Collect and store secrets
   - Update the existing `STRIPE_WEBHOOK_SECRET` with the "Your account" signing secret (`whsec_...`).
   - Add a new `STRIPE_WEBHOOK_SECRET_CONNECTED` secret with the "Connected accounts" signing secret.
   - Both values will be saved via the secure secrets forms.

2. Update `supabase/functions/stripe-webhook/index.ts`
   - Read both `STRIPE_WEBHOOK_SECRET` and `STRIPE_WEBHOOK_SECRET_CONNECTED` from environment variables.
   - Attempt Stripe signature verification with the primary secret first, then fall back to the connected-account secret.
   - Return `400` only if neither secret validates the signature.

3. Deploy edge functions
   - Deploy the updated `stripe-webhook` edge function so the dual-secret verification takes effect.

4. Verify delivery
   - In the Stripe dashboard, confirm both webhook destinations show successful recent deliveries.
   - If needed, trigger a test event (e.g., `account.updated`) to confirm the endpoint responds with `200`.

After you approve this plan, I’ll open the secure forms for the two `whsec_...` values and then make the code changes.