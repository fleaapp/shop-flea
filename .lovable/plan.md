## Problem

You reverted past the status-bar dimming fix. The current `src/lib/appChrome.ts` dims the native status-bar strip by mixing the route colour with **40% black** (`dimColor(color, 0.4)`), but the drawer/sheet backdrop in the app is actually `bg-foreground/50`. On native iOS this makes the status-bar strip look slightly darker than the backdrop and can make the top edge appear to glitch.

## Root cause (verified from git history)

The last revert (`97223f06`) reset the repo to `9084b05e` (the seller-onboarding step-persistence change). That dropped the follow-up fix from `7f9314a8` which replaced the 40% black mix with a 50% `--foreground` overlay tint.

## Fix

Restore only the `src/lib/appChrome.ts` changes from `7f9314a8`. Leave the seller-onboarding persistence work untouched.

### Changes

1. **`src/lib/appChrome.ts`**
   - Remove the `dimColor` helper that mixes black at 40%.
   - Add an `overlayTint` helper that reads the CSS `--foreground` token, converts its HSL value to hex, and composites it over the route colour at 50% alpha to match `bg-foreground/50`.
   - Update the comment and the `syncNativeStatusBar` call to use `overlayTint(color)` instead of `dimColor(color, 0.4)`.
   - Keep all other chrome logic (no `overlaysWebView` toggle, route colour detection, etc.) exactly as it is now.

2. **No other files change.** `capacitor.config.ts` is identical between `9084b05e` and `7f9314a8`, so it does not need editing.

## Verification

- Run `npm run build` to confirm no TypeScript errors.
- In the native preview, open any drawer/sheet and confirm the native status-bar strip colour matches the dimmed backdrop tone instead of appearing darker.
- Close the drawer and confirm the status bar returns to the route colour with no jump or resize.