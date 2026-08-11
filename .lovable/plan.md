# Auth screen layout tweak

## Goal
Move the Flea logo higher on the auth screen, then re-centre the entire auth content group (logo, toggle, forms, social buttons, and "browse as guest" link) so the space above the logo matches the space below the bottom link.

## Current state
- `src/pages/Auth.tsx` renders the auth page.
- The content stack uses `justify-start pt-[clamp(112px,20svh,180px)]`, which top-aligns the content with a large fixed top gap.
- The logo has `mb-10` (or `mb-7` on small screens), pushing the toggle and form down from the logo.
- Horizontal centring is already in place via `items-center` on each flex container.

## Proposed change
1. Switch the main auth stack from top-aligned to vertically centred (`justify-center`) so the whole content group sits in the middle of the screen.
2. Move the logo to the top of the centred content group by reducing/removing the internal top padding and keeping the logo as the first child.
3. Keep the gap between the logo and the login/signup toggle generous so it does not feel cramped.
4. Ensure the bottom "browse as guest" link remains part of the centred group so the whitespace below it balances the whitespace above the logo.
5. Verify on mobile and desktop viewports that nothing clips and the layout feels balanced.

## Files to edit
- `src/pages/Auth.tsx` — adjust the `.auth-stack` and `.auth-logo` Tailwind classes only.

## Verification
- Open `/auth` in the preview on mobile and desktop viewports.
- Confirm the logo is visibly higher, the whole auth card is vertically centred, and the space above the logo roughly equals the space below the bottom link.
