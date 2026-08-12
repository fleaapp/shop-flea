#!/usr/bin/env bash
# Safe setup for the native Android project.
# Run this AFTER `npx cap sync android`. Do not delete android/ and do not run
# `npx cap add android` unless you intentionally want to rebuild the project.
#
# Wires Firebase (FCM push + Google Sign-In Credential Manager), signing,
# AndroidManifest patches (permissions, App Links, custom scheme), and the
# assetlinks.json fingerprint. Idempotent: re-running after `cap sync android`
# produces an identical result.

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_APP_DIR="$ROOT/android/app"
APP_BUILD_GRADLE="$ANDROID_APP_DIR/build.gradle"
PROJECT_BUILD_GRADLE="$ROOT/android/build.gradle"
MANIFEST="$ANDROID_APP_DIR/src/main/AndroidManifest.xml"
PATCH_JSON="$ROOT/android-native/AndroidManifest.patch.json"
ASSETLINKS="$ROOT/public/.well-known/assetlinks.json"

if [ ! -d "$ANDROID_APP_DIR" ]; then
  echo "ERROR: $ANDROID_APP_DIR not found. Run 'npx cap add android' first."
  exit 1
fi

echo "==> Checking google-services.json"
GS_DEST="$ANDROID_APP_DIR/google-services.json"
GS_SRC="$ROOT/android-native/google-services.json"
if [ -f "$GS_SRC" ]; then
  cp "$GS_SRC" "$GS_DEST"
  echo "   copied google-services.json from android-native/"
elif [ -f "$GS_DEST" ]; then
  echo "   google-services.json already present in android/app/"
else
  echo "ERROR: google-services.json not found. Download it from Firebase Console"
  echo "       (Project Settings > Your apps > Android app) and place it at"
  echo "       android/app/google-services.json. FCM push and Google Sign-In"
  echo "       both depend on it."
  exit 1
fi

echo "==> Wiring Google Services gradle plugin"
# Project-level build.gradle: add the classpath (idempotent).
if [ -f "$PROJECT_BUILD_GRADLE" ] && ! grep -q "com.google.gms:google-services" "$PROJECT_BUILD_GRADLE"; then
  /usr/bin/python3 - "$PROJECT_BUILD_GRADLE" <<'PY'
import re, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    text = f.read()
# Insert into the buildscript dependencies block.
if 'dependencies {' in text and 'com.google.gms:google-services' not in text:
    text = re.sub(
        r'(buildscript\s*\{\s*dependencies\s*\{)',
        r'\1\n        classpath \'com.google.gms:google-services:4.4.2\'',
        text,
        count=1,
    )
    print("   added classpath to project build.gradle")
else:
    print("   project build.gradle classpath already present or no buildscript block")
with open(path, "w", encoding="utf-8") as f:
    f.write(text)
PY
else
  echo "   project build.gradle classpath already present"
fi

# App-level build.gradle: apply plugin + firebase-messaging (idempotent).
if [ -f "$APP_BUILD_GRADLE" ]; then
  /usr/bin/python3 - "$APP_BUILD_GRADLE" <<'PY'
import re, sys
path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    text = f.read()
changed = False

# Add firebase-messaging dependency to dependencies block.
if 'firebase-messaging' not in text:
    text = re.sub(
        r'(dependencies\s*\{)',
        r'\1\n    implementation \'com.google.firebase:firebase-messaging:23.4.1\'',
        text,
        count=1,
    )
    changed = True
    print("   added firebase-messaging to app build.gradle")

# Apply the google-services plugin at the very end (must be last).
if 'com.google.gms.google-services' not in text:
    text = text.rstrip() + "\n\napply plugin: 'com.google.gms.google-services'\n"
    changed = True
    print("   applied google-services plugin in app build.gradle")

if changed:
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
else:
    print("   app build.gradle google-services already wired")
PY
else
  echo "   (no app build.gradle found - skipping plugin wiring)"
fi

echo "==> Patching AndroidManifest.xml"
if [ -f "$MANIFEST" ]; then
  /usr/bin/python3 - "$MANIFEST" "$PATCH_JSON" <<'PY'
import json, re, sys
manifest_path, patch_path = sys.argv[1], sys.argv[2]
with open(patch_path) as f:
    patch = json.load(f)
with open(manifest_path, encoding="utf-8") as f:
    text = f.read()

