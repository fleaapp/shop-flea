## Seller Onboarding Refactor

### Goal
Replace the current "Connect Stripe or PayPal" dialog with a streamlined 3-step seller enablement flow that gates only on what's needed to list & get paid. Remove PayPal from seller side entirely. Keep PayPal as a **buyer** payment option at checkout.

---

### 1. New Seller Enablement Flow

Create `src/components/SellerOnboardingSheet.tsx` — a bottom sheet (matching `StripeOnboardingSheet` styling: `rounded-t-3xl border-t-[3px] border-charcoal`, Inter, lime CTA) with 3 steps and a progress indicator (`Step X of 3`).

**Step 1 — Welcome**
- Title: "Start selling on Flea"
- Subtitle: "List items in minutes and get paid securely"
- CTA: "Continue"

**Step 2 — Legal name**
- Single input: "Your name (for payments)"
- Helper: "This must match your bank account details"
- Validate non-empty, ≥2 chars, trim. Persist to `profiles.legal_name` (new column).
- CTA: "Continue"

**Step 3 — Bridge to Stripe**
- Copy: "To get paid, we securely connect your bank account through Stripe. Flea never holds your money."
- Keeps the existing 🚨 Individual / Sole trader disclaimer.
- CTA: "Continue to secure setup" → calls `stripe-connect-onboard` edge function (passing email + legal name) and redirects.

On Stripe return (existing `/settings` return URL flow already verifies via `stripe-connect-status`), success toast: "You're ready to sell on Flea 🎉" and route to `/create-listing`.

---

### 2. Replace ConnectPaymentDialog usage

The "+" listing entry currently triggers `ConnectPaymentDialog` (Stripe vs PayPal choice). Change every entry point so that when the user is NOT yet a connected seller, we open the new `SellerOnboardingSheet` instead.

Touched files (entry points using ConnectPaymentDialog / payment gating):
- `src/pages/Profile.tsx`
- `src/pages/CreateListing.tsx`
- `src/pages/Settings.tsx` (for the seller "Connect payments" row — replace with "Set up selling")
- `src/components/PaymentMethodsSection.tsx` (remove PayPal block on seller side)

`ConnectPaymentDialog.tsx` and the "stripe vs paypal" choice UI are no longer used for seller onboarding — delete the PayPal connect button and rename/refocus the dialog, or remove it entirely in favor of `SellerOnboardingSheet`. Keep the action-required path (Stripe issues) inside the new sheet's logic.

---

### 3. Remove PayPal seller surfaces

- Remove "Connect PayPal" buttons in `PaymentMethodsSection`, `Settings`, `Profile` and any seller dashboard.
- Keep edge functions `paypal-connect-*` deployed (no-op for now) — do not delete; they're still referenced by buyer checkout in step 4.
- Remove `flea_paypal_pending` localStorage handling in seller flows.
- Remove "Action required" banners for PayPal on seller side.

---

### 4. PayPal as buyer payment option

PayPal Checkout (buyer side) already exists via `paypal-connect-checkout` edge function. Audit `src/pages/Checkout.tsx` — ensure PayPal appears as a buyer payment option alongside Stripe (Apple/Google/Card). If not currently surfaced, add a "Pay with PayPal" button that invokes the existing buyer checkout function. Keep payment-method icons row (Apple/Google/Card) and append PayPal logo per `checkout-payment-methods` memory.

(No changes to fees/fee model.)

---

### 5. Database

New migration:
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS legal_name text;
```
No RLS change needed — existing profile policies already allow user to update own row.

---

### Technical notes
- Sheet styling matches existing `StripeOnboardingSheet`/`OnboardingWelcomeDialog` (memory: drawer top-10 offset, px-4 pt-3 pb-4 footer, lime primary).
- Step state local to component (`useState<1|2|3>`).
- Mobile-first, max 2–3 min completion, no extra fields.
- Pass `legal_name` to `stripe-connect-onboard` edge function as optional `prefillName` param; the edge function can include it on `account.individual.first_name`/`last_name` if not yet set.

### Out of scope
- No changes to platform fees, refunds, or order flow.
- No deletion of PayPal edge functions (still used for buyer checkout).
- No changes to app onboarding (welcome/tour) flow.
