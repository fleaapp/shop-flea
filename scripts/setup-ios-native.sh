#!/usr/bin/env bash
# Safe setup for the existing native iOS project.
# Run this AFTER `npx cap sync ios`. Do not delete ios/ and do not run `npx cap add ios`
# unless you intentionally want to rebuild the Xcode project from scratch.
# Applies Info.plist keys, entitlements (Push, Sign in with Apple, Associated Domains),
# Apple Pay target capabilities, and APNs callback forwarding. It does not touch
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

echo "==> Wiring App target entitlements and native capabilities"
# Patch the App target only. Xcode automatic signing relies on both the
# CODE_SIGN_ENTITLEMENTS build setting and the SystemCapabilities target flags.
# Without the capability flags, Xcode can show the merchant row in red and sign
# the binary without Apple Pay / APNs even when App.entitlements exists.
/usr/bin/python3 - "$PBXPROJ" <<'PY'
import re
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    text = f.read()

def fail(message: str):
    print(f"ERROR: {message}", file=sys.stderr)
    sys.exit(1)

target_match = re.search(
    r"\n\t\t([A-F0-9]{24}) /\* App \*/ = \{\n\t\t\tisa = PBXNativeTarget;[\s\S]*?\n\t\t\};",
    text,
)
if not target_match:
    fail("Could not find PBXNativeTarget App in project.pbxproj")

target_id = target_match.group(1)
target_block = target_match.group(0)
config_list_id_match = re.search(r"buildConfigurationList = ([A-F0-9]{24}) /\*", target_block)
if not config_list_id_match:
    fail("Could not find App target buildConfigurationList")

config_list_id = config_list_id_match.group(1)
config_list_match = re.search(
    rf"\n\t\t{config_list_id} /\* [^*]+ \*/ = \{{[\s\S]*?\n\t\t\}};",
    text,
)
if not config_list_match:
    fail("Could not find App target build configuration list block")

config_ids = re.findall(r"\n\t\t\t\t([A-F0-9]{24}) /\*", config_list_match.group(0))
if not config_ids:
    fail("Could not find App target build configurations")

# Remove stale/broad entitlements settings first. A previous version stamped
# CODE_SIGN_ENTITLEMENTS into every buildSettings block; the App target settings
# below are the only ones required and avoid unrelated project/package noise.
text = re.sub(r"^\s*CODE_SIGN_ENTITLEMENTS = [^;]+;\n", "", text, flags=re.M)

def patch_build_config(project_text: str, config_id: str) -> str:
    pattern = rf"\n\t\t{config_id} /\* [^*]+ \*/ = \{{\n\t\t\tisa = XCBuildConfiguration;[\s\S]*?\n\t\t\}};"
    match = re.search(pattern, project_text)
    if not match:
        fail(f"Could not find XCBuildConfiguration {config_id}")
    block = match.group(0)
    if "buildSettings = {" not in block:
        fail(f"Build configuration {config_id} has no buildSettings block")
    patched = block.replace(
        "\n\t\t\tbuildSettings = {",
        "\n\t\t\tbuildSettings = {\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/App.entitlements;",
        1,
    )
    return project_text[:match.start()] + patched + project_text[match.end():]

for config_id in config_ids:
    text = patch_build_config(text, config_id)

capabilities = """\t\t\t\t\tSystemCapabilities = {
\t\t\t\t\t\tcom.apple.ApplePay = {
\t\t\t\t\t\t\tenabled = 1;
\t\t\t\t\t\t};
\t\t\t\t\t\tcom.apple.AssociatedDomains = {
\t\t\t\t\t\t\tenabled = 1;
\t\t\t\t\t\t};
\t\t\t\t\t\tcom.apple.Push = {
\t\t\t\t\t\t\tenabled = 1;
\t\t\t\t\t\t};
\t\t\t\t\t\tcom.apple.SignInWithApple = {
\t\t\t\t\t\t\tenabled = 1;
\t\t\t\t\t\t};
\t\t\t\t\t};"""

target_attributes_entry = f"""\t\t\t\t{target_id} = {{
{capabilities}
\t\t\t\t}};"""

