#!/usr/bin/env bash
# One-shot setup for the native iOS project.
# Run this AFTER `npx cap add ios && npx cap sync ios` whenever you rebuild the ios/ folder.
# Applies Info.plist keys, entitlements (Push, Sign in with Apple, Associated Domains),
# strips any stale Google URL scheme, and restores the app icon from your newest Xcode Archive.

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS_APP_DIR="$ROOT/ios/App/App"
PBXPROJ="$ROOT/ios/App/App.xcodeproj/project.pbxproj"
INFO_PLIST="$IOS_APP_DIR/Info.plist"
ENTITLEMENTS_SRC="$ROOT/ios-native/App.entitlements"
ENTITLEMENTS_DEST="$IOS_APP_DIR/App.entitlements"
PATCH_JSON="$ROOT/ios-native/Info.plist.patch.json"

if [ ! -d "$IOS_APP_DIR" ]; then
  echo "ERROR: $IOS_APP_DIR not found. Run: npx cap add ios && npx cap sync ios first."
  exit 1
fi

echo "==> Copying entitlements"
cp "$ENTITLEMENTS_SRC" "$ENTITLEMENTS_DEST"

echo "==> Wiring entitlements into project.pbxproj"
if ! grep -q "CODE_SIGN_ENTITLEMENTS = App/App.entitlements" "$PBXPROJ"; then
  # Insert CODE_SIGN_ENTITLEMENTS into every buildSettings block that doesn't have one.
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

echo "==> Restoring app icon from newest Xcode Archive"
ARCHIVE_APP=""
for A in "$HOME"/Library/Developer/Xcode/Archives/*/*.xcarchive; do
  CANDIDATE=$(find "$A/Products" -maxdepth 4 -name "*.app" -type d 2>/dev/null | head -1)
  if [ -n "$CANDIDATE" ]; then
    ARCHIVE_APP="$CANDIDATE"
  fi
done

ICON_DIR="$IOS_APP_DIR/Assets.xcassets/AppIcon.appiconset"
mkdir -p "$ICON_DIR"

if [ -n "$ARCHIVE_APP" ] && ls "$ARCHIVE_APP"/AppIcon*.png >/dev/null 2>&1; then
  cp "$ARCHIVE_APP"/AppIcon*.png "$ICON_DIR"/ 2>/dev/null || true
  # Prefer AppIcon60x60@3x.png (180x180) as the marketing icon source if 1024 is missing.
  if [ ! -f "$ICON_DIR/AppIcon-1024.png" ] && [ -f "$ICON_DIR/AppIcon60x60@3x.png" ]; then
    cp "$ICON_DIR/AppIcon60x60@3x.png" "$ICON_DIR/AppIcon-1024.png"
  fi
  echo "   copied icons from: $ARCHIVE_APP"
else
  echo "   WARNING: no Xcode Archive found; add your 1024x1024 icon manually in Xcode."
fi

cat > "$ICON_DIR/Contents.json" <<'JSON'
{
  "images" : [
    { "filename" : "AppIcon-1024.png", "idiom" : "universal", "platform" : "ios", "size" : "1024x1024" }
  ],
  "info" : { "author" : "xcode", "version" : 1 }
}
JSON

echo
echo "==> Verification"
echo "   entitlements file: $(test -f "$ENTITLEMENTS_DEST" && echo yes || echo NO)"
echo "   pbxproj wired:     $(grep -q "CODE_SIGN_ENTITLEMENTS = App/App.entitlements" "$PBXPROJ" && echo yes || echo NO)"
echo "   Google leftovers:  $(grep -R 'REVERSED_IOS_CLIENT_ID\|@codetrix-studio/capacitor-google-auth' "$ROOT/ios" "$ROOT/package.json" "$ROOT/capacitor.config.ts" 2>/dev/null | wc -l | tr -d ' ')"
echo "   icon files:        $(ls "$ICON_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')"
echo
echo "Done. Now: npx cap open ios -> set Team -> Any iOS Device (arm64) -> bump Build -> Archive."
