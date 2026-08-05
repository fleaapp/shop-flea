# Automated smoke test pass

Run as much of the approved checklist as can be verified from this environment, and report what needs a human on a device.

## What can be automated here

A Playwright pass against the running preview using the signed-in session, capturing screenshots, console errors, and failed network calls per screen:

- Public and authed route load: home feed, search, wishlist, cart, alerts, offers, orders, sales, profile, settings, seller dashboard, FAQ, terms, privacy.
- Navigation: bottom nav, back behaviour, drawers open/close, no blank screens.
- Read-only data checks: badges render, listing cards, listing detail (price breakdown, shipping format), profile tabs, offers tabs for a non-seller.
- Console and network audit on every screen (the current `ProviderConflictDialog` forwardRef warning is already visible on /auth and will be included).

Plus non-destructive backend checks by query:
- Orphan or mismatched order totals, order numbers formatted `FL-00xxxx`.
- Coupons table state for `FREEFLEA`, redemption counts.
- Notifications with unroutable types, offers past expiry still pending.
- RLS/grant linter and security scan results.

## What cannot be automated here

These need a real device or real money and stay manual:
- Apple/Google Pay, card charges, real refunds and payouts.
- Native camera capture for refund proof, push notification delivery and tap-through.
- Apple/Google sign-in, email delivery and link clicks.
- Keyboard, safe-area, and status-bar behaviour on iOS.

## Output

A pass/fail report per checklist section, with screenshots for any failure, the exact console/network error, and a short list of fixes to make next. No code changes in this pass unless you ask for them.

## Technical notes

- Playwright script under `/tmp/browser/smoke/`, viewport 1280x1800 and a 440x681 mobile pass, session restored from the injected Supabase auth state.
- Backend checks via read-only SQL plus the linter and security scan tools.
- Nothing writes to the database: no test orders, offers, or messages are created unless you approve a second write-mode pass.
