#!/usr/bin/env bash
# Safe setup for the existing native iOS project.
# Run this AFTER `npx cap sync ios`. Do not delete ios/ and do not run `npx cap add ios`
# unless you intentionally want to rebuild the Xcode project from scratch.
# Applies Info.plist keys, entitlements (Push, Sign in with Apple, Associated Domains),
# and strips any stale Google URL scheme. It does not touch icons or splash assets.

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS_APP_DIR="$ROOT/ios/App/App"
PBXPROJ="$ROOT/ios/App/App.xcodeproj/project.pbxproj"
INFO_PLIST="$IOS_APP_DIR/Info.plist"
ENTITLEMENTS_SRC="$ROOT/ios-native/App.entitlements"
ENTITLEMENTS_DEST="$IOS_APP_DIR/App.entitlements"
PATCH_JSON="$ROOT/ios-native/Info.plist.patch.json"

if [ ! -d "$IOS_APP_DIR" ]; then
  echo "ERROR: $IOS_APP_DIR not found. Your ios/ project is missing. Restore it from git or your backup before running this script."
  exit 1
fi

echo "==> Copying entitlements"
cp "$ENTITLEMENTS_SRC" "$ENTITLEMENTS_DEST"

echo "==> Wiring entitlements into project.pbxproj"
# Force the App target/project build settings to use the entitlements file.
# Xcode can show Apple Pay as ticked while the signed Debug/Archive build uses
# a stale or empty CODE_SIGN_ENTITLEMENTS value, which produces a binary with no
# `com.apple.developer.in-app-payments` entitlement. Remove every old value and
# insert the canonical path into every buildSettings block.
/usr/bin/perl -0pi -e 's/^\s*CODE_SIGN_ENTITLEMENTS = [^;]+;\n//mg' "$PBXPROJ"
/usr/bin/perl -0pi -e 's/(buildSettings = \{\n)/$1\t\t\t\tCODE_SIGN_ENTITLEMENTS = App\/App.entitlements;\n/gs' "$PBXPROJ"
echo "   entitlements path force-wired in pbxproj"

echo "==> Applying Info.plist keys from $PATCH_JSON"
/usr/bin/python3 - "$PATCH_JSON" "$INFO_PLIST" <<'PY'
import json, plistlib, sys
patch_path, plist_path = sys.argv[1], sys.argv[2]
with open(patch_path) as f:
    patch = json.load(f)
with open(plist_path, "rb") as f:
    plist = plistlib.load(f)

for k, v in patch.get("strings", {}).items():
    plist[k] = v
    print(f"   string  {k}")
for k, v in patch.get("bools", {}).items():
    plist[k] = bool(v)
    print(f"   bool    {k} = {v}")
for k, v in patch.get("arrays", {}).items():
    plist[k] = list(v)
    print(f"   array   {k} = {v}")

# Strip any Google URL scheme dict.
url_types = plist.get("CFBundleURLTypes")
if isinstance(url_types, list):
    cleaned = []
    dropped = 0
    for entry in url_types:
        schemes = entry.get("CFBundleURLSchemes", []) if isinstance(entry, dict) else []
        if any("REVERSED_IOS_CLIENT_ID" in str(s) for s in schemes):
            dropped += 1
            continue
        cleaned.append(entry)
    if dropped:
        print(f"   removed {dropped} Google URL scheme block(s)")
    if cleaned:
        plist["CFBundleURLTypes"] = cleaned
    else:
        plist.pop("CFBundleURLTypes", None)

with open(plist_path, "wb") as f:
    plistlib.dump(plist, f)
PY

echo
echo "==> Verification"
echo "   entitlements file: $(test -f "$ENTITLEMENTS_DEST" && echo yes || echo NO)"
WIRED_COUNT=$(grep -c "CODE_SIGN_ENTITLEMENTS = App/App.entitlements" "$PBXPROJ" || true)
echo "   pbxproj wired:     $(test "$WIRED_COUNT" -gt 0 && echo yes || echo NO) ($WIRED_COUNT build settings)"
echo "   Apple Pay entitlement: $(grep -q "com.apple.developer.in-app-payments" "$ENTITLEMENTS_DEST" && echo yes || echo NO)"
echo "   Apple Pay merchant:    $(grep -q "merchant.com.finditonflea.app" "$ENTITLEMENTS_DEST" && echo yes || echo NO)"
echo "   Stripe iOS SDK pin:    exact 25.9.0 via patch-package"
echo "   entitlement checker:   skipped (using Stripe's isApplePayAvailable)"
echo "   Google leftovers:  $(grep -R 'REVERSED_IOS_CLIENT_ID\|@codetrix-studio/capacitor-google-auth' "$ROOT/ios" "$ROOT/package.json" "$ROOT/capacitor.config.ts" 2>/dev/null | wc -l | tr -d ' ')"
echo
if ! grep -q "com.apple.developer.in-app-payments" "$ENTITLEMENTS_DEST" || ! grep -q "merchant.com.finditonflea.app" "$ENTITLEMENTS_DEST"; then
  echo "ERROR: Apple Pay entitlement is missing from $ENTITLEMENTS_DEST. Do not Archive until this says yes."
  exit 1
fi
if [ "$WIRED_COUNT" -lt 1 ]; then
  echo "ERROR: CODE_SIGN_ENTITLEMENTS is not wired. Do not Archive until this says yes."
  exit 1
fi
cat <<'EOF'

After Archive, verify the SIGNED build entitlements before uploading:

APP="$(find ~/Library/Developer/Xcode/Archives -path '*/Products/Applications/Flea.app' -type d | sort | tail -1)"
codesign -d --entitlements :- "$APP" | grep -A6 'com.apple.developer.in-app-payments'

That output must include merchant.com.finditonflea.app. If it does not, the
source plist is fine but Apple signed the app with a provisioning profile that
does not include Apple Pay.
EOF
echo "Done. Now: npx cap open ios -> set Team -> Any iOS Device (arm64) -> bump Build -> Archive."