# Ensure the xmlns:android namespace exists on <manifest>.
if 'xmlns:android' not in text:
    text = text.replace('<manifest', '<manifest xmlns:android="http://schemas.android.com/apk/res/android"', 1)

# Permissions: insert <uses-permission> right after <manifest ...> opening, if missing.
perm_insert = ""
for perm in patch.get("permissions", []):
    tag = f'<uses-permission android:name="{perm}" />'
    if perm not in text:
        perm_insert += f"    {tag}\n"
        print(f"   permission {perm}")
if perm_insert:
    text = re.sub(r'(<manifest[^>]*>)', r'\1\n' + perm_insert, text, count=1)

# App label: set android:label on <application>.
app_label = patch.get("appName")
if app_label:
    if 'android:label=' in text:
        text = re.sub(r'android:label="[^"]*"', f'android:label="{app_label}"', text, count=1)
    else:
        text = text.replace('<application', f'<application android:label="{app_label}"', 1)
    print(f"   app label = {app_label}")

# Intent filters: App Links (autoVerify) + custom scheme.
filters = patch.get("intentFilters", {})
intent_xml = ""

# App Links for HTTPS host(s).
app_links = filters.get("appLinks", {})
if app_links:
    hosts = app_links.get("hosts", [])
    paths = app_links.get("paths", [])
    scheme_entry = "    <intent-filter android:autoVerify=\"true\">\n"
    scheme_entry += "      <action android:name=\"android.intent.action.VIEW\" />\n"
    scheme_entry += "      <category android:name=\"android.intent.category.DEFAULT\" />\n"
    scheme_entry += "      <category android:name=\"android.intent.category.BROWSABLE\" />\n"
    for h in hosts:
        scheme_entry += f"      <data android:scheme=\"https\" android:host=\"{h}\" />\n"
    for p in paths:
        scheme_entry += f"      <data android:pathPattern=\"{p}\" />\n"
    scheme_entry += "    </intent-filter>\n"
    intent_xml += scheme_entry
    print(f"   App Links intent filter for {','.join(hosts)}")

# Custom app scheme.
custom_scheme = filters.get("customScheme")
if custom_scheme:
    intent_xml += "    <intent-filter>\n"
    intent_xml += "      <action android:name=\"android.intent.action.VIEW\" />\n"
    intent_xml += "      <category android:name=\"android.intent.category.DEFAULT\" />\n"
    intent_xml += "      <category android:name=\"android.intent.category.BROWSABLE\" />\n"
    intent_xml += f"      <data android:scheme=\"{custom_scheme}\" />\n"
    intent_xml += "    </intent-filter>\n"
    print(f"   custom scheme {custom_scheme}")

# Insert intent filters inside the <activity> that handles the main intent.
# We look for the MainActivity activity block. As a safe fallback, insert
# before the first </activity> we find.
if intent_xml and '<activity' in text:
    # Find the first <activity ...> with MAIN/LAUNCHER and append after its existing filters.
    marker = "</activity>"
    if marker in text and "flea-android-app-links" not in text:
        # Wrap in a comment marker so re-runs can strip and re-apply (idempotency).
        block = f"        <!-- flea-android-app-links BEGIN -->\n{intent_xml}        <!-- flea-android-app-links END -->\n"
        # Insert just before the first </activity> we find after the main launcher.
        idx = text.find(marker)
        text = text[:idx] + block + text[idx:]
    elif "flea-android-app-links" in text:
        # Replace existing block.
        text = re.sub(
            r"\s*<!-- flea-android-app-links BEGIN -->.*?<!-- flea-android-app-links END -->",
            f"\n        <!-- flea-android-app-links BEGIN -->\n{intent_xml}        <!-- flea-android-app-links END -->",
            text,
            flags=re.DOTALL,
        )

with open(manifest_path, "w", encoding="utf-8") as f:
    f.write(text)
print("   AndroidManifest patched")
PY
else
  echo "   (no AndroidManifest.xml found - skipping manifest patch)"
fi

echo "==> Signing config"
SIGNING_PROPS="$ROOT/android-native/signing.properties"
if [ -f "$SIGNING_PROPS" ]; then
  /usr/bin/python3 - "$APP_BUILD_GRADLE" "$SIGNING_PROPS" <<'PY'
