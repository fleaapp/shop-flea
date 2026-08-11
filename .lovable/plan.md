# Auth screen layout tweak

## Goal
Adjust the auth screen so the Flea logo sits a little higher and every element below it (toggle, forms, social buttons, footer links) is cleanly centred.

## Current state
- `src/pages/Auth.tsx` renders the auth page.
- The logo is inside `.auth-stack` with `justify-start` and a top padding of `clamp(112px,20svh,180px)`.
- The logo has `mb-10` (or `mb-7` on small screens) pushing the rest of the content down.
- All child containers use `flex flex-col items-center`, so horizontal centring is already present.

## Proposed change
1. Reduce the top padding of the main stack so the logo moves up slightly.
2. Reduce the logo bottom margin so the gap between the logo and the login/signup toggle is tighter.
3. Keep the content vertically centred as a group by switching the stack from `justify-start` to `justify-center` and using a smaller, balanced top offset.
4. Verify the social-login row and bottom links remain centred and do not overflow on small screens.

## Files to edit
- `src/pages/Auth.tsx` — adjust the `.auth-stack` and `.auth-logo` Tailwind classes only.

## Verification
- Open `/auth` in the preview on mobile and desktop viewports.
- Confirm the logo is higher, the toggle is centred under it, and the form/social buttons stay vertically balanced without clipping the bottom links.
