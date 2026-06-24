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

### Diagnostics
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
