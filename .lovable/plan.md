# H3 revisited: you were right, the bank-details banner is mostly wrong

## What I checked

- Your only connected seller account (@sarahhearn2) has `charges_enabled: true`, `payouts_enabled: true`, and one CBA bank account attached. Nothing is broken today.
- `stripe-connect-status` only sets `stripe_onboarding_complete = true` when **both** `charges_enabled` and `payouts_enabled` are true, and `payouts_enabled` requires an attached bank account.
- Listing is gated on `stripe_onboarding_complete`, and onboarding step 3 collects bank details via `stripe-connect-add-bank`.

So your point is correct: a seller who can list items already has a bank account. The banner I added can't fire for a normally verified seller.

## Where it can still fire (and is wrong)

The condition includes `(!payoutsEnabled && hasExternalAccount !== true)`. If the dashboard call can't read external accounts (permission or API hiccup, field simply absent), `hasExternalAccount` comes back undefined and a seller who *does* have a bank account gets told to "Add your bank details". That's the real risk - a false alarm on a working account.

## Proposed change

Narrow the banner so it only appears when Stripe explicitly says the bank account is missing or rejected:

- Show it only when `hasExternalAccount === false`, or when Stripe's `requirements.currently_due` / `past_due` contains an `external_account` entry.
- Drop the `!payoutsEnabled && hasExternalAccount !== true` fallback entirely, so an undefined/unknown value never triggers it.
- When payouts are disabled for some other reason, fall through to the existing "Finish verification to withdraw." message rather than blaming the bank account.

This keeps a genuine safety net for the one case that can really happen post-onboarding - a bank account that gets rejected or removed by Stripe later, which does disable payouts while the seller stays verified - without ever nagging a correctly set up seller.

## Technical detail

- `src/pages/SellerDashboard.tsx`: tighten `needsBankDetails` (currently lines 331-335) and leave `payoutBlockedReason` ordering as is.
- `supabase/functions/stripe-connect-dashboard/index.ts`: also return the account's `requirements.currently_due` / `past_due` entries that start with `external_account`, so the frontend has an explicit signal instead of inferring one.

No changes to onboarding, listing gating, or payout math.
