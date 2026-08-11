#!/usr/bin/env bash
# Safe setup for the existing native iOS project.
# Run this AFTER `npx cap sync ios`. Do not delete ios/ and do not run `npx cap add ios`
# unless you intentionally want to rebuild the Xcode project from scratch.
# Applies Info.plist keys, entitlements (Push, Sign in with Apple, Associated Domains),
# Apple Pay merchant entitlement, and APNs callback forwarding. It does not touch
# icons, splash assets, DerivedData, or Swift Package Manager caches.

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS_APP_DIR="$ROOT/ios/App/App"
PBXPROJ="$ROOT/ios/App/App.xcodeproj/project.pbxproj"
INFO_PLIST="$IOS_APP_DIR/Info.plist"
APP_DELEGATE="$IOS_APP_DIR/AppDelegate.swift"
ENTITLEMENTS_SRC="$ROOT/ios-native/App.entitlements"
ENTITLEMENTS_DEST="$IOS_APP_DIR/App.entitlements"
PATCH_JSON="$ROOT/ios-native/Info.plist.patch.json"

if [ ! -d "$IOS_APP_DIR" ]; then
  echo "ERROR: $IOS_APP_DIR not found. Your ios/ project is missing. Restore it from git or your backup before running this script."
  exit 1
fi

if [ ! -f "$PBXPROJ" ]; then
  echo "ERROR: $PBXPROJ not found. Your iOS Xcode project is missing."
  exit 1
fi

echo "==> Copying entitlements"
cp "$ENTITLEMENTS_SRC" "$ENTITLEMENTS_DEST"

echo "==> Wiring entitlements into project.pbxproj"
# Use the known-working wiring style: copy the entitlement plist and point the
# App build settings at it. Do not rewrite Xcode SystemCapabilities here —
# automatic signing must use a provisioning profile that already includes the
# Apple Pay merchant entitlement.
if ! grep -q "CODE_SIGN_ENTITLEMENTS = App/App.entitlements" "$PBXPROJ"; then
  /usr/bin/perl -0pi -e 's/(buildSettings = \{\n)(?!(?:(?!\}\;).)*CODE_SIGN_ENTITLEMENTS)/$1\t\t\t\tCODE_SIGN_ENTITLEMENTS = App\/App.entitlements;\n/gs' "$PBXPROJ"
  echo "   entitlements path added to pbxproj"
else
  echo "   entitlements path already present"
fi

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

# Strip any Google URL scheme dict, then ensure our own app scheme is present
# (used as the OAuth return address so iOS hands the session back to the app).
url_types = plist.get("CFBundleURLTypes")
cleaned = []
if isinstance(url_types, list):
    dropped = 0
    for entry in url_types:
        schemes = entry.get("CFBundleURLSchemes", []) if isinstance(entry, dict) else []
        if any("REVERSED_IOS_CLIENT_ID" in str(s) for s in schemes):
            dropped += 1
            continue
        cleaned.append(entry)
    if dropped:
        print(f"   removed {dropped} Google URL scheme block(s)")

existing = {
    str(s)
    for entry in cleaned
    if isinstance(entry, dict)
    for s in entry.get("CFBundleURLSchemes", [])
}
for scheme in patch.get("urlSchemes", []):
    if scheme in existing:
        print(f"   scheme  {scheme} already present")
        continue
    cleaned.append({
        "CFBundleURLName": scheme,
        "CFBundleTypeRole": "Editor",
        "CFBundleURLSchemes": [scheme],
    })
    print(f"   scheme  {scheme} added")

if cleaned:
    plist["CFBundleURLTypes"] = cleaned
else:
    plist.pop("CFBundleURLTypes", None)


with open(plist_path, "wb") as f:
    plistlib.dump(plist, f)
PY

echo "==> Patching AppDelegate for APNs callback forwarding"
if [ ! -f "$APP_DELEGATE" ]; then
  echo "ERROR: $APP_DELEGATE not found. Your iOS project looks incomplete."
  exit 1
fi
/usr/bin/python3 - "$APP_DELEGATE" <<'PY'
import re
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    text = f.read()

if "import Capacitor" not in text:
    text = text.replace("import UIKit\n", "import UIKit\nimport Capacitor\n", 1)

BEGIN = "    // FLEA-NATIVE-PATCH BEGIN"
END = "    // FLEA-NATIVE-PATCH END"

# 1. Remove any previously injected marker block so this script is idempotent.
text = re.sub(
    re.escape(BEGIN) + r".*?" + re.escape(END) + r"\n?",
    "",
    text,
    flags=re.DOTALL,
)

# 2. Remove legacy (pre-marker) injections, which appended their own
#    applicationDidBecomeActive and caused "Invalid redeclaration".
if "capacitorDidRegisterForRemoteNotifications" in text:
    text = re.sub(
        r"\n[ \t]*func application\(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken.*?(?=\n\}\s*$)",
        "",
        text,
        count=1,
        flags=re.DOTALL,
    )

