## What's happening

Three separate issues stack on cold launch:

1. **Black screen hang on first open after install** — the native splash auto-hides after 1500 ms whether the web bundle is ready or not. On a fresh install the WebView is still parsing JS, so between splash hide and React mounting you see the app window's default background (black). Killing and reopening works because the JS is now warm in memory.
2. **Splash flashes too fast** — 1500 ms is short and made worse by the auto-hide firing before React paints anything.
3. **Black status bar strip on splash** — the iOS app window's `backgroundColor` is black by default. The LaunchScreen storyboard's lime view sits inside the safe area, so the top status-bar strip shows the window colour behind it (black), not lime.

## The fix

### 1. `capacitor.config.ts` — hand splash control to JS

- `launchAutoHide: false` so iOS keeps the splash up until we explicitly hide it.
- Keep `backgroundColor: '#DDFED7'` (already correct).
- Remove the fixed `launchShowDuration` (ignored when autoHide is off).

### 2. `src/main.tsx` — hide splash only once React has painted

Import `@capacitor/splash-screen` and call `SplashScreen.hide({ fadeOutDuration: 300 })` inside a `requestAnimationFrame` after `ReactDOM.render`. This eliminates the black gap on first install because splash stays up through JS parse + first paint, then fades directly into the app.

### 3. One-time Xcode change (I can't edit this from here — it lives in your local iOS project)

Two tiny native tweaks make the status-bar strip lime and stop the "black flash":

**A. Set the app window background to lime**

Open `ios/App/App/AppDelegate.swift` and inside `application(_:didFinishLaunchingWithOptions:)`, right before `return true`, add:

```swift
self.window?.backgroundColor = UIColor(red: 0.867, green: 0.996, blue: 0.843, alpha: 1.0)
```

That single line paints the strip behind the status bar lime instead of black — both during launch and during any brief WebView gap.

**B. Make the status bar icons dark on launch**

In `ios/App/App/Info.plist`, add (or update) these two keys:

```xml
<key>UIStatusBarStyle</key>
<string>UIStatusBarStyleDarkContent</string>
<key>UIViewControllerBasedStatusBarAppearance</key>
<false/>
```

That flips the launch-time status bar to dark icons on the lime background so it matches the rest of the app.

I'll give you the exact `PlistBuddy` one-liner and the Swift edit as copy-paste commands after you approve the plan.

## Files I will change

- `capacitor.config.ts` — set `launchAutoHide: false`, drop `launchShowDuration`.
- `src/main.tsx` — hide splash from JS after first paint.

## Files you edit once in Xcode (I'll give commands)

- `ios/App/App/AppDelegate.swift` — set window backgroundColor to lime.
- `ios/App/App/Info.plist` — `UIStatusBarStyle` + `UIViewControllerBasedStatusBarAppearance` keys.

## Rebuild command

After approving, use the same push chain as last time:

```bash
cd ~/Desktop/shop-flea && \
git stash && git pull --rebase && git stash pop && \
npm install --legacy-peer-deps && \
rm -rf dist ios/App/App/public && \
npm run build && npx cap sync ios && \
cd ios/App && agvtool next-version -all && cd ../.. && \
npx cap open ios
```
