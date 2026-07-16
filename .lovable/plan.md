
## 1. One-shot terminal command (run in your local repo root on your Mac)

This patches `ios/App/App/Info.plist` with Flea-specific permission strings, bumps the marketing version and build number, syncs Capacitor, and opens Xcode. Copy-paste as-is.

```bash
set -e
cd ~/path/to/flea            # <-- change to your local project path
git pull

PLIST="ios/App/App/Info.plist"
PB="/usr/libexec/PlistBuddy"

# --- Permission strings (Set if present, Add if missing) ---
add_or_set () {
  KEY="$1"; VAL="$2"
  $PB -c "Set :$KEY $VAL" "$PLIST" 2>/dev/null || \
  $PB -c "Add :$KEY string $VAL" "$PLIST"
}

add_or_set NSCameraUsageDescription \
  "Flea uses your camera to capture ID documents for seller verification and to take photos for your listings, avatar, and reviews."

add_or_set NSPhotoLibraryUsageDescription \
  "Flea accesses your photo library so you can add photos to your listings, profile avatar, and reviews."

add_or_set NSPhotoLibraryAddUsageDescription \
  "Flea saves order receipts and shared listing images to your photo library when you choose to save them."

add_or_set NSLocationWhenInUseUsageDescription \
  "Flea uses your location once to confirm you are in Australia. Flea is only available to Australian buyers and sellers."

# Remove tracking key if it was ever added — we do NOT track under Apple's definition.
$PB -c "Delete :NSUserTrackingUsageDescription" "$PLIST" 2>/dev/null || true

# --- Version bump ---
# Marketing version: bump patch by 1 (e.g. 1.4.2 -> 1.4.3). Edit manually if you want minor/major.
CUR_VER=$($PB -c "Print :CFBundleShortVersionString" "$PLIST")
NEW_VER=$(echo "$CUR_VER" | awk -F. '{ $NF = $NF + 1 } 1' OFS=.)
$PB -c "Set :CFBundleShortVersionString $NEW_VER" "$PLIST"

# Build number: bump by 1.
CUR_BUILD=$($PB -c "Print :CFBundleVersion" "$PLIST")
NEW_BUILD=$((CUR_BUILD + 1))
$PB -c "Set :CFBundleVersion $NEW_BUILD" "$PLIST"

echo "Version: $CUR_VER -> $NEW_VER   Build: $CUR_BUILD -> $NEW_BUILD"

# --- Build & sync ---
npm install
npm run build
npx cap sync ios

open ios/App/App.xcworkspace
```

Then in Xcode: Product → Archive → Distribute App → App Store Connect → Upload.

If your current build number isn't numeric, edit that line to `NEW_BUILD="<n>"` manually. If `PlistBuddy` complains about a missing key, the `Add` fallback handles it.

---

## 2. App Store Connect privacy questionnaire — exact clicks

Sign in at https://appstoreconnect.apple.com → **My Apps** → **Flea** → left sidebar **App Privacy** → click **Edit** next to "Data Types".

You'll be walked through each category. Answer exactly as below (matches `docs/app-store-privacy-questionnaire.md`).

**Do you or your third-party partners collect data from this app?** → **Yes, we collect data from this app**.

For every data type below, when prompted:
- **Linked to the user?** → **Yes** (unless noted).
- **Used for tracking?** → **No** (for every single one — we do not run ads or attribution SDKs).
- **Purposes** → tick only the ones listed.

### Contact Info
- **Name** — App Functionality, Product Personalization.
- **Email Address** — App Functionality, Product Personalization, Customer Support.
- **Physical Address** — App Functionality (shipping).

### User Content
- **Photos or Videos** — App Functionality.
- **Customer Support** — Customer Support.
- **Other User Content** — App Functionality.

### Location
- **Coarse Location** — App Functionality (AU region check). Linked: **Yes**. Tracking: **No**.
- Do **NOT** tick Precise Location.

### Identifiers
- **User ID** — App Functionality, Product Personalization, Analytics, Fraud Prevention/Security. Linked: **Yes**. Tracking: **No**.
- Do **NOT** tick Device ID (our device identifier is a first-party fraud-prevention ID linked to the user account, disclosed under User ID; it is not IDFA and is not used for tracking).

### Purchases
- **Purchase History** — App Functionality.

### Search History
- **Search History** — App Functionality, Analytics.

### Usage Data
- **Product Interaction** — Analytics, Product Personalization.
- **Other Usage Data** — Analytics.

### Diagnostics
- **Crash Data** — App Functionality, Analytics.
- **Performance Data** — App Functionality, Analytics.
- **Other Diagnostic Data** — App Functionality.

### Sensitive Info
- Tick **Sensitive Info** and describe: "Government ID (passport or driver's licence) captured only when the payment processor requires additional identity verification for a seller. Uploaded directly to Stripe; not stored on Flea servers." — App Functionality, Fraud Prevention/Security. Linked: **Yes**. Tracking: **No**.

### NOT selected (make sure these stay unticked)
Phone Number, Payment Info, Precise Location, Credit Info, Other Financial Info, Health, Fitness, Contacts, Emails or Text Messages, Audio Data, Gameplay Content, Browsing History, Device ID, Surroundings, Body Data, Advertising Data.

Click **Save** at the top right of the App Privacy screen.

### Then, in the same App Store Connect visit
1. **App Information** (left sidebar) → confirm **Category** = Shopping, **Content Rights** = you have all rights, **Age Rating** → Edit → answer up to 17+ (user-generated content + user-to-user commerce).
2. **Pricing and Availability** → Australia only.
3. **App Review Information** → confirm the test account in `docs/apple-review-test-account.md` is pasted here with a note explaining Stripe test-mode seller onboarding.
4. Left sidebar under the new version (e.g. **1.4.3 Prepare for Submission**):
   - **What's New in This Version** — write release notes.
   - **Build** — click **+ Select a build** once Xcode's upload finishes processing (10-30 min).
   - **Export Compliance** → **Does your app use encryption?** → **Yes** → **Does your app qualify for the exemptions...?** → **Yes** (standard HTTPS/TLS only).
5. Click **Add for Review** → **Submit to App Review** at the top right.

---

## 3. What this plan does NOT change

No source files under `src/`, `supabase/`, or docs are touched. The only file mutated on your machine is `ios/App/App/Info.plist`, plus the Xcode-generated `ios/App/Podfile.lock` and `ios/App/App/public/` bundle refreshed by `npx cap sync`. Everything else is external configuration in App Store Connect.
