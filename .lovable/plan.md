# Push Notifications Opt-In Flow

Push subscription today runs silently on mount via `PushNotificationSubscriber`, which calls `Notification.requestPermission()` (web) or APNs `requestPermissions()` (iOS native) the first time the app loads. That's a one-shot system prompt with no context — if the user taps "Don't Allow" it's very hard to recover. We'll add branded pre-prompts at high-intent moments so the system dialog only fires after the user has said yes in our UI, and we'll re-prompt if they missed it.

## Where we'll prompt

1. **After buyer onboarding** — in `OnboardingComplete.tsx`, after the user taps "Get Started". Instead of dismissing straight to the feed, show a Flea-branded sheet explaining push value, then trigger the OS prompt.
2. **After seller verification** — in `SellerOnboardingSheet.tsx`, once Stripe returns `verified` (final success step), show the same sheet with seller-focused copy ("Get notified the moment someone buys, messages, or leaves a review").
3. **Passive re-prompt** — a soft banner on the Alerts tab and Seller Dashboard if `Notification.permission === 'default'` and the user has dismissed the sheet once. Never nag more than once every 7 days; stop after 3 total dismissals.

## New component: `PushPermissionSheet`

A Vaul drawer matching existing Flea sheet style (top-10, rounded-2xl, lime primary button).

Contents:
- 🔔 large emoji header
- Title: "Turn on notifications"
- Body (contextual per surface):
  - Buyer: "Get notified when items you love drop in price, sell out, or when a seller replies."
  - Seller: "We'll ping you the moment you make a sale, get a message, or receive a review."
- Primary CTA "Turn on" → calls the existing `triggerSubscribe` (web) or `PushNotifications.requestPermissions` + `register()` (native).
- Secondary "Not now" → dismiss, record timestamp.

Native iOS: if `Notification`/APNs permission is already `denied`, replace CTA with "Open Settings" and use `App.openSettings()` (Capacitor App plugin) or `NativeSettings` — for now show copy "Enable in Settings → Flea → Notifications" with a button that calls `Capacitor` app open settings if available, else copy only.

## Refactor push hooks

- Split "register" from "auto-run". Today `usePushNotifications` auto-subscribes on mount and `useNativePushNotifications` auto-registers. Change both to expose an imperative `requestAndSubscribe()` and only auto-run if `Notification.permission === 'granted'` (already opted in — re-sync token). This prevents the silent system prompt on first load and lets our branded sheet drive it.
- Keep `PushNotificationSubscriber` mounted globally to handle the "already granted → refresh token" path.

## State tracking

Add `localStorage` keys scoped per user:
- `flea_push_prompt_dismissed_at_${userId}`
- `flea_push_prompt_dismiss_count_${userId}`
- `flea_push_prompted_source_${userId}` (buyer_onboarding | seller_verified | passive)

A small helper `shouldShowPushPrompt(userId)` returns true when permission is `default` and dismissal cooldown/limit hasn't been hit.

## Wiring

- `OnboardingComplete.tsx`: on "Get Started", set onboarding complete, then open `PushPermissionSheet` with `source="buyer_onboarding"` (only if permission is `default`). Sheet close finishes the flow.
- `SellerOnboardingSheet.tsx`: on the final "Verified" success step, after user taps "Done", show the sheet with `source="seller_verified"`.
- `Alerts` page + `SellerDashboard`: mount a dismissible inline banner ("🔔 Turn on notifications") that opens the same sheet when `shouldShowPushPrompt` is true.

## Technical notes

- No backend changes — subscription table and edge functions already handle both APNs and web push.
- Do not fire OS prompt inside async chains without user gesture on web; the sheet's "Turn on" button is a direct user gesture, satisfying browser requirements.
- Keep copy in one place (`src/lib/pushPromptCopy.ts`) so buyer/seller/passive variants stay consistent.
- No em dashes; trailing full stops per project standard.

## Files touched

- New: `src/components/PushPermissionSheet.tsx`, `src/lib/pushPrompt.ts` (state + copy).
- Edit: `src/hooks/usePushNotifications.ts`, `src/hooks/useNativePushNotifications.ts` (imperative mode).
- Edit: `src/components/OnboardingComplete.tsx`, `src/components/SellerOnboardingSheet.tsx`.
- Edit: `src/pages/Alerts.tsx` (or existing alerts component) and `src/pages/SellerDashboard.tsx` for passive banner.

Nothing outside frontend/presentation code changes.