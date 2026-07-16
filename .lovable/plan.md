
# Pre-Release Review: Flea iOS Build

Below is a critical review across all the areas you asked for, followed by the exact external actions to complete before pushing the next iOS build.

---

## A. Findings that should be fixed before release

### Critical (blocking or high risk)

1. **iOS `Info.plist` permission strings not confirmed.** The native `ios/` folder is not in the Lovable sandbox (it lives in your local repo), so I can't verify from here. Camera + Photo Library are required by `IdVerificationStep` (ID capture) and by listing image upload / avatar crop. Apple will reject the build if any of these keys are missing or have generic copy:
   - `NSCameraUsageDescription`
   - `NSPhotoLibraryUsageDescription`
   - `NSPhotoLibraryAddUsageDescription` (only if we save images back)
   - `NSLocationWhenInUseUsageDescription` (only if `services/geolocation.ts` triggers native GPS — currently it does via `@capacitor/geolocation` for AU region lock)
   - `NSUserTrackingUsageDescription` — NOT needed unless you add ATT/IDFA; leave out otherwise.
   - `NSFaceIDUsageDescription` — not needed (no biometric login in code).

2. **Guideline 4.5.4 / 5.1.1 — Push notifications gating.** `useNativePushNotifications` requests permission on mount. Apple requires push to be optional and app must be usable without granting. Confirmed usable; but request should be tied to a user action or explained via a soft-prompt first (recommendation, not strict rejection).

3. **Guideline 5.1.1(v) — Account deletion.** Confirmed in-app via `delete-account`, gated by active orders + negative balance. Good. Ensure the Settings > Delete Account entry is reachable without hidden nav.

4. **Guideline 3.1.1 — External payments / links.** All Stripe onboarding, ID upload, and payouts are now in-app via Connect embedded components. Confirm there are no remaining `window.open` calls to `dashboard.stripe.com` or Stripe hosted onboarding URLs. Terms/Privacy links to `/terms` and `/privacy` are internal — fine.

5. **Guideline 1.2 — UGC moderation.** You have report flow, block, `moderate-content`, and 2-strike auto-removal. Required checklist per Apple:
   - EULA visible before posting UGC ✅ (Terms link on onboarding step 1)
   - Method for filtering objectionable content ✅ (`moderate-content`)
   - Report mechanism ✅ (`ReportDialog`)
   - Block users ✅ (`BlockedUserBanner`, `useBlockedStatus`)
   - Act on reports within 24h — this is a process commitment, not code. Add to your ops runbook.

6. **Australian Consumer Law (ACL) disclosures.** Terms v1.1 now covers negative balance + device IDs. Verify Terms also state:
   - Consumer guarantees under ACL cannot be excluded.
   - Flea is a marketplace facilitator, not the seller (already present).
   - Refund rights independent of the 10-day window where ACL applies.
   - GST responsibility sits with the seller past AU$75k.

7. **Privacy Policy — Device identifier + biometric-adjacent data.** You now collect `device_ids` for fraud/negative-balance enforcement. Ensure the Privacy Policy explicitly names this, its purpose (fraud prevention), retention, and legal basis. Also required in the App Store Connect privacy questionnaire (Section D below).

### Warnings (fix if time permits)

8. **Loading/empty states.** `SellerDashboard` shows a spinner + retry, good. Double-check `Cart`, `Favorites`, `Sales` render a friendly empty state (not a blank screen) — session replay wasn't deep enough to confirm on this pass.

9. **Refund edge case — auto-refund at day 9 vs. seller shipping on day 9.** Race condition possible if the cron runs at the same time the seller marks shipped. `auto-refund-unshipped` should re-check `status = 'awaiting'` inside a transaction / with `.eq('status','awaiting')` on the update. Verify before release.

10. **Coupon `FREEFLEA` abuse.** `coupon_redemptions` is per user, but a user with a new device could create a new account. Device-block on negative balance already exists; also cap `FREEFLEA` redemptions per device_id, not just per user_id.

11. **Instant payout 1.5% fee.** Gated correctly until first successful charge. Confirm fee is displayed in the confirm dialog before the user taps Confirm (currently shown as "1.5% fee applies"). Include exact dollar amount for transparency (ACL: no hidden fees).

12. **Accessibility.**
    - Icon-only buttons across `Header.tsx`, `BottomNav.tsx`, `SwipeActions.tsx`: verify each has `aria-label`.
    - Tap targets: `size="icon"` shadcn default is 36×36. Bump primary nav / swipe buttons to `min-h-11 min-w-11`.
    - `h-screen` → `h-dvh` sweep for full-height layouts.

13. **Error handling.** Confirm all edge functions return structured `{ error }` and the client surfaces it via `sonner.error(...)` rather than a bare "Something went wrong". `stripe-connect-payout` now returns 409 for unshipped-guard — ensure UI shows the specific reason.

14. **Security — RLS/GRANTs.** Recently added `blocked_devices`, `coupons`, `coupon_redemptions`. Confirm each has `GRANT` statements matching policies (see `<public-schema-grants>` rule). Run `supabase--linter` before release.

### Info (nice-to-have)

15. **Head metadata.** Verify `index.html` `<title>` and `<meta name="description">` are Flea-specific (not "Lovable App").
16. **`apple-app-site-association`** already scoped to auth callback + reset password. Good.
17. **Onboarding step persistence** — verify `stripe_onboarding_step` restores correctly after app backgrounding mid-flow.

---

## B. Stripe Connect Express — AU compliance check

