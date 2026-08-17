# Sign-out wording and matching empty-state buttons

## 1. "Signing you in" shows while signing out

Logging out from Settings navigates to `/auth` first and then clears the session. For the moment in between, the auth screen still sees a user and renders the branded screen with the message "Signing you in" (`src/pages/Auth.tsx`, line 482), which is the wrong direction.

Fix: track the sign-out in progress and show "Signing you out" instead.

- `src/context/AuthContext.tsx`: expose a `signingOut` flag that is set true at the start of `signOut` and cleared once the session is gone.
- `src/pages/Auth.tsx`: when that flag is set, render `BrandedLoadingScreen` with `message="Signing you out"`; otherwise keep "Signing you in" exactly as now.

No change to the logout sequence itself.

## 2. Wishlist and Cart buttons on the empty home state

In `src/pages/Index.tsx` the "No more listings!" state renders the two buttons side by side with their natural widths, so "Wishlist" is wider than "Cart".

Fix: give the pair a fixed-width container and let each button take an equal share, so both are the same width regardless of label length. Styling, colours and behaviour stay as they are.

## Verification

- Log out from Settings: the loading screen reads "Signing you out", and a normal sign-in still reads "Signing you in".
- Swipe through to the empty home state: Wishlist and Cart are equal width and centred.
