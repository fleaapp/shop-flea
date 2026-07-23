## What the screenshot proves

The Apple Pay sheet **opens**, shows your card, then PassKit fires "Apple Pay Is Not Available in Flea" at present time — with "Payment Not Completed" underneath. This is not an entitlement/merchant-ID problem (those would fail before the sheet opens). Your codesign dump already proved the entitlement is correct. The sheet opening confirms PassKit accepts `merchant.com.finditonflea.app`.

Failure at present-time on a Stripe-brokered Apple Pay sheet has one dominant cause: the PaymentIntent is created with `on_behalf_of: <seller connected account>`, which makes Stripe validate the Apple Pay token against the **seller's** connected account. Your merchant `merchant.com.finditonflea.app` is registered on the **platform** Stripe account (Flea), not on each seller. Stripe rejects the token, and PassKit surfaces the generic "Not Available" alert.

This is the exact behavior Stripe documents for destination charges + wallet payments: keep `transfer_data.destination` (so the seller gets paid), but do NOT set `on_behalf_of` when the platform's own merchant identifier is brokering the wallet.

## Why this matches "it worked yesterday"

`on_behalf_of` was added to the payment-intent function as part of the Connect hardening pass. Before that, the same code path shipped destination charges without it — Apple Pay worked. Removing it restores the working configuration without touching entitlements, plugin patches, or the native flow.

## The fix (one file, backend only)

**`supabase/functions/stripe-connect-payment-intent/index.ts`**
- Delete the line `on_behalf_of: sellerStripeAccountId,` from `piParams`.
- Keep `transfer_data: { destination: sellerStripeAccountId }` unchanged — this is what routes funds to the seller.
- Keep `application_fee_amount` unchanged — Flea still collects the buyer fee.
- Bump `PI_REQUEST_VERSION` so Stripe issues a fresh idempotency key instead of returning a cached PI from the broken shape.

No frontend changes. No plugin patches. No capacitor.config changes. No Xcode changes.

## What happens after the change

- Web Apple Pay: unchanged (still works).
- Native Apple Pay: the presented sheet is now validated against the platform account where `merchant.com.finditonflea.app` is registered → PassKit accepts → payment completes.
- Manual card: unchanged (destination charge still routes correctly).
- Seller payouts: unchanged — `transfer_data.destination` continues to move funds to the connected account minus the application fee.

## Push checklist after the change

Only the edge function changes; no native rebuild needed.

```bash
git pull
# no npm install / no cap sync / no Xcode archive required
```

The function auto-deploys. Retry Apple Pay in the existing TestFlight build.

## If this doesn't fix it

The next remaining hypothesis is that the connected account's `settings.payments.statement_descriptor` or capabilities are missing `card_payments`/`transfers` in a way that only surfaces at PassKit token validation. If Apple Pay still fails after the `on_behalf_of` removal, capture the exact PaymentIntent id from the failed tap so we can inspect the Stripe API log directly for the rejection reason — that is definitive and doesn't rely on the client logging path that hasn't been producing rows.
