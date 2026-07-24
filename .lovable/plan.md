## Fix auth keyboard behavior

### Problem
On the Auth screen, tapping the email/password inputs triggers the WebView resize (from `KeyboardResize.Native`). Because the form is inside a `flex-1 … justify-center` column, its content re-centers within the now-shorter viewport, sliding the whole form upward until the tab toggle disappears behind the absolutely-positioned logo (`absolute top-32`). The user wants nothing to move.

### Fix (Auth.tsx only)
Replace the vertical-centered flex layout with a **fixed anchor from the top** so the form's on-screen position is independent of viewport height:

- Change the inner content wrapper from `flex-1 flex flex-col items-center justify-center px-6 … pt-16 pb-10` to a top-anchored layout: `absolute left-0 right-0 top-56 max-[375px]:top-44 flex flex-col items-center px-6 max-[375px]:px-4` (offset chosen to sit just below the current logo position).
- Remove `pb-10` / `pt-16` padding that only mattered for the centered flex.
- Keep the logo's existing `absolute top-32` position untouched.
- Result: when the keyboard opens and the WebView shrinks, the logo and the form both stay pinned to their original top offsets. The keyboard simply overlays the "Or login with / Browse as guest" area at the bottom. Nothing shifts.

No changes to bottom nav, guest gate, or any other screen.

### Black keyboard background
User has only observed the black strip on Auth so far. The Auth fix above keeps the lime `bg-primary` filling the full WebView (which itself sits flush above the keyboard via `KeyboardResize.Native`), so the black strip on Auth is resolved as a side effect. If it shows up on a specific other screen later, we'll address that screen individually — no speculative changes elsewhere.

### Files touched
- `src/pages/Auth.tsx` — swap the main content wrapper's classes as described above.
