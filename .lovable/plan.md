# Tidy up the Offers screen for non-sellers

Three fixes in `src/pages/Offers.tsx`, all presentation-only.

## 1. Equal-width Received / Sent toggle

The secondary toggle currently hugs its content, so "Received" and "Sent" are different widths. Match the primary Buyer/Seller toggle: a fixed-width pill (`w-[220px]`) with each button at `w-1/2`, so both segments are exactly half.

## 2. Seller setup prompt styled like the empty state

Replace the white card + lime button block with the same centred `EmptyState` layout used for "No offers received":

- Emoji: 💰
- Title: "Set up seller account"
- Description: "Become a seller to receive and manage offers on your listings."
- Action button: "Set up seller account" - opens the existing seller onboarding sheet

No card background, no boxed container - it sits in the scroll area exactly where the empty state sits.

## 3. Hide the offers empty state until the seller is active

When the Seller role is selected and the user is not seller-ready, only the setup prompt shows. The "No offers received / No offers sent" empty state (and the offers list area) is skipped entirely for that case. Buyer role is unchanged.

## Technical notes

- Prompt moves from the fixed block above the list into the scrollable content region, rendered via `EmptyState` with `actionLabel` / `onAction`.
- The real `💰 Offers` on/off toggle card still renders only when `sellerReady` is true.
- No backend, hook, or offer-logic changes.
