# Guest Browse Mode

Comply with App Store Guideline 5.1.1(v) by letting anyone browse Flea without an account, and only gating account-based actions behind login.

## 1. Guest session state

Add a lightweight guest flag on top of `AuthContext` (no schema changes, no Supabase changes).

- New field on `AuthContext`: `isGuest: boolean`, plus `enterGuestMode()` and `exitGuestMode()`.
- Backed by `sessionStorage` key `flea_guest_mode` so it lasts the session but clears on relaunch — matches Apple's expectation that guest mode is transient.
- `isGuest` is only true when `user === null` AND the flag is set. Signing in automatically clears it (seamless transition to authenticated experience).
- New helper hook `useRequireAuth()` returning `{ requireAuth: (action?: string) => boolean }`. If guest, it opens the Guest Prompt modal and returns `false`; otherwise returns `true`.

## 2. Auth screen: "Browse as Guest" link

In `src/pages/Auth.tsx`, under the existing Login / Sign Up block, add a small underlined text button:

```
Browse as Guest
```

- Subtle styling: `text-sm underline text-muted-foreground`, centered, ~16px below the primary CTAs.
- On tap: `enterGuestMode()` then `navigate('/')`.

Everything else on the Auth screen stays exactly as-is.

## 3. Route gating changes

`src/components/ProtectedRoute.tsx` becomes route-type aware. Two wrappers:

- `PublicRoute` (new): allows both authenticated users and guests. Used for browse-related routes.
- `AccountRoute` (renamed behavior of current `ProtectedRoute`): redirects to `/auth` if not signed in. Used for account-only pages.

Route map in `src/App.tsx`:

| Route | Wrapper |
|---|---|
| `/` (Index / swipe feed) | PublicRoute |
| `/listing/:id` | PublicRoute |
| `/seller/:sellerId` | PublicRoute |
| `/cart` | Guest sees Guest Prompt screen (see §5) |
| `/favorites` | PublicRoute — but writes hit local session only for guests |
| `/checkout`, `/checkout/success` | AccountRoute |
| `/profile` | Guest sees Guest Prompt screen (see §5) |
| `/notifications` | Guest sees Guest Prompt screen |
| `/settings`, `/settings/profile` | Guest sees Guest Prompt screen |
| `/create`, `/listing/:id/edit` | AccountRoute |
| `/sales`, `/order-chat/*`, `/contact-support*`, `/suggestion-box` | AccountRoute |
| `/faq`, `/terms`, `/privacy`, `/install` | Public (unchanged) |

## 4. Guest Prompt modal

New component `src/components/GuestPromptDialog.tsx` (using existing `AlertDialog` styling for consistency):

- Header: **You're browsing as a guest**
- Body: *Log in or sign up to buy, sell and save on Flea.*
- Buttons: **Log In**, **Sign Up**, **Continue Browsing**
- Log In → `navigate('/auth')` with `activeTab=login`.
- Sign Up → `navigate('/auth')` with `activeTab=signup`.
- Continue Browsing → close modal.

Global mount inside `AuthenticatedProviders` (renamed conceptually to "AppProviders" — still wraps guests too). Exposed via a small `GuestPromptContext` so any component can call `promptGuest()`.

Wire `useRequireAuth()` to `promptGuest()`.

## 5. Guest-specific tab landing screens

For `/profile`, `/cart`, `/notifications`, `/settings`, when `isGuest`, render a full-screen welcome view instead of the normal page:

- Header: **You're browsing as a guest**
- Body: *Log in or sign up to buy, sell and save on Flea.*
- Buttons: **Log In**, **Sign Up**
- Bottom nav stays visible so they can return to Home.

Implemented as a shared `<GuestGate />` component the page renders when `isGuest`.

## 6. Gated actions inside browsable pages

Wrap these handlers with `requireAuth()`; if it returns false, the modal opens and the action aborts:

