# App Store Privacy Questionnaire selections

## What to select in App Store Connect

For Flea, select the following data types in the "Data Collection" section:

### Contact Info
- Name
- Email Address
- Physical Address

### User Content
- Photos or Videos
- Customer Support
- Other User Content

### Location
- Coarse Location

### Identifiers
- User ID

### Purchases
- Purchases

### Search History
- Search History

### Usage Data
- Product Interaction
- Other Usage Data

### Diagnostics
- Crash Data
- Performance Data
- Other Diagnostic Data

## What NOT to select

- **Phone Number** — not collected.
- **Payment Info** — Stripe handles card/bank numbers outside the app; Flea only receives Stripe Connect account IDs and payout metadata, which do not fit Apple's "Payment Info" definition.
- **Precise Location** — only coarse/IP-based location is used for Australia region detection.
- **Financial Info** (Credit Info, Other Financial Info) — not collected.
- **Health & Fitness** — not applicable.
- **Sensitive Info** — not collected.
- **Contacts** — app does not read the user's contacts.
- **Emails or Text Messages** — app does not read user's email/SMS.
- **Audio Data** — not collected.
- **Gameplay Content** — not applicable.
- **Browsing History** — app does not track websites outside the app.
- **Device ID** — push tokens are stored per-user and are not used as a cross-app device identifier; disclose under User ID instead.

## Rationale

Selections are derived from `src/pages/PrivacyPolicy.tsx` sections 2 ("What personal information we collect") and 3 ("How we collect personal information").

## Implementation

Create `docs/app-store-privacy-questionnaire.md` containing this mapping so future App Store updates stay consistent.