# Keep app state when you leave and return

When iOS backgrounds Flea for more than a few minutes (or you open a banking app, camera, autofill sheet, etc.), the WebView can be evicted and the app cold-starts on return. Right now that means: mid-checkout you lose your coupon, payment selection, and any open sheet; mid-listing you lose the title, price, description, brand, category, and photos you'd added. This plan makes those flows survive a background/return.

## What will persist

**Checkout (`src/pages/Checkout.tsx` + `CardDetailsSheet`)**
- Applied coupon code
- Selected payment method (Apple Pay / Google Pay / card)
- "Editing address" vs "saved" state
- Whether the card-details sheet was open, plus the card form's non-sensitive fields (name on card, postcode). Card number / CVV are never persisted — PCI rule, and the Stripe Elements iframe clears them on reload regardless.
- Existing shipping-address persistence stays as-is.

**Create listing (`src/pages/CreateListing.tsx`) and Edit listing (`src/pages/EditListing.tsx`)**
- All text fields: title, description, price, shipping price, brand, category, subcategory, size, condition, colours, styles, fit.
- Photos already added (including any that were cropped). Stored as blobs in IndexedDB so they survive a WebView reload without bloating localStorage.
- Draft is cleared once the listing is successfully published or when the user taps a new "Discard draft" action.

**Other in-progress flows already handled**
- Seller onboarding (already resumes via `SellerOnboardingResumeMount`) — untouched.
- Order chat / support chat drafts — out of scope for this pass unless you want them included.

## How it will work

1. **Draft hooks**
   - New `src/hooks/useFormDraft.ts` — small wrapper around `useState` that reads an initial value from localStorage on mount and writes back (debounced ~300ms) on every change. Keyed per user so drafts don't leak across accounts on the same device.
   - New `src/lib/imageDraftStore.ts` — thin IndexedDB helper (`get`, `set`, `clear` keyed by draft ID) for the listing photo blobs. Falls back silently if IndexedDB is unavailable.

2. **Checkout wiring**
   - Replace the affected `useState` calls with `useFormDraft` under keys like `checkout_draft_coupon`, `checkout_draft_method`, `checkout_draft_edit_mode`, `checkout_draft_card_open`.
   - Persist card-form name + postcode the same way inside `CardDetailsSheet`.
   - Clear all `checkout_draft_*` keys on successful payment (in `CheckoutSuccess`) and on explicit "Cancel checkout".

3. **Listing wiring**
   - Same treatment for every text field in `CreateListing` under a single `listing_draft_v1` object.
   - On image add/crop, write the resulting blob into IndexedDB under that draft ID. On mount, if a draft exists, restore text fields and reconstruct `imageFiles` with `URL.createObjectURL` from the stored blobs.
   - Add a small "Draft restored — Discard" chip at the top of the page when a draft is rehydrated, so nothing feels sticky if you meant to start fresh.
   - Clear the draft on successful publish.
   - Same pattern for `EditListing`, keyed by listing ID so edits to different listings don't collide.

4. **Native lifecycle safety net**
   - Add a single `src/lib/appResume.ts` that subscribes to Capacitor's `App.appStateChange`. On background it forces a flush of any pending debounced writes so nothing is lost even if iOS kills the WebView the instant we hide.
   - No forced reloads, no navigation on resume — the existing route/URL restores the page naturally, and the drafts above restore the inputs.

## What this does not change

- No changes to auth, routing, payments, or the checkout success flow itself.
- Card number / CVV still won't survive backgrounding — that's a security constraint, not a bug we can fix.
- If iOS fully kills the app while a Stripe Apple Pay sheet is open, Apple Pay itself will still need to be re-tapped (it's a system sheet, not ours); everything up to that point will be restored.

## Files touched

- New: `src/hooks/useFormDraft.ts`, `src/lib/imageDraftStore.ts`, `src/lib/appResume.ts`
- Edited: `src/pages/Checkout.tsx`, `src/components/checkout/CardDetailsSheet.tsx`, `src/pages/CreateListing.tsx`, `src/pages/EditListing.tsx`, `src/pages/CheckoutSuccess.tsx` (draft-clear on success), `src/App.tsx` (mount `appResume` listener once)

Reply "go" and I'll build it. If you'd like order-chat message drafts included in the same pass, say so and I'll add them.