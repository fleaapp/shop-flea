Plan:

1. **Stop the global input-disappearing behaviour**
   - Remove the app-wide `Keyboard.setScroll({ isDisabled: true })` call. That setting currently prevents iOS from keeping focused inputs visible, which matches the chat screenshot where the message box disappears behind the keyboard.

2. **Keep native backgrounds transparent without changing status/footer colours**
   - Leave the current transparent iOS background + AppDelegate WebView transparency patch in place.
   - Do not alter the status bar overlay, footer colours, or route chrome logic.

3. **Make chat/message composers keyboard-safe**
   - Add a small native keyboard-height listener that writes `--native-keyboard-height` on show/hide.
   - Apply that variable only to bottom message composer bars so the input sits above the keyboard instead of vanishing behind it.
   - Keep the page itself fixed, with only the message list scrolling.

4. **Restore Auth screen to normal height**
   - Replace the current hard top-padded auth layout with one grouped auth stack that sits lower/natural again.
   - The logo, login/signup toggle, fields, and buttons move together as one stack, so the logo cannot cover the toggle/fields when the keyboard opens.
   - Avoid hiding auth fields on focus.

5. **Targeted verification**
   - Check the web preview layout for Auth spacing and chat composer structure.
   - Native keyboard/background verification still requires rebuilding iOS with `npx cap sync ios` and TestFlight/Xcode because those changes depend on the iOS WebView and keyboard.