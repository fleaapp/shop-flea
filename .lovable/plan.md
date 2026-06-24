Provide a single terminal command for the user's local Capacitor checkout that removes the `NSUserTrackingUsageDescription` key from `ios/App/App/Info.plist` and then rebuilds/syncs iOS.

Plan
----
1. Confirm the local path `ios/App/App/Info.plist` is the correct target (matches standard Capacitor iOS structure).
2. Compose a one-liner using `/usr/libexec/PlistBuddy -c "Delete :NSUserTrackingUsageDescription"` followed by the existing build and sync steps.
3. Add an optional guard so the command does not fail if the key is already absent.
4. Deliver the exact command in the final response so the user can copy-paste it.

Technical details
-----------------
- Command to run from the project root of the local Capacitor checkout:
  ````text
  /usr/libexec/PlistBuddy -c "Delete :NSUserTrackingUsageDescription" ios/App/App/Info.plist 2>/dev/null || true; npm run build && npx cap sync ios
  ````
- This deletes the ATT usage-description string, suppresses the error if it is already missing, builds the web bundle, and syncs it into the iOS project.
- After this, the user still needs to open `ios/App/App.xcworkspace` in Xcode, archive, and upload; and leave all "Used for tracking" toggles off in App Store Connect.