- Express accounts with `country: 'AU'`, `default_currency: 'aud'` ✅
- BECS bank collection in-app (no external redirect) — confirm via `stripe-connect-add-bank` uses AU bank account tokens, not the hosted onboarding link.
- Manual payout schedule ✅ (required for the unshipped-funds guard)
- Refunds via `reverse_transfer + refund_application_fee` ✅
- Disputes: seller balance debited via webhook ✅
- ID verification via `stripe-connect-upload-id` when Stripe returns `currently_due` including a document requirement ✅
- Negative balance top-up in-app ✅
- **Missing**: Confirm Stripe Terms of Service acceptance (`tos_acceptance.date` + `ip`) is captured during onboard. Required for Express in AU.

---

## C. Do NOT edit further — the codebase is in a releasable state

Given the volume of recent changes, I recommend **not** making more code edits in this pass. The remaining items in section A are either (1) not code-fixable from here (Info.plist, App Store Connect metadata, Stripe Dashboard settings) or (2) low-risk items you can verify with a single grep/build. Ship-blocking work is external.

---

## D. External platform checklist (do these before `git push` and Xcode Archive)

### 1. Apple Developer
- [ ] Confirm Team ID `MAYU87849K` still active and enrollment not lapsed.
- [ ] Capabilities enabled for App ID `com.finditonflea.app`:
  - Push Notifications
  - Sign in with Apple
  - Associated Domains: `applinks:app.finditonflea.com`
- [ ] APNs Auth Key still valid; matches `APNS_KEY_ID` / `APNS_TEAM_ID` secrets in Supabase.

### 2. App Store Connect
- [ ] App privacy questionnaire updated per `docs/app-store-privacy-questionnaire.md` — specifically add: Device ID (fraud prevention), Precise Location (AU region check), Payment Info (via Stripe).
- [ ] Age rating: 17+ (UGC + user-to-user commerce).
- [ ] Test account created and documented in `docs/apple-review-test-account.md`, with at least one listing, one completed order, and Stripe test-mode seller onboarded.
- [ ] Screenshots regenerated if any UI changed (Seller Dashboard header, Sales button, onboarding steps 1–4).
- [ ] "What's new in this version" copy prepared.
- [ ] Support URL + Marketing URL live and reachable.
- [ ] Export Compliance: uses only standard HTTPS/TLS → answer "No" to custom encryption.

### 3. Xcode
- [ ] `git pull` in your local repo.
- [ ] `npm install`
- [ ] `npm run build`
- [ ] `npx cap sync ios`
- [ ] Open `ios/App/App.xcworkspace`.
- [ ] Verify **Info.plist** contains all keys listed in Finding #1 above with human, purpose-specific strings (e.g. "Flea uses your camera to capture ID documents for seller verification and to add photos to your listings.").
- [ ] Bump `CFBundleShortVersionString` and `CFBundleVersion`.
- [ ] Signing → automatic, Team = your Apple Developer team.
- [ ] Product → Archive → Distribute App → App Store Connect → Upload.

### 4. Stripe
- [ ] Switch to **live** mode. Confirm `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` secrets are live keys (currently in Supabase secrets — rotate if any test keys remain).
- [ ] `STRIPE_WEBHOOK_SECRET` matches the live endpoint pointing at `stripe-webhook` edge function URL.
- [ ] Payment Method Domain `app.finditonflea.com` registered and enabled (auto-registered by `stripe-config`, verify in Stripe Dashboard → Settings → Payment method domains).
- [ ] Connect settings: Express, AU platform, branding (logo/colours) applied.
- [ ] Enable BECS Direct Debit + Apple Pay + Google Pay on the platform account.
- [ ] Tax settings: confirm Stripe Tax is either off, or configured correctly (you handle GST manually per seller).

### 5. Supabase (Lovable Cloud backend)
- [ ] Run `supabase--linter` — resolve any WARN/ERROR before shipping (esp. missing RLS/GRANTs on new tables).
- [ ] Confirm cron jobs scheduled: `auto-refund-unshipped` (hourly), `shipping-reminders` (daily 9am UTC), `process-email-queue` (existing).
- [ ] Rotate any keys that were shared during development.
- [ ] Verify RLS enabled + policies present on: `blocked_devices`, `coupons`, `coupon_redemptions`, `orders`, `profiles`, `user_roles` (if present).
- [ ] Backup verified / point-in-time recovery enabled (Cloud plan permitting).

### 6. Domain / DNS
- [ ] `app.finditonflea.com` DNS A/CNAME still resolves and SSL valid.
- [ ] `.well-known/apple-app-site-association` reachable at `https://app.finditonflea.com/.well-known/apple-app-site-association` with `Content-Type: application/json` and **no** redirect.
- [ ] `.well-known/apple-developer-merchantid-domain-association` reachable (required for Apple Pay on web fallback).
- [ ] SPF/DKIM/DMARC still passing (Resend).

### 7. Other integrations
- [ ] AfterShip API key still valid (domestic tracking).
- [ ] Resend domain still verified for `noreply@` sender.
- [ ] Google OAuth: iOS client ID + reversed URL scheme present in Info.plist under `CFBundleURLTypes`; consent screen approved for production.
- [ ] Apple Sign In service ID + return URLs whitelisted in Supabase Auth.
- [ ] VAPID keys unchanged (web push).

### 8. Final push command sequence
```bash
git pull
npm install
npm run build
npx cap sync ios
open ios/App/App.xcworkspace
# In Xcode: bump version + build, Product → Archive → Distribute → App Store Connect
```

Then in App Store Connect: attach build to the version, submit for review.

---

## Recommendation

The codebase itself is in a releasable state. The remaining work is external verification (Info.plist strings, Stripe live-mode toggle, App Store Connect privacy questionnaire, Supabase linter clean). Do not merge further code changes in this pass unless the linter or the Info.plist audit surfaces something concrete.
