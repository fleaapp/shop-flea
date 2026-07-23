## Test tracking code

The app validates tracking numbers against real AU carrier formats via AfterShip. To exercise the shipping → in-transit → delivered flow without a real parcel, use an **Australia Post test tracking number**:

```
LX123456789AU
```

- Format: `LX` + 9 digits + `AU` (standard Australia Post International Parcel format, 13 chars)
- Carrier to select: **Australia Post**
- Works in AfterShip sandbox/test mode; will register as a valid trackable number

If AfterShip is running against production and rejects the above as "not found," fall back to a known real-format Australia Post domestic number:

```
99M0012345600001000930000
```

- Format: 22-char AP domestic barcode
- Carrier: **Australia Post**

I'll add a short note to internal docs (`docs/shipping-testing.md`) documenting these test codes and the carrier to pick for QA runs.

## Command to push to TestFlight

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

1. Select the **Any iOS Device (arm64)** build target (top bar, next to the scheme).
2. **Product → Archive**.
3. When the Organizer opens, select the new archive → **Distribute App**.
4. Choose **App Store Connect** → **Upload** → keep defaults → **Upload**.
5. Once processed (~5-15 min), the build appears in App Store Connect → TestFlight, ready to assign to testers.

There is no CLI-only path to TestFlight from this repo — Apple requires the archive/upload step from Xcode (or Fastlane, which we haven't set up). If you want, I can add a Fastlane lane in a follow-up so this becomes a single `fastlane beta` command.

## Scope

- Docs-only addition (`docs/shipping-testing.md`).
- No app code, no backend, no database changes.
