## Apple App Store submission readiness plan

Reviewer-account / Stripe-gating is paused — covered separately. This plan covers everything else to get Flea submission-ready.

---

### 1. Production safety (blockers)

- **`package.json` version** — currently `"0.0.0"`. Bump to `"1.0.0"` (cosmetic but expected).
- **`index.html` version comment** — currently `<!-- v1.1 -->`. Align with the release version.
- **Confirm `CAP_SERVER_URL` is unset** on the machine doing the release build, so the shipped app loads bundled `dist/` instead of Lovable preview. (The gate in `capacitor.config.ts` is already correct — this is a runtime reminder, not a code change.)
- **Dev overlays gated for prod** — confirm `InAppDebugOverlay` and `NetworkLogOverlay` are guarded by `import.meta.env.DEV` or a dev-only flag so they don't ship.

### 2. Sign in with Apple (blocker)

Apple requires Sign in with Apple on any app that offers third-party social login (you have Google). Without it, expect a **Guideline 4.8** rejection.

- Enable Apple provider in Lovable Cloud (Lovable Cloud-managed, no Apple Developer credentials needed unless you want custom branding on the Apple sheet).
- Add an "Sign in with Apple" button on `src/pages/Auth.tsx` matching Apple's HIG (black button, white logo, "Sign in with Apple" text).
- Test the OAuth round-trip in the iOS simulator before archiving.

### 3. Native iOS configuration (blocker — done in Xcode, not Lovable)

After `npx cap add ios`, edit in Xcode:

- **Signing & Capabilities** on the App target:
  - Team: your Apple Developer team
  - Bundle ID: `com.finditonflea.app`
  - Add capabilities: **Push Notifications**, **Background Modes** → "Remote notifications", **Sign in with Apple**
- **General**:
  - Display Name: Flea
  - Version: `1.0.0`
  - Build: `1`
  - Deployment target: iOS 14.0+ (Capacitor minimum)
- **`Info.plist` usage descriptions** (app will crash on permission prompt without these):
  - `NSCameraUsageDescription` — "Flea uses your camera to photograph items you're listing."
  - `NSPhotoLibraryUsageDescription` — "Flea uses your photos to add images to your listings and reviews."
  - `NSPhotoLibraryAddUsageDescription` — "Flea saves order receipts to your photo library."
  - `NSLocationWhenInUseUsageDescription` — "Flea uses your location to verify you're shopping in Australia."

### 4. App icon + launch screen (blocker)

- **App icon set**: drop 1024×1024 PNG (no transparency, no rounded corners) into `ios/App/App/Assets.xcassets/AppIcon.appiconset/`. Xcode 14+ accepts a single 1024 source and generates the rest.
- **Launch screen**: confirm `ios-launch-screen/LaunchScreen.storyboard` is wired in the iOS project — should be automatic via Capacitor splash plugin config you already have.

### 5. App Store Connect listing assets (blocker)

Create the app record in App Store Connect:
- Name: **Flea**, Bundle ID: `com.finditonflea.app`, SKU: `flea-001`, Primary Language: English (AUS)
- **Screenshots** (PNG, no alpha):
  - 6.7" iPhone (1290×2796) — minimum 3, recommend 5
  - 6.5" iPhone (1242×2688) — minimum 3
- **App icon** for the store: 1024×1024
- **Description, keywords, support URL, marketing URL, privacy policy URL**
- **Age rating**: 17+ (mandatory for any app with UGC + messaging)
- **Category**: Shopping (primary), Lifestyle (secondary)
- **Privacy Nutrition Labels** — declare collection of: Email, Name, Photos, Coarse Location, Payment Info, Customer Support (messages), Product Interaction, Crash Data. Mark all as "Linked to user".

### 6. Legal & UGC compliance (blocker for any marketplace)

Apple Guideline 1.2 requires all four for UGC apps — verify each is reachable from every UGC surface:
- ✅ **Report content** — confirm Report button is on listings, profiles, messages, comments
- ✅ **Block users** — confirm Block is on profiles and message threads
- ✅ **Filter content** — your `moderate-content` edge function covers this
- ✅ **Published EULA / Terms** requiring users not to post objectionable content — your Terms page covers this; make sure it's linked from the signup screen

### 7. Build & submit commands

```bash
git pull && npm install
unset CAP_SERVER_URL
npm run build
npx cap add ios        # first time only
npx cap sync ios
npx cap open ios
```

In Xcode:
1. Configure Signing, Capabilities, Info.plist, icons (Section 3 & 4)
2. Run on simulator → smoke-test signup, swipe, cart, message
3. Run on physical iPhone tethered to LTE
4. Device selector → **Any iOS Device (arm64)**
5. **Product → Archive** → **Distribute App → App Store Connect → Upload**
6. In App Store Connect: attach the uploaded build, fill listing (Section 5), submit for review

### 8. Pre-submission smoke test checklist

- Sign in with Apple round-trip works
- Sign in with Google round-trip works
- Camera + photo library prompts appear with your wording
- Push notification permission prompt appears, test push arrives
- Airplane mode → app doesn't crash, shows graceful empty states
- Deep links from push open the correct screen

---

### What Lovable will change in build mode

- `package.json` — version → `1.0.0`
- `index.html` — version comment bump
- `src/pages/Auth.tsx` — add Sign in with Apple button
- Lovable Cloud — enable Apple provider via `configure_social_auth`
- (Optional) verify dev overlays are `import.meta.env.DEV`-gated

### What you'll do outside Lovable

- All Xcode work: Signing, Info.plist, icons, Archive, Upload
- App Store Connect: listing, screenshots, age rating, privacy labels, demo notes
- (Paused) Reviewer account + Stripe-gate workaround

### Out of scope

- Android / Google Play
- Reviewer account creation + Stripe bypass (paused on your request)
- Stripe / PayPal production credential rotation
