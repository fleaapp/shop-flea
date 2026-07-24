# Fix: Review submission + iOS keyboard black area

## 1. "Modification of protected profile fields is not allowed" on Submit Review

**Root cause (confirmed by reading migrations):**
- `public.update_user_rating()` is a `SECURITY DEFINER` trigger on `reviews` (insert/update/delete) that writes `rating` and `total_reviews` on `profiles`.
- `public.profiles_update_guard()` blocks any change to `rating` / `total_reviews` unless `auth.role() = 'service_role'`.
- In a `SECURITY DEFINER` function called from a signed-in client, `auth.role()` is still `'authenticated'`, so the guard fires and the whole review insert is rolled back.

**Fix (single migration):**
- At the top of `public.update_user_rating()`, set a transaction-local flag:
  `PERFORM set_config('app.bypass_profile_guard', 'on', true);`
- In `public.profiles_update_guard()`, add an early return when `current_setting('app.bypass_profile_guard', true) = 'on'`, in addition to the existing `service_role` bypass.
- Rating/total_reviews stay protected against direct client writes; only the trigger flow (and service role) can update them.

No client code changes required. `useReviews.useCreateReview` payload stays as-is.

## 2. Black area around the keyboard on native iOS

**Root cause:**
- `capacitor.config.ts` currently sets `Keyboard.resize: None` and `ios.backgroundColor: '#F4F2EB'` (cream). With `contentInset: 'never'`, when the keyboard opens WKWebView's default keyboard avoidance briefly exposes the native window background. Screens with a non-cream background (drawers over dark backdrop, lime auth) show that as a dark/mismatched strip.
- Setting a single hex `ios.backgroundColor` can never match every route (lime auth, cream app, dark drawer backdrops).

**Fix:**
- Make the native surfaces transparent so whatever the page/drawer is rendering shows through around the keyboard:
  - `capacitor.config.ts` → `ios.backgroundColor: '#00000000'` (transparent).
  - Patch `ios-native/App/App/AppDelegate.swift` (or `ViewController.swift`, whichever the project uses — will confirm on read) via our existing `scripts/patch-native-capacitor-packages.mjs` pattern to set:
    - `webView.isOpaque = false`
    - `webView.backgroundColor = .clear`
    - `webView.scrollView.backgroundColor = .clear`
    - `view.backgroundColor = .clear` on the bridge view controller
  - Keep `Keyboard.resize: None` so inputs don't jump (as fixed previously) and rely on the drawer/page's own background to fill the area behind/around the keyboard.
- Re-verify on both a cream in-app screen (Write Review) and the lime Auth screen after rebuild.

## Technical notes

- Migration is idempotent (`CREATE OR REPLACE FUNCTION` for both functions).
- `set_config(..., true)` scopes the flag to the current transaction, so it can't leak across requests.
- Native transparency change requires `npx cap sync ios` + Xcode rebuild / TestFlight push to take effect; nothing to test in the web preview.

## Files touched

- New Supabase migration (guard + rating function).
- `capacitor.config.ts` (ios.backgroundColor → transparent).
- Native iOS bridge view controller patch (added to existing patch script).