target_attr_pattern = r"\n\t\t\t\t" + re.escape(target_id) + r" = \{[\s\S]*?\n\t\t\t\t\};"
target_attr_match = re.search(target_attr_pattern, text)
if target_attr_match:
    existing = target_attr_match.group(0)
    if "SystemCapabilities = {" in existing:
        existing = re.sub(
            r"\n\t\t\t\t\tSystemCapabilities = \{[\s\S]*?\n\t\t\t\t\t\};",
            "\n" + capabilities,
            existing,
        )
    else:
        existing = existing.replace("\n\t\t\t\t};", "\n" + capabilities + "\n\t\t\t\t};")
    text = text[:target_attr_match.start()] + existing + text[target_attr_match.end():]
elif "TargetAttributes = {" in text:
    text = text.replace("\n\t\t\tTargetAttributes = {\n", "\n\t\t\tTargetAttributes = {\n" + target_attributes_entry + "\n", 1)
else:
    text = text.replace(
        "\n\t\t\tattributes = {\n",
        "\n\t\t\tattributes = {\n\t\t\tTargetAttributes = {\n" + target_attributes_entry + "\n\t\t\t};\n",
        1,
    )

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print(f"   App target: {target_id}")
print(f"   entitlements wired into {len(config_ids)} App build configuration(s)")
print("   Apple Pay / Push / Associated Domains / Sign in with Apple capabilities marked")
PY

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

echo "==> Patching AppDelegate for APNs callback forwarding"
if [ ! -f "$APP_DELEGATE" ]; then
  echo "ERROR: $APP_DELEGATE not found. Your iOS project looks incomplete."
  exit 1
fi
/usr/bin/python3 - "$APP_DELEGATE" <<'PY'
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    text = f.read()

if "import Capacitor" not in text:
    text = text.replace("import UIKit\n", "import UIKit\nimport Capacitor\n", 1)

methods = """

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
"""

if "capacitorDidRegisterForRemoteNotifications" not in text:
    insert_at = text.rfind("}")
    if insert_at == -1:
        print("ERROR: Could not patch AppDelegate.swift", file=sys.stderr)
        sys.exit(1)
    text = text[:insert_at].rstrip() + methods + text[insert_at:]
    print("   APNs delegate callbacks added")
else:
    print("   APNs delegate callbacks already present")

with open(path, "w", encoding="utf-8") as f:
    f.write(text)
PY

echo
echo "==> Verification"
echo "   entitlements file: $(test -f "$ENTITLEMENTS_DEST" && echo yes || echo NO)"
VERIFY_COUNTS=$(/usr/bin/python3 - "$PBXPROJ" <<'PY'
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    text = f.read()

checks = {
    "wired": text.count("CODE_SIGN_ENTITLEMENTS = App/App.entitlements"),
    "apple_pay": int("com.apple.ApplePay" in text),
    "push": int("com.apple.Push" in text),
    "associated_domains": int("com.apple.AssociatedDomains" in text),
    "sign_in": int("com.apple.SignInWithApple" in text),
}

for key, value in checks.items():
    print(f"{key}={value}")
PY
)
eval "$VERIFY_COUNTS"
WIRED_COUNT=${wired:-0}
CAPABILITY_COUNT=$(( ${apple_pay:-0} + ${push:-0} ))
echo "   pbxproj wired:     $(test "$WIRED_COUNT" -gt 0 && echo yes || echo NO) ($WIRED_COUNT App target build settings)"
echo "   Xcode capabilities: $(test "$CAPABILITY_COUNT" -ge 2 && echo yes || echo NO)"
echo "   Associated Domains: $(test "${associated_domains:-0}" -eq 1 && echo yes || echo NO)"
echo "   Sign in with Apple: $(test "${sign_in:-0}" -eq 1 && echo yes || echo NO)"
echo "   Apple Pay entitlement: $(grep -q "com.apple.developer.in-app-payments" "$ENTITLEMENTS_DEST" && echo yes || echo NO)"
echo "   Apple Pay merchant:    $(grep -q "merchant.com.finditonflea.app" "$ENTITLEMENTS_DEST" && echo yes || echo NO)"
echo "   APNs delegate bridge:  $(grep -q "capacitorDidRegisterForRemoteNotifications" "$APP_DELEGATE" && echo yes || echo NO)"
echo "   Stripe iOS SDK pin:    exact 25.9.0 via native postinstall patcher"
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
if [ "$CAPABILITY_COUNT" -lt 2 ]; then
  echo "ERROR: Xcode capability flags are missing. Do not Archive until this says yes."
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
