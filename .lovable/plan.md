Every remaining page that clips under the notch shares the same root cause: the root uses `min-h-screen` / `min-h-svh` / `h-screen` (or a plain `fixed inset-0`) without the `native-safe-top` utility that pads `env(safe-area-inset-top)` on native. Add the utility (and, where the root isn't already `fixed inset-0`, keep the existing layout — the class works on any block-level container).

### Add `native-safe-top` to these page roots

User-called-out:
- `src/pages/SellerDashboard.tsx` (line 277) — `min-h-svh …`
- `src/pages/FAQ.tsx` (line 10) — help centre
- `src/pages/PrivacyPolicy.tsx` (line 11) — help centre
- `src/pages/Terms.tsx` (line 11) — help centre
- `src/pages/ContactSupport.tsx` — help centre entry
- `src/pages/SuggestionBox.tsx` — help centre entry
- `src/pages/CreateListing.tsx` (three branches: 531, 543, 607)
- `src/pages/EditListing.tsx` (two branches: 455, 462)
- `src/pages/Favorites.tsx` (Wishlist)
- `src/pages/Sales.tsx`
- `src/pages/OrderChat.tsx` (buyer/seller + support chat)

Rest of sweep (same issue, same one-class fix):
- `src/pages/EditProfile.tsx`
- `src/pages/Checkout.tsx` (both branches: 246, 598)
- `src/pages/CheckoutSuccess.tsx` (both branches: 157, 168)
- `src/pages/ChatConversation.tsx`
- `src/pages/ListingDetails.tsx` (branches: 339, 347, 493)
- `src/pages/Install.tsx` (branches: 60, 74)
- `src/pages/ForgotPassword.tsx`, `src/pages/ResetPassword.tsx`, `src/pages/VerifyEmail.tsx` (auth screens — safe-top so headers/back buttons clear the notch)
- Admin pages (all use `min-h-[100svh]` with no safe-top and were also reported stuck):
  - `src/pages/admin/AdminDashboard.tsx` (both branches: 85, 164 — also convert `min-h-screen` branch to `fixed inset-0 flex flex-col overflow-hidden` shell with an inner `flex-1 overflow-y-auto` so the dashboard scrolls on native)
  - `src/pages/admin/AdminBrands.tsx`
  - `src/pages/admin/AdminUsers.tsx`
  - `src/pages/admin/AdminListings.tsx`
  - `src/pages/admin/AdminRefunds.tsx`
  - `src/pages/admin/AdminTransactions.tsx`
  - `src/pages/admin/AdminErrors.tsx`
  - `src/pages/admin/AdminErrorLogs.tsx`

Skipping: `NotFound`, `AuthCallback` (transient/redirect screens with no top-anchored UI).

### Fix Profile Sales button offset

`src/pages/Profile.tsx` lines 171 and 432 use `absolute top-10 right-4`. Absolute children position from the padding-edge, so the parent's `native-safe-top` padding does NOT push them down — that's why the Sales button still sits under the Dynamic Island. Change both wrappers to:

```tsx
<div className="absolute right-4 z-10" style={{ top: 'calc(env(safe-area-inset-top) + 0.5rem)' }}>
```

Same visual offset on web; sits below the status bar on native.

### Out of scope

No changes to layout composition, spacing, business logic, or hooks. Purely `native-safe-top` additions plus the Profile Sales button offset — and the AdminDashboard scroll-container wrap so it becomes scrollable on native.