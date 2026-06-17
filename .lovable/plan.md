## Goal
Give Apple App Review a working demo account that can browse, add to cart, and "buy" items end-to-end without touching real Stripe — plus seed 5 demo listings on each of the two existing seller accounts.

## 1. Demo reviewer account
- Email: `appreview@finditonflea.com` (placeholder — change in the plan reply if you'd rather use a real inbox you control)
- Password: `FleaReview2026!` (Apple needs this in plain text in App Store Connect; change if you want)
- Username: `@applereview`
- Region: AU
- Created via a one-off migration that calls `auth.admin` through a `SECURITY DEFINER` helper so the user exists in `auth.users` + `public.profiles` with `email_confirmed_at` set (skips email verification).

## 2. Stripe "review mode" bypass
Detect the reviewer in edge functions by a single source of truth: a `REVIEWER_USER_IDS` env var (comma-separated UUIDs). Reading this from env, not the DB, keeps the bypass auditable and lets you flip it off instantly.

Changes:
- **`stripe-connect-checkout`** — if `user.id` is in `REVIEWER_USER_IDS`, skip Stripe entirely. Insert paid `orders` rows directly (one per item, same `order_group_id`), mark listings `sold`, and return a synthetic success URL: `${origin}/checkout/success?demo=1&order_group=<id>`. No application fee, no transfer, no customer created.
- **`CheckoutSuccess.tsx`** — when `demo=1` is present, skip the Stripe `session_id` lookup and just render success using the `order_group` param.
- **Seller-not-connected guard** — bypassed for the reviewer, so the demo sellers don't need real Stripe Connect accounts.
- **`stripe-connect-refund`** — if the order being refunded has no `stripe_payment_intent_id` (i.e. a demo order), mark `refunded` directly instead of calling Stripe.

Nothing else changes for real users. All other Stripe flows (`onboard`, `status`, `webhook`, `finalize-checkout`) are untouched.

## 3. Seed listings (5 per seller)
For `sarahhearn02@gmail.com` and `jcsbhearn@gmail.com`, insert 5 active listings each, mixed across categories already used in the app (Tops, Bottoms, Shoes, Accessories, Outerwear), with brand/size values pulled from existing `brands` rows and your existing size config. Prices $25–$180. Images use `public/placeholder.svg` as a single image per listing (lives in the `listings` storage bucket path you already serve from, or just the public asset URL — whichever is simpler; I'll use the public asset URL to avoid uploading files).

If either seller email doesn't exist in `auth.users`, the migration will raise a clear error and roll back so we don't half-seed.

## 4. Cleanup path (later, one command)
A short note in the migration comments on how to remove everything: delete the reviewer auth user, delete the 10 seeded listings by a tag stored in `description` (e.g. trailing ` [demo]`), unset `REVIEWER_USER_IDS`.

## Technical details
- New migration: creates reviewer auth user + profile, seeds 10 listings tagged `[demo]` in description.
- New secret: `REVIEWER_USER_IDS` (added after migration runs so we know the UUID).
- Edge function edits: `stripe-connect-checkout/index.ts`, `stripe-connect-refund/index.ts`. Redeploy both.
- Frontend edit: `src/pages/CheckoutSuccess.tsx` to handle `?demo=1`.
- No schema changes beyond inserting rows.

## Confirm before I build
1. OK with email `appreview@finditonflea.com` and password `FleaReview2026!`? (Or give me your own.)
2. OK using `public/placeholder.svg` as the demo image, or do you want me to generate 10 simple product images via imagegen and upload them to the `listings` bucket? (Adds ~2 min and credits but looks more realistic to the reviewer.)
