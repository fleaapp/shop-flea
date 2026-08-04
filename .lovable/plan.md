# Make the seller refund flow match the buyer refund flow

Right now the seller's "Refund item" on the sale details drawer is styled and structured differently to the buyer's "Request Refund" flow on the order details drawer. This aligns the button, the dialog and the item picker so both feel like the same feature.

## Button (sale details drawer)

- Move "Refund item" onto the same row as "Mark as shipped" instead of stacked underneath, using the same two-button row the buyer side uses: both `flex-1`, `h-12`, full-width row with padding.
- Style the refund action exactly like the buyer's secondary refund button - muted grey fill with white text, rounded-full, no outline - so it never disappears against the lime background.
- When a refund is already in progress for an item, the button reads "Refund requested" and is disabled, matching the buyer behaviour.

## Refund dialog (seller)

Restyle the seller cancel/refund dialog so it matches the buyer's refund dialog:

- Same shell: centred dialog, `max-w-[85vw] sm:max-w-sm`, rounded-2xl, scrollable, with a "Refund item" title.
- Item card at the top with thumbnail, title and price, same as the buyer's single-item view.
- Reason chosen from the same dropdown control style the buyer uses (instead of the radio list), plus an optional note field.
- Optional "Additional details" textarea using the buyer's field styling.
- Keep the seller-only "Relist this item" toggle, placed below the details field.
- Single full-width charcoal confirm button at the bottom, matching the buyer's submit button.

Behaviour (refund + relist + notifications) stays exactly as it is today - this is presentation only.

## Multi-item picker

Replace the current picker with the buyer's step-1 layout: item cards with checkbox, thumbnail, title and price, selected state highlighted, then a full-width charcoal "Continue" button into the refund dialog.

## Technical notes

- `src/components/SalesDetailsSheet.tsx` - button row layout and styling, picker markup.
- `src/components/CancelItemDialog.tsx` - convert from `AlertDialog` + radio list to the `Dialog` + `Select` structure used in `src/components/RefundRequestDialog.tsx`; no changes to the `seller_cancel_order_begin` / `stripe-connect-refund` / relist calls.
