# App Store Privacy Questionnaire — Flea

Reference for answering Apple's "Data Collection" privacy questions in App Store Connect. Keep this in sync with `src/pages/PrivacyPolicy.tsx`.

**Q: Do you or your third-party partners collect data from this app?**
Yes.

## Data types to select

### Contact Info
- Name
- Email Address
- Physical Address (shipping address for orders)

### User Content
- Photos or Videos (listing photos, avatars, review photos, refund evidence)
- Customer Support (support chats, contact form submissions, reports)
- Other User Content (listings, messages, comments, reviews)

### Location
- Coarse Location (IP/region detection to confirm Australia)

### Identifiers
- User ID (account ID, username, push notification token stored per user)

### Purchases
- Purchases (order history, cart, wishlist)

### Search History
- Search History (in-app search queries, trending searches)

### Usage Data
- Product Interaction (taps, scrolls, swipes, screen visits)
- Other Usage Data (passed listings, saved searches, onboarding state)

### Sensitive Info
- Government ID (passport or driver's licence photo, only when the payment processor requires additional identity verification for a seller). Captured live in-app, uploaded directly to Stripe via a Lovable Cloud edge function, and never stored on Flea's servers.
- Crash Data
- Performance Data
- Other Diagnostic Data

## Data types NOT selected (and why)

- **Phone Number** — not collected.
- **Payment Info** — Stripe and PayPal handle card/bank numbers outside the app. Flea only receives Stripe Connect / PayPal account IDs and payout metadata, which do not meet Apple's "Payment Info" definition (form of payment, card number, bank account number).
- **Precise Location** — only coarse / IP-based region detection is used.
- **Credit Info / Other Financial Info** — not collected.
- **Health & Fitness** — not applicable.
- **Sensitive Info** — not collected.
- **Contacts** — app does not read the device address book.
- **Emails or Text Messages** — app does not read user email or SMS.
- **Audio Data** — not collected.
- **Gameplay Content** — not applicable.
- **Browsing History** — app does not track websites outside the app.
- **Device ID** — APNs push tokens are stored per `user_id` (see `src/hooks/useNativePushNotifications.ts`) and are not used as a cross-app device identifier; disclosed under User ID instead.
- **Surroundings / Body** — not applicable.

## Third-party partners referenced

Supabase (backend), Stripe (payments/payouts), PayPal (payments/payouts), AfterShip (parcel tracking), Google (sign-in), Resend (transactional email), OpenStreetMap (address lookup), Apple/Google/Mozilla web push services.

## Source of truth

Selections derive from `src/pages/PrivacyPolicy.tsx` sections 2 and 3. Update this file whenever the privacy policy is amended or a new SDK / data field is added.

## ATT / Tracking (NSUserTrackingUsageDescription)

**Current state:** `NSUserTrackingUsageDescription` is removed from `ios/App/App/Info.plist`. Nothing in Flea is "Used for tracking" under Apple's definition. In App Store Connect → App Privacy, every data type's "Used for tracking" toggle stays **off**.

**Rule of thumb:**
- Advertising Flea ON Meta / Google (paid install campaigns) → does **NOT** require ATT or the Info.plist key. Those ads run on Meta/Google's platforms, not inside Flea.
- Showing third-party ads INSIDE Flea (AdMob, Meta Audience Network, etc.) → **does** require ATT.
- Adding an install-attribution SDK (Meta SDK, Google Ads SDK, AppsFlyer, Adjust) to measure which marketing ad caused each install → **does** require ATT.

**Re-enable checklist (only when adding in-app ads or attribution SDKs):**
1. Re-add `NSUserTrackingUsageDescription` to `ios/App/App/Info.plist` with an honest purpose string (e.g. *"We use this to show you more relevant ads inside Flea."* or *"We use this to measure which ads led you to install Flea."*).
2. Install the ATT plugin: `@capacitor-community/app-tracking-transparency`. Call `requestPermission()` once after onboarding — never on first launch.
3. Install and configure the actual ad / attribution SDK.
4. Update `src/pages/PrivacyPolicy.tsx` to disclose the new SDK, what it collects, and that data may be used for tracking.
5. Update this file's "Data types to select" section, and in App Store Connect toggle "Used for tracking" on for the relevant data types (commonly: Device ID / IDFA, Coarse Location, Product Interaction, Advertising Data, Purchases).
6. Submit the new build and the updated App Privacy answers in the **same** review.

