# Negative Balance Guardrails

Right now nothing in the app checks the seller's Stripe Connect balance. Stripe will pause payouts on its side, but a seller with a negative balance can still buy items, list new items, delete their account, or sign up fresh on the same device. This plan closes all four holes and adds an in-app top-up flow.

## What we'll build

### 1. Server-side balance check (single source of truth)

New helper in `stripe-connect-status/index.ts` returns:
- `available` (cents), `pending` (cents)
- `isNegative` (true if `available + pending < 0`)
- `negativeAmount` (absolute cents owed)

Cached briefly per request. Every gate below calls this — never trust the client.

Also mirror `negative_balance_cents` and `negative_balance_updated_at` onto `profiles` via the existing `account.updated` webhook + a nightly reconciliation, so we can gate flows without an extra Stripe call on the hot path.

### 2. In-app top-up flow (settle negative balance)

New edge function `stripe-connect-topup`:
- Takes an amount (defaulted to `negativeAmount`) and a `payment_method_id` (Apple Pay / Google Pay / saved card, reusing the existing `PaymentMethodPicker` and `CardDetailsSheet`).
- Creates a `PaymentIntent` **on the connected account** (`stripeAccount: accountId`) with the seller's card as source. Funds land directly in their Connect balance and offset the negative.
- Uses `idempotencyKey: flea-topup-${accountId}-${amount}-${timestamp-bucket}` so double-taps don't double-charge.

New UI in `SellerDashboard.tsx`:
- When `isNegative`, replace the "Available balance" card with a red **"Balance owed: $X.XX"** block and a **"Settle balance"** primary button that opens a sheet using the same payment picker as checkout.
- Success → refetch status → banner clears → all gates unlock.

### 3. Block buying while negative

- `stripe-connect-payment-intent` (checkout): before creating the intent, look up the buyer's profile. If `negative_balance_cents > 0`, return `409 { code: "negative_balance", amount }`.
- `Checkout.tsx`: on that response, show a blocking dialog "Settle your seller balance before making new purchases" with a **Go to Seller Dashboard** button. No fallback path.

### 4. Block selling / new listings while negative

- `CreateListing.tsx` (and `EditListing.tsx` publish action): check `profile.negative_balance_cents` alongside the existing `stripeFullyConnected` gate. If negative, show the same "Settle balance" CTA instead of the Connect Payment prompt.
- Server-side backstop in the listing insert RLS/edge path so it can't be bypassed.

### 5. Block account deletion while negative

`supabase/functions/delete-account/index.ts` — add a new check after the outstanding-orders check:

```
if (negative_balance_cents > 0) → 400 "Settle your outstanding balance of $X.XX before deleting your account."
```

Applies to both buyers and sellers (buyers can only be negative if they were also sellers, but the check covers both roles cleanly).

### 6. Block re-registration on the same device

New table `blocked_devices`:

```
device_id TEXT PRIMARY KEY,
reason TEXT NOT NULL,           -- 'negative_balance'
associated_user_id UUID,        -- the user who owes
amount_cents INTEGER,
created_at TIMESTAMPTZ DEFAULT now()
```

Flow:
- On app launch (native) capture Capacitor `Device.getId()` and store it on `profiles.device_ids` (array, deduped) whenever a user signs in.
- If a user tries to delete their account or sign out while negative → we don't block the sign-out itself, but we insert every `device_id` from `profiles.device_ids` into `blocked_devices` linked to that user.
- New edge function `check-device-eligibility` called from the sign-up path in `Auth.tsx` before creating the auth user. If the device is in `blocked_devices` → return the error and show "This device is linked to an account with an outstanding balance. Please settle it before creating a new account." with a **Sign in to settle** link.
- Web fallback: no reliable device ID, so we use a signed cookie + IP + browser fingerprint (best-effort). Documented as best-effort — the real teeth are on iOS/Android where `Device.getId()` is stable.

### 7. Legal / copy

- Update Terms to state that outstanding negative balances must be settled and that re-registration on the same device is blocked until then.
- Bank-details copy already fixed in the previous turn — no change needed.

## Technical details

**Files touched**
- `supabase/functions/stripe-connect-status/index.ts` — return balance + `isNegative`
- `supabase/functions/stripe-connect-topup/index.ts` — new, creates PI on connected account
- `supabase/functions/stripe-webhook/index.ts` — on `balance.available` / `payout.failed` / `charge.dispute.*` sync `negative_balance_cents` to `profiles`
- `supabase/functions/stripe-connect-payment-intent/index.ts` — gate buyers
- `supabase/functions/delete-account/index.ts` — gate deletion
- `supabase/functions/check-device-eligibility/index.ts` — new
- Migration: add `profiles.negative_balance_cents`, `profiles.negative_balance_updated_at`, `profiles.device_ids TEXT[]`; create `blocked_devices` table with GRANTs + RLS (service_role only writes; no client reads)
- `src/pages/SellerDashboard.tsx` — negative banner + Settle button + sheet
- `src/components/SettleBalanceSheet.tsx` — new, reuses `PaymentMethodPicker`
- `src/pages/Checkout.tsx` — handle 409 negative_balance
- `src/pages/CreateListing.tsx` + `EditListing.tsx` — gate publish
- `src/pages/Auth.tsx` — call `check-device-eligibility` before sign-up
- `src/lib/deviceId.ts` — new helper wrapping Capacitor `Device.getId()`

**Edge cases handled**
- Top-up while another charge is in flight → idempotency key
- Balance flips positive between check and action → server re-checks at the point of action, not just at page load
- User signs into an existing (owing) account on a new device → device gets added to `profiles.device_ids` and, if still negative, into `blocked_devices` so that device is also locked from creating a *different* new account
- User deletes app and reinstalls → `Device.getId()` is stable per device on iOS/Android, so the block persists

## What I need from you

Nothing to decide — this is all mechanical if you approve. Ready to build on your go-ahead.