# Clean up any orphaned helpers left behind by an older partial patch.
for helper in ("clearWebViewBackgrounds", "clearBackgroundsRecursively"):
    text = re.sub(
        r"\n[ \t]*private func " + helper + r"\([^\n]*\{.*?\n[ \t]*\}\n",
        "\n",
        text,
        flags=re.DOTALL,
    )

CALL = "        DispatchQueue.main.async { self.clearWebViewBackgrounds() }"

has_existing_active = re.search(
    r"func applicationDidBecomeActive\(_ \w+: UIApplication\) \{", text
) is not None

own_active = """
    // Make the WebView + host view transparent so the page's own background
    // (lime on auth, cream in-app, dimmed backdrops behind drawers) fills any
    // area the WebView temporarily exposes around the keyboard, instead of
    // showing UIKit's default black window background.
    func applicationDidBecomeActive(_ application: UIApplication) {
%s
    }
""" % CALL

block = BEGIN + """
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
""" + ("" if has_existing_active else own_active) + """
    private func clearWebViewBackgrounds() {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let windows = scenes.flatMap { $0.windows }
        guard let window = windows.first(where: { $0.isKeyWindow }) ?? windows.first else { return }
        window.backgroundColor = .clear
        self.clearBackgroundsRecursively(view: window)
    }

    private func clearBackgroundsRecursively(view: UIView) {
        if String(describing: type(of: view)).contains("WKWebView") ||
           String(describing: type(of: view)).contains("CAPBridgeView") {
            view.isOpaque = false
            view.backgroundColor = .clear
        }
        if let scroll = view as? UIScrollView {
            scroll.backgroundColor = .clear
        }
        for sub in view.subviews {
            self.clearBackgroundsRecursively(view: sub)
        }
    }
""" + END + "\n"

insert_at = text.rstrip().rfind("}")
if insert_at == -1:
    print("ERROR: Could not patch AppDelegate.swift", file=sys.stderr)
    sys.exit(1)

head = text.rstrip()[:insert_at].rstrip()
text = head + "\n\n" + block + "}\n"

# 3. If Capacitor already declares applicationDidBecomeActive, call our helper
#    from inside that existing method instead of redeclaring it.
if has_existing_active and CALL.strip() not in text:
    text = re.sub(
        r"(func applicationDidBecomeActive\(_ \w+: UIApplication\) \{)",
        r"\1\n" + CALL,
        text,
        count=1,
    )
    print("   WebView transparency hooked into existing applicationDidBecomeActive")

active_count = len(re.findall(r"func applicationDidBecomeActive\(", text))
if active_count != 1:
    print(f"ERROR: expected 1 applicationDidBecomeActive, found {active_count}", file=sys.stderr)
    sys.exit(1)
if "UIApplication.shared.windows" in text:
    print("ERROR: deprecated UIApplication.shared.windows still present", file=sys.stderr)
    sys.exit(1)

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("   APNs delegate callbacks + WebView transparency applied")
PY



echo
echo "==> Verification"
echo "   entitlements file: $(test -f "$ENTITLEMENTS_DEST" && echo yes || echo NO)"
WIRED_COUNT=$(grep -c "CODE_SIGN_ENTITLEMENTS = App/App.entitlements" "$PBXPROJ" || true)
echo "   pbxproj wired:     $(test "$WIRED_COUNT" -gt 0 && echo yes || echo NO) ($WIRED_COUNT App target build settings)"
echo "   Apple Pay entitlement: $(grep -q "com.apple.developer.in-app-payments" "$ENTITLEMENTS_DEST" && echo yes || echo NO)"
echo "   Apple Pay merchant:    $(grep -q "merchant.com.finditonflea.app" "$ENTITLEMENTS_DEST" && echo yes || echo NO)"
echo "   APNs delegate bridge:  $(grep -q "capacitorDidRegisterForRemoteNotifications" "$APP_DELEGATE" && echo yes || echo NO)"
STRIPE_SDK_PINNED=$(grep -q 'exact: "25.9.0"' "$ROOT/node_modules/@capacitor-community/stripe/Package.swift" 2>/dev/null && echo yes || echo NO)
echo "   Stripe iOS SDK pin:    $STRIPE_SDK_PINNED (exact 25.9.0)"
echo "   Stripe account reset:  $(grep -q 'STPAPIClient.shared.stripeAccount = nil' "$ROOT/node_modules/@capacitor-community/stripe/ios/Sources/StripePlugin/StripePlugin.swift" 2>/dev/null && echo yes || echo NO)"
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
if ! grep -q "capacitorDidRegisterForRemoteNotifications" "$APP_DELEGATE"; then
  echo "ERROR: APNs delegate bridge is missing. Push tokens will not reach the app."
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