- Listing card / details:
  - Add to cart (`WishlistGridCard`, `ListingDetails`, swipe-right save on Home stays local only)
  - Favorite / wishlist save (guest → in-memory session array only, no DB write)
  - Message seller
  - Post a comment (`ListingComments`)
  - Report listing / user
- Home swipe deck:
  - Swipe left dismiss → **allowed** for guests (session only)
  - Swipe right save → **allowed** for guests (session only, kept in `sessionStorage`)
  - Undo → **allowed**
  - Any button that opens Cart/Profile/Alerts routes triggers the modal via §3
- Header/search/filter — **allowed** for guests
- Checkout button → modal
- Create listing button → modal

Guest "saved" items are stored in `sessionStorage` under `flea_guest_saved` so §Session Behaviour is satisfied without touching Supabase. They're discarded on logout of guest mode / relaunch.

## 7. Session behaviour & seamless upgrade

- If a guest signs up or logs in during the session, `AuthContext` detects `SIGNED_IN`, calls `exitGuestMode()`, and the app naturally transitions to the authenticated experience (existing profile/onboarding flow runs).
- Optional carry-over: on successful sign-in, migrate `flea_guest_saved` IDs into the real wishlist via `favorites.upsert`. Small, best-effort; failures are silent.

## 8. Data-layer safety

Guests currently can't reach data hooks because everything is behind ProtectedRoute. After this change, hooks that fetch listings (`useHomeFeed`, `useListings`, listing detail queries) will run for guests. They already use the anon key and only read public data via RLS. Audit:

- Confirm RLS on `listings` allows `SELECT` for `anon` (should already — public catalog).
- Confirm `profiles_public` view is readable by `anon` (already used for seller info).
- Hooks that call `.eq('user_id', user.id)` (favorites, cart, notifications) must early-return when `!user` instead of throwing.

No migrations required — this plan is guarded to be a **frontend-only** change unless the RLS audit reveals a missing anon SELECT policy on `listings`/`profiles_public`, in which case a single migration will add it.

## Technical notes

- Files created:
  - `src/context/GuestContext.tsx` (or fold into `AuthContext`) — `isGuest`, `enterGuestMode`, `exitGuestMode`.
  - `src/hooks/useRequireAuth.ts`
  - `src/components/GuestPromptDialog.tsx`
  - `src/components/GuestGate.tsx`
- Files edited:
  - `src/App.tsx` — split `ProtectedRoute` into `PublicRoute` / `AccountRoute` and re-map routes above.
  - `src/components/ProtectedRoute.tsx` — becomes `AccountRoute`, plus new `PublicRoute`.
  - `src/context/AuthContext.tsx` — expose guest flag and auto-clear on sign in.
  - `src/pages/Auth.tsx` — add "Browse as Guest" underlined link.
  - `src/components/AuthenticatedProviders.tsx` — mount `GuestPromptProvider`; keep providers for guests too (Cart/Onboarding can no-op when `!user`).
  - `src/context/CartContext.tsx` — no-op cart writes when `!user` (guest cart is not persisted; add-to-cart goes through `requireAuth`).
  - `src/pages/Index.tsx` — allow guest usage; route side-effects (favorite / add to cart / message) through `requireAuth`.
  - `src/pages/ListingDetails.tsx`, `src/components/ListingComments.tsx`, `src/components/WishlistGridCard.tsx`, `src/components/CartItemRow.tsx` — same wrapper on gated actions.
  - `src/pages/Profile.tsx`, `src/pages/Cart.tsx`, `src/pages/Notifications.tsx`, `src/pages/Settings.tsx` — render `<GuestGate />` when `isGuest`.
- No changes to iOS Google/Apple sign-in code, no Capacitor changes, no backend changes.

## Out of scope

- Persisting guest activity across app relaunches (Apple only requires guest access, not durable state).
- Server-side "guest cart" — not required and would create garbage data.
- Redesigning the Auth screen.
