Your `Package.swift` is fine. It is the standard Capacitor 8 template and matches `@capacitor/core@8.3.0` / `@capacitor/ios@8.3.0` in your `package.json`. Nothing in the repo is broken.

**Root cause (high confidence):** Xcode's Swift Package Manager cache for `capacitor-swift-pm` is corrupted or was never fully downloaded. When that package fails to resolve, every Swift file that does `import Capacitor` or `import Cordova` throws — which looks like a wall of unrelated Swift errors but is actually one problem.

Do I know what the issue is? Yes: Xcode SPM cache is stale/corrupt for `capacitor-swift-pm`. This is the same class of error as the earlier "There is no XCFramework found at ... Capacitor.xcframework" message.

Plan:

1. Remove the paused Google native dependency
   - Uninstall `@codetrix-studio/capacitor-google-auth` from `package.json` + lockfile so `cap sync ios` stops touching Google native config. Google auth is already hidden in the UI so nothing user-facing changes.

2. Give you one command to nuke the Swift Package cache and rebuild
   - Wipes Xcode DerivedData for this app.
   - Wipes SwiftPM caches: `~/Library/Caches/org.swift.swiftpm`, `~/Library/org.swift.swiftpm`, and `ios/App/App.xcworkspace/xcuserdata`, and `ios/App/.swiftpm` if present.
   - Wipes `ios/App/App/public` and `dist`.
   - Then: `npm install`, `npm run build`, `npx cap sync ios`, `npx cap open ios`.

3. In Xcode, do this exact sequence (in order)
   - File → Packages → **Reset Package Caches**.
   - Wait until "Resolving Package Graph" finishes at the top bar (this is what actually re-downloads `capacitor-swift-pm`).
   - Product → **Clean Build Folder**.
   - Bump Build number by 1.
   - Product → Archive.

4. If it still fails
   - Screenshot only the **first** red error in Xcode's Issue Navigator (⌘5) and paste it. The rest are usually cascading noise from the first one.

5. Fallback if you need to ship today
   - Use History to restore this morning's version, then just paste the plist cleanup one-liner to strip `[REVERSED_IOS_CLIENT_ID]` before archiving.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>