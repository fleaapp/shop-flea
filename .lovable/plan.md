# Flea - Deep Dive Audit

Four parallel passes (money paths, security, UX/performance, copy/legal/notifications), each verified against real file contents. Database claims were re-confirmed directly against the live production database.

**Headline: the app is in good shape.** Every critical item from the August audits is genuinely fixed and verified live - the duplicate offer-accept, funds releasing mid-dispute, the hardcoded reviewer bypass, and the double coupon redemption. Fee math is single-sourced and consistent, and no money-moving or admin endpoint is unauthenticated. What is left is a mix of small correctness gaps, copy-rule slips, and performance debt.

---

## Verified fixed (no action needed)

- Offers: `offers_one_accepted_per_listing` partial unique index exists live. One accepted offer per listing.
- Coupons: `coupon_redemptions_one_per_user` unique index exists live. FREEFLEA cannot be redeemed twice.
- Auto-complete now excludes orders with an open refund request, so funds cannot release mid-dispute.
- The Apple reviewer bypass is a server-only `profiles.is_apple_reviewer` flag. No UUID in the client bundle.
- `validate-coupon` now verifies the JWT properly. Bundle refunds pass `mode: 'single'`.
- Payout webhooks (`payout.paid` / `payout.failed`) and refund-driven balance sync are wired up.
- RLS is enabled on all 39 public tables. `user_roles` has no client-writable policy, so there is no self-escalation path. Notifications block client inserts outright.
- Legal coverage is solid: ACL consumer guarantees, GST, complaints and ACCC escalation, and the Notifiable Data Breaches scheme are all present.

---

## High priority

**1. Storage buckets accept any file, any size.** Confirmed live: `listings` and `order-attachments` both have `file_size_limit = NULL` and `allowed_mime_types = NULL`. Only the client `accept="image/*"` hint stops abuse, and that is trivially bypassed with the public anon key. Fix: set a size cap and an image MIME allowlist on both buckets.

**2. Home feed fetches every column.** `src/hooks/useListings.ts:101` uses `select('*')` on the highest-traffic query in the app. A `LISTING_CARD_COLUMNS` allowlist already exists in `src/lib/listingColumns.ts`, written for exactly this, but is unused - so moderation columns like `report_count` ship to every shopper. Fix: wire the constant in.

**3. 38MB of assets in `src/assets`.** Two GIFs at 10MB and 8.5MB (both already have `.mp4` siblings), and three onboarding "SVGs" at 1.4-1.8MB that almost certainly contain embedded raster data. Fix: drop the GIFs in favour of the existing mp4s, re-encode the onboarding art, lazy-load the landing media.

**4. Em dashes in notification and email copy.** Ten transactional email templates use `— ${itemTitle}` in preview text, `buyer-order-shipped` and `welcome` have them in body copy, and `order-messages/index.ts:691` sends a push titled `Refund requested — ...`. Fix: replace with short dashes.

**5. Edit Profile silently discards changes.** `src/pages/EditProfile.tsx:292` navigates back with no dirty check, unlike Create Listing and Edit Listing which both prompt. Fix: add the same discard dialog.

---

## Medium priority

**6. Missing trailing full stops on seven notification strings** in `src/hooks/useNotifications.ts` (`price_drop_cart`, `price_drop_wishlist`, `cart_item_sold`, `wishlist_item_sold`, both shipping reminders, `welcome`). Most other types are correct.

**7. Two live notification types are undeclared.** `order_auto_refunded` and `sale_auto_refunded` are fired, styled and routed, but missing from the `NotificationType` union - a refactor could silently drop them.

**8. `admin-restore-seller` has an `X-Admin-Bypass` header** that skips the role check when it matches the service-role key. Redundant, since that key already grants everything. Fix: remove it.

**9. Stale fallback credentials in edge functions.** Five functions hardcode a `??` fallback anon key belonging to an unrelated project ref. Not a secret leak, but it could misroute if an env var is ever unset. Fix: delete the fallbacks and fail loudly instead.

**10. Coupon redemption writes are fire-and-forget.** Both `stripe-connect-payment-intent` and `finalize-checkout` swallow insert failures in a `catch`. The unique index now guarantees correctness, but a transient failure under-counts redemptions with no alert.

**11. Wildcard CORS on money-moving functions.** `Access-Control-Allow-Origin: *` remains on the Stripe and checkout functions. They call `rejectUntrustedOrigin` first so this is defence-in-depth, not an open door. Fix: use `buildCorsHeaders`.

**12. Privacy Policy names Stripe three times** (lines 64, 101, 127). This breaks the brand rule, but naming the actual processor is arguably required for a truthful APP disclosure. **This one needs your decision** - I would keep the entity name in the Privacy Policy as a deliberate exception and leave every other surface saying "payment providers".

**13. `get_email_by_username` is public and rate-limited by username, not IP.** Usernames are public, so a distributed attacker can still harvest emails slowly. Fix: add an IP dimension to the rate limit.

---

## Low priority

- 17 files hardcode raw Tailwind colours instead of tokens, worst in `SellerDashboard.tsx` (11 sites) and the admin transaction tables. Dark mode and the `.admin-scope` theme will not repaint these.
- `OrderChat.tsx:320` report button has no accessible name and a ~32px touch target. `EditProfile.tsx:292` back button is ~40px. Everything else is compliant.
- Polling is implemented three different ways (React Query intervals, raw `setInterval` in Offers, raw `setInterval` in admin hooks). `Offers.tsx:127` polls every 60s with no visibility gating.
- `profiles` reads and writes are hand-rolled in ~20 call sites with no shared hook, each with its own error handling.
- Dozens of `catch` blocks log to `console.warn` and continue silently rather than surfacing an error state.
- No `beforeunload` guard anywhere, so a browser refresh mid-form loses everything.
- `finalize-checkout` allocates a whole bundle's transaction fee onto the first order row. Seller totals are correct because they aggregate, but any per-row report would read every other row as fee-free.

---

## Suggested build order

1. **Hardening:** items 1, 8, 9, 13.
2. **Performance:** items 2, 3, plus polling and over-fetch cleanup.
3. **Copy:** items 4, 6, 7.
4. **Polish:** item 5, then tokens and accessibility.
5. **Your call:** item 12 (Stripe in the Privacy Policy).

No code has been changed. Approve this and I will work through it in that order, or tell me which sections to take and which to skip.
