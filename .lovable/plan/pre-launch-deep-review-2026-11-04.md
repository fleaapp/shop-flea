# Pre-launch deep review

## Already started
- Quick security check done: 1 serious item (comments readable by anyone, including hidden/removed ones), 3 medium (public profile list, reviews, waitlist sign-up has no checks), 4 low (brands, regions, countries, listing photo folder listing).
- Database checks: 44 behind-the-scenes actions can be triggered by any user or visitor and need tightening, plus 1 add-on in the wrong place.
- Deep security scan is running now (5-15 min).

## What the review will cover
1. Security - who can read/change what, admin-only actions, login abuse limits, payment and webhook protection.
2. Money - checkout, coupons, fees, offers, refunds, disputes, payouts, double charges, rounding.
3. Status consistency - sold/paused/inactive/blocked items showing the same everywhere (Home, Cart, Wishlist, profiles, search, offers).
4. Orders and shipping - tracking, auto-refund, auto-complete, return flow, reminders.
5. Notifications - alerts, push, emails, app icon badge.
6. Native iPhone - resume, keyboard, login, startup screen, Apple review account.
7. Speed and running costs - image sizes, heavy screens, background jobs.
8. Launch checklist - store listing, privacy policy, terms, support contact.

## Output
- A ranked list: Must fix before launch / Should fix soon / Nice to have, each in plain words with what a user would see.
- Then fix every "Must fix" item, starting with the serious security finding and locking down the 44 open actions without breaking the app.

## Technical details
- Restrict `listing_comments` SELECT to visible listings; review `profiles_public`, `reviews`, `waitlist` insert validation.
- REVOKE EXECUTE from anon/authenticated on cron/trigger/admin SECURITY DEFINER functions; keep client-used RPCs (get_home_feed, create_offer, etc.).
- Audit edge functions for JWT/role checks, idempotency, and cron secret.
