Plan:

1. Restore the shared drawer footer safe-area padding
- Update the common drawer footer so bottom action rows always include the device safe area plus normal spacing.
- This fixes admin drawers and any drawer using `DrawerFooter` without needing one-off patches.

2. Restore listing drawer footer spacing
- Update the listing details drawer’s bottom action bar to include `env(safe-area-inset-bottom)` so the ❌ / wishlist / cart and Edit Listing / Mark as sold buttons sit fully above the home indicator.
- Keep the current look and button sizing; only fix the vertical cut-off.

3. Fix checkout/payment drawer bottoms
- Add the same safe-area bottom padding to card and wallet payment drawer content where the primary action/cancel controls sit at the bottom.

4. Keep the status-bar overlay behavior unchanged
- Do not revert the recent status-bar/top safe-area changes.
- This plan only restores bottom safe-area spacing in drawer content/footers.

5. Verify on mobile-sized preview
- Check a listing drawer, an owner listing footer, and a payment-style drawer layout at iPhone-sized viewport to confirm buttons are no longer clipped.