# Write-mode smoke test: signup, seller onboarding, listing

Yes - most of that can be automated now. The signed-in session is available again, so this pass creates real test data and then cleans it up.

## 1. Signup and auth

- Create a throwaway test account with email + password through the real signup form.
- Email confirmation cannot be clicked from here, so the account is confirmed directly in the backend, then sign-in is exercised through the UI.
- Duplicate-signup guard: retry signup with the same email and confirm the "account already exists" prompt appears and no second account is created.
- Username sign-in (case-insensitive, with and without `@`), wrong-password error copy, logout returning to /auth with no blank screen.
- Guest mode: wishlist/discards persist locally and merge on sign-in.

## 2. Onboarding

- First-run splash and tutorial carousel through all slides; completion flag persists across reload.
- Seller onboarding sheet steps 1-5: verify the current copy, reload mid-flow and confirm it resumes on the same step.
- Verify the listing gate: with an unverified account, confirm "Set up seller" blocks listing creation.

## 3. Seller onboarding (Stripe) - partial

- Steps 1-4 of the in-app sheet, field validation, AU address restriction, and the resume behaviour are fully testable.
- The Stripe-hosted identity/bank verification itself cannot be completed from here (it needs real documents and a live provider session). The pass checks that the account is created, that status polling returns the correct state, and that the UI renders the right pill (Pending review / Action required).
- To exercise the fully-verified path, the test account's seller flags are set directly in the backend, then the dashboard, payout gating and balance rows are checked against that state.

## 4. Listing

- Create a listing end to end: images (a generated 4:5 test image), category > subcategory, brand match, size, condition, colour, price, shipping price.
- Bundle offers button opens and saves; offers toggle reveals/hides the auto-accept field.
- Edit listing (fields persist, images reorder/delete), pause (⏸️), delete (⛔️ snapshot state in wishlist/cart).
- Listing detail: price breakdown drawer, `+$X shipping` format, seller bubble, listing age.

## 5. Downstream flows on the test data

- Home feed swipe (like / skip / discard), search and filters against the new listing.
- Buyer adds to wishlist and cart, makes an offer; seller counters, accepts, declines - checking notification copy and deep-link routing each time.
- Coupon `FREEFLEA` applied at checkout: fee lines zeroed, redemption recorded.

## Still not automatable here

Apple/Google Pay and real card charges, real refunds and payouts, native camera refund proof, push delivery and tap-through, Apple/Google sign-in, email link clicks, iOS keyboard/safe-area behaviour.

## Cleanup

Every record created (accounts, listings, offers, cart rows) is deleted at the end of the pass, and the report lists exactly what was created and removed. Nothing touches existing user data.

## Technical notes

- Playwright under `/tmp/browser/smoke-write/`, mobile viewport 440x681 plus a 1280x1800 pass, session restored from the injected auth state.
- Test account emails use a `+smoke-<timestamp>` suffix so they are unambiguous.
- Backend confirm/flag steps use direct SQL and are limited to the test account rows.
- Output: pass/fail per section, screenshots for failures, exact console and network errors, and a short fix list. No code changes in this pass unless you ask.
