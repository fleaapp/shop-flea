## Fix native notification permission handling

**Root causes (confirmed):**

1. **Settings toggle** (`src/pages/Settings.tsx` lines 60-86) uses only the web `Notification` API. In the Capacitor iOS WebView `Notification` is undefined, so the toggle always reports "not supported in this browser" and can never reflect or change native APNs permission.
2. **Alerts / passive banner** — `getPushPermission()` in `src/lib/pushPrompt.ts` hardcodes `'default'` on any native platform. So even after the user grants iOS push permission (via the native prompt or via the branded sheet), `shouldShowPushPrompt` still returns true and the "Turn on notifications" banner keeps appearing on the Alerts screen.

### Changes

**1. `src/lib/pushPrompt.ts`** — add an async native-aware permission resolver alongside the existing sync one:
- New `getPushPermissionAsync()`: on native iOS/Android calls `PushNotifications.checkPermissions()` and maps `receive` → `'granted' | 'denied' | 'default'`. On web falls back to `Notification.permission` (or `'unsupported'`).
- New `shouldShowPushPromptAsync(userId, source)`: same rules as `shouldShowPushPrompt`, but awaits the real permission. Keep the sync version for any non-critical callers, but treat native `'default'` as "unknown, check async".

**2. `src/components/EnablePushBanner.tsx`** — replace the sync check with `shouldShowPushPromptAsync` inside the effect so the banner is hidden when iOS already granted permission. Also re-check when the app returns to the foreground (`Capacitor App` `appStateChange` listener) so granting permission from iOS Settings hides the banner without a restart.

**3. `src/components/OnboardingComplete.tsx` + `src/components/SellerOnboardingSheet.tsx`** — swap the same sync call for the async version so post-onboarding / post-verification prompts don't re-appear after native permission is already granted.

**4. `src/pages/Settings.tsx` notifications toggle** — native-aware:
- On mount and on `appStateChange`, resolve state via `getPushPermissionAsync()` and set the toggle accordingly.
- `handleToggleNotifications(true)`:
  - Native: call `PushNotifications.requestPermissions()`; if `granted`, `PushNotifications.register()` and call `triggerSubscribe()` for the DB row. If `denied`, toast "Notifications blocked. Enable them in iOS Settings → Flea".
  - Web (existing behaviour): keep current path but only show the "not supported" toast when truly on web without `Notification`.
- `handleToggleNotifications(false)`:
  - Native: toast "To disable notifications, open iOS Settings → Flea → Notifications." (already can't revoke programmatically).
  - Web: unchanged.

No schema, edge function, or copy changes needed beyond the toggle's toast wording. This closes both reported issues: the toggle works on iOS, and the Alerts banner hides once native permission is already granted.