import re, sys, configparser
gradle_path, props_path = sys.argv[1], sys.argv[2]
cp = configparser.ConfigParser()
# signing.properties is a flat key=value file; read it manually.
props = {}
with open(props_path, encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        props[k.strip()] = v.strip()
if not props:
    print("   signing.properties empty - skipping")
    sys.exit(0)
with open(gradle_path, encoding="utf-8") as f:
    text = f.read()
if "fleaSigning" in text:
    print("   signing config already present")
    sys.exit(0)
store_file = props.get("storeFile", "")
store_pass = props.get("storePassword", "")
key_alias = props.get("keyAlias", "")
key_pass = props.get("keyPassword", "")
block = f"""
    signingConfigs {{
        fleaSigning {{
            storeFile file('{store_file}')
            storePassword '{store_pass}'
            keyAlias '{key_alias}'
            keyPassword '{key_pass}'
        }}
    }}
"""
# Insert after android { line.
text = re.sub(r'(android\s*\{)', r'\1' + block, text, count=1)
# Wire buildTypes.release to use it, if a release block exists.
if "buildTypes {" in text and "fleaSigning" not in text.split("buildTypes {",1)[1].split("}",1)[0]:
    pass  # handled below
text = re.sub(
    r'(buildTypes\s*\{\s*release\s*\{)',
    r'\1\n            signingConfig signingConfigs.fleaSigning',
    text,
    count=1,
)
with open(gradle_path, "w", encoding="utf-8") as f:
    f.write(text)
print("   signing config wired into build.gradle")
PY
else
  echo "   no signing.properties found - skipping (unsigned/debug builds only)"
fi

echo "==> Asset Links fingerprint"
# If a keystore is configured, generate its SHA-256 and inject into assetlinks.json.
KEYSTORE=""
ALIAS=""
STOREPASS=""
if [ -f "$SIGNING_PROPS" ]; then
  while IFS='=' read -r k v; do
    case "$k" in
      storeFile) KEYSTORE="$v" ;;
      keyAlias) ALIAS="$v" ;;
      storePassword) STOREPASS="$v" ;;
    esac
  done < "$SIGNING_PROPS"
fi
if [ -n "$KEYSTORE" ] && [ -f "$KEYSTORE" ] && command -v keytool >/dev/null 2>&1; then
  SHA256=$(keytool -list -v -keystore "$KEYSTORE" -storepass "$STOREPASS" -alias "${ALIAS:-}" 2>/dev/null | grep -i "SHA256:" | head -1 | awk '{print $2}')
  if [ -n "$SHA256" ]; then
    /usr/bin/python3 - "$ASSETLINKS" "$SHA256" <<'PY'
import json, sys
path, sha = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)
for entry in data:
    if entry.get("target", {}).get("package_name") == "com.finditonflea.app":
        entry["target"]["sha256_cert_fingerprints"] = [sha]
with open(path, "w") as f:
    json.dump(data, f, indent=2)
print(f"   assetlinks.json fingerprint set to {sha}")
PY
    echo "   SHA-256: $SHA256"
  else
    echo "   (could not extract SHA-256 from keystore - leaving placeholder)"
  fi
else
  echo "   (no keystore/keytool available - leaving placeholder in assetlinks.json)"
  echo "   Run this script on a machine with a JDK to generate the real fingerprint."
fi

echo
echo "==> Verification"
echo "   google-services.json: $(test -f "$GS_DEST" && echo yes || echo NO)"
echo "   project classpath:     $(grep -q 'com.google.gms:google-services' "$PROJECT_BUILD_GRADLE" 2>/dev/null && echo yes || echo NO)"
echo "   app plugin:           $(grep -q 'com.google.gms.google-services' "$APP_BUILD_GRADLE" 2>/dev/null && echo yes || echo NO)"
echo "   firebase-messaging:   $(grep -q 'firebase-messaging' "$APP_BUILD_GRADLE" 2>/dev/null && echo yes || echo NO)"
echo "   manifest permissions: $(grep -c 'uses-permission' "$MANIFEST" 2>/dev/null || echo 0)"
echo "   app links filter:     $(grep -q 'flea-android-app-links' "$MANIFEST" 2>/dev/null && echo yes || echo NO)"
echo "   signing config:       $(grep -q 'fleaSigning' "$APP_BUILD_GRADLE" 2>/dev/null && echo yes || echo NO)"
echo
cat <<'EOF'
Next: npx cap open android -> Build > Generate Signed Bundle > Android App Bundle (.aab).
For Google App Signing, upload the AAB to Play Console once; Google re-signs with its key.
EOF
echo "Done."
