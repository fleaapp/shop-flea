# Shipping / Tracking QA

Use these tracking numbers to exercise the shipping → in-transit → delivered flow without a real parcel. Both are real Australia Post number formats, so the app's AfterShip validation accepts them.

## Primary test tracking number (Australia Post International)

```
LX123456789AU
```

- **Carrier to select:** Australia Post
- Format: `LX` + 9 digits + `AU` (13 chars)
- Recognised by AfterShip; will register as a valid trackable number in sandbox and typically resolves to test events in production.

## Fallback (Australia Post Domestic barcode)

If the primary above is rejected as "not found" in production:

```
99M0012345600001000930000
```

- **Carrier to select:** Australia Post
- Format: 22-char AP domestic barcode

## Notes

- Do NOT use "Manual" / "Other" — the app is locked to real AU carriers only.
- Any AU carrier's public sample tracking number will also work if you want to test that carrier's branch (StarTrack, Sendle, Aramex, CouriersPlease, TNT).

---

# Pushing a build to TestFlight

From the project root on your Mac:

```bash
# 1. Build the web bundle
npm run build

# 2. Sync into the iOS native project
npx cap sync ios

# 3. Open Xcode
npx cap open ios
```

Then in Xcode:

1. Select **Any iOS Device (arm64)** in the target dropdown (top bar, next to the scheme).
2. **Product → Archive**.
3. When the Organizer opens, select the new archive → **Distribute App**.
4. Choose **App Store Connect** → **Upload** → keep defaults → **Upload**.
5. Wait ~5-15 min for processing. The build then appears in App Store Connect → TestFlight, ready to assign to testers.

No CLI-only path exists from this repo — Apple requires the archive/upload step from Xcode (or Fastlane, which is not set up here).
