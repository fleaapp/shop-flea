## 1. Checkbox visibility (global)

`src/components/ui/checkbox.tsx`
- Bump size `h-4 w-4` → `h-5 w-5`
- Border `border-primary` → `border-charcoal/50`
- Checked state `bg-primary` / `text-primary-foreground` → `bg-charcoal` / `text-white`
- Check icon `h-4 w-4` → `h-3.5 w-3.5`

## 2. Save-card copy

`src/components/checkout/CardDetailsSheet.tsx`
- Current helper text references managing cards from "Edit profile in Settings", which is wrong now that saved cards will be managed inside checkout.
- Update to: **"Save these card details"** with sub-copy **"You can remove saved cards anytime from the payment picker at checkout."**

## 3. Saved-card management inside checkout

`src/components/checkout/PaymentMethodPicker.tsx`
- Each saved-card row gets a trailing trash/✕ button (icon only, muted colour, right-aligned, does not trigger row selection).
- Tapping it opens a small confirm AlertDialog ("Remove this card?" / Cancel / Remove).
- On confirm, invoke a new edge function `stripe-detach-saved-card` with `{ payment_method_id }`, then refetch the saved-cards query and clear selection if the removed card was selected.
- Show inline spinner on the row while the detach request is in flight.

`supabase/functions/stripe-detach-saved-card/index.ts` (new)
- Auth: manual JWT parse (project pattern), resolve user → Stripe customer by email.
- Verify the `payment_method` belongs to that customer before calling `stripe.paymentMethods.detach(id)`.
- Return `{ ok: true }`; 403 if ownership check fails.
- Register in `supabase/config.toml` with `verify_jwt = false` (matches sibling stripe functions).

No schema changes. No changes to checkout logic beyond the picker UI and the new detach function.

## Out of scope
- Any changes to the Settings/Edit-profile saved-cards section (kept as-is).
- Payment intent, Apple Pay, coupon, or pricing logic.
