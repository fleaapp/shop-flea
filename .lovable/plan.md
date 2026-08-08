# Fixes: card stack, keyboard, welcome push, payment error

## 1. Card stack continuity

Today, opening a listing from Home navigates to `/listing/:id`, which unmounts Home. When the user taps Wishlist, Cart or Discard in the listing footer, Home remounts and rebuilds the stack from a fresh fetch, so the user lands back at the start of the deck instead of the next card.

Changes:
- Persist the Home deck (ordered listing IDs plus the current position) in a module-level session store, so returning from a listing resumes the same deck rather than refetching and reshuffling.
- When a listing is actioned (wishlist, cart, discard) from the detail footer, mark that listing as consumed in the same store before navigating back; Home then removes it and shows the next card with no reordering.
- Swipe actions write to the same store so both paths behave identically.
- Keep the existing exit animation for swipes; the return-from-detail case advances silently to the next card.

Wishlist button appearance: the un-favorited state uses a muted background and muted foreground, which reads as disabled. Restyle the default state to the same solid, active treatment used by the Cart button (only the genuinely blocked sold state keeps the dimmed look).

## 2. Keyboard-covered inputs

Capacitor is set to `KeyboardResize.Body`, which only scrolls the document body. Fields inside sheets and drawers (their own scroll containers) are not scrolled into view - the Seller Onboarding phone field is one case.

Changes:
- Add a small shared hook that listens to the Capacitor `keyboardWillShow` / `keyboardDidHide` events and, while the keyboard is open, scrolls the focused element into a comfortable position above the keyboard inside whichever scroll container holds it.
- Apply it globally (mounted once in the app shell) so any focused input in any sheet, drawer or page is handled, including Seller Onboarding, checkout and messaging.
- No permanent padding or coloured footer: the temporary bottom offset is applied only while the keyboard is visible and removed on hide.

## 3. Welcome push notification

New users currently receive no welcome notification.

Changes:
- Fire a one-time welcome push when profile setup completes (the same point that already shows the "Profile setup complete" toast), guarded by a per-user flag so it can never repeat.
- Copy: "Welcome to Flea! 👉👚👟♻️ Use code 'FREEFLEA' for no fees on your first purchase!"
- If push permission has not been granted yet, queue it so it is sent once the user enables notifications, and also record it as an in-app alert so it appears in the Alerts list either way.

## 4. Payment details error on returning to the app

When a user leaves the app to look up bank details, the resume handler reopens the seller onboarding sheet and re-runs a payment status check; a failed or incomplete check surfaces an error toast even though the user has not submitted anything.

Changes:
- Make the resume path silent: reopening the sheet restores the saved step and re-checks status without any error toast.
- Only show an error after an actual submit attempt, and only when the backend rejects the submitted details (invalid account, name or details mismatch), using the specific reason returned rather than a generic message.
- Transient failures (network, timeout, backgrounded request) retry quietly instead of surfacing an error.

## Technical notes

- Deck store: lightweight module singleton (ids, index, consumed set) read by `src/pages/Index.tsx` and written by `src/pages/ListingDetails.tsx` footer handlers and swipe handlers; invalidated when filters or the user change.
- Keyboard: new `src/hooks/useKeyboardScrollIntoView.ts` using `@capacitor/keyboard` events with a web fallback on `focusin` plus `visualViewport`; mounted in `src/App.tsx`.
- Welcome push: client call to `send-push-notification` on profile-setup completion with a `welcome_sent` marker on the profile so it is idempotent.
- Payment error: gate the toasts in `SellerOnboardingSheet.tsx` behind an explicit submit flag; `SellerOnboardingResumeMount.tsx` performs a quiet re-check only.
