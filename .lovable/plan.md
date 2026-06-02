## Plan: pre-submission deploy work I can do for you

I'll handle everything that lives in code or in the Lovable Cloud project. At the end I'll hand you a clean checklist of items that only you can do (Xcode, App Store Connect, Stripe/PayPal live cutover, APNs upload, TestFlight).

### 1. Audit native auth wiring
- Verify `nativeAppleSignIn` is invoked from `Auth.tsx` on iOS native and falls back to web OAuth elsewhere
- Confirm Google sign-in path works alongside Apple (no double-trigger, no missing nonce)
- Confirm `ProviderConflictDialog` fires correctly after the new Apple native path (post-callback guard + pre-check both apply)

### 2. Account deletion end-to-end check
- Re-read `delete-account` edge function + Settings entry point
- Confirm 14-day cooldown + active-order gate are enforced
- Confirm cascade: listings archived, cart/favorites/discards cleared, auth user removed
- Confirm UI sign-out + redirect after success

### 3. App Privacy data-collection audit (for App Store Connect questionnaire)
Scan the codebase for everything actually collected and produce a ready-to-paste table covering, per Apple's categories:
- Contact info (email, name)
- User content (photos, messages, reviews, listings)
- Identifiers (user id, device id, push token)
- Location (coarse, region detection)
- Financial info (handled by Stripe/PayPal — disclosed as "not collected by us")
- Diagnostics (logs, crash data)
For each: linked to user? used for tracking? purpose?

### 4. App Store review-blocker audit
- `capacitor.config.ts` — confirm bundle id, no leftover `server.url` pointing to sandbox for production builds (flag if present, give you the toggle)
- `Info.plist`-equivalent strings via Capacitor: camera, photo library, location, push, Apple sign-in entitlement, ATS
- Deep links: scan for any `lovableproject.com` / preview URLs hardcoded in user-visible flows
- Reject-risk copy: scan for any user-facing strings mentioning "Stripe" / "Supabase" (memory rule)
- Confirm Privacy Policy + Terms reachable from Auth screen and Settings (required for sign-in with Apple + App Store)

### 5. Settings / Auth surface for legal links
- Add Privacy Policy + Terms links to the Auth screen footer (currently only in Settings) — Apple requires both reachable before account creation
- Confirm both pages render standalone (no auth required) so the reviewer can open them

### 6. Push notification client-side readiness
- Verify `usePushNotifications` + `PushNotificationSubscriber` register a token on iOS native, persist to `push_subscriptions`, and renew on remount (per memory)
- Verify `send-push-notification` edge function reads APNs key from secrets (so it works the moment you upload the key in Lovable Cloud) — flag the exact secret name to add

### 7. Stripe / PayPal live-cutover prep
- Audit edge functions for any hardcoded `test` mode assumptions
- Confirm webhook handlers verify signatures and tolerate live event ids
- Produce the exact secret names you'll update (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET_KEY`) and the webhook URLs to paste into Stripe/PayPal live dashboards

### 8. Smoke-test prep (web preview)
- Run the full path in preview and report breakages: signup → email verify → onboarding → create listing → checkout (test) → message seller → leave review
- Anything broken gets fixed in the same pass

### Deliverables at the end
- All code edits applied
- One markdown checklist of remaining items only you can do, grouped: **Local machine (Xcode/cap sync)**, **App Store Connect**, **Stripe dashboard**, **PayPal dashboard**, **Lovable Cloud secrets**, **TestFlight**

### Out of scope (your side)
- `npx cap sync ios`, `pod install`, Xcode build & device test
- App Store Connect: privacy URL field, reviewer demo account, screenshots, App Privacy submission
- Generating live Stripe/PayPal keys (I'll swap secrets once you paste them)
- Uploading APNs key in Lovable Cloud
- TestFlight upload + submission

Approve and I'll start with sections 1–5 in parallel (read-heavy, no DB changes), then 6–8.