# Fix: carrier picker does nothing inside the sale details drawer

## What's wrong

The ship form uses a Radix `Select` (`src/components/SalesDetailsSheet.tsx`, the Service Provider field and the "New carrier" field in the update-tracking block). That select lives inside the vaul `Drawer`. The drawer's drag/focus handling swallows the pointer events that open the select's popup layer, so on touch the trigger shows the chevron but the option list never appears. My earlier "it works" was based on the code path and edge functions, not on tapping the control on a phone - that was wrong and I should have driven the UI.

## The fix

Drop the popup entirely for carrier choice. Instead of a dropdown that has to render above a drag-enabled drawer, show the six carriers as inline tappable chips right under the "Service Provider" label:

Australia Post | StarTrack | CouriersPlease | TNT | Toll | DHL Express

- Wrapping two-per-row grid, full width, same rounded card styling as the other pickers in the app.
- Selected chip uses the lime primary fill; unselected uses muted card background.
- Tapping a chip sets the carrier and clears any inline validation error, exactly as the select's `onValueChange` did.
- Same control reused in the "Update tracking number" block for shipped orders, so both places behave identically.

Nothing about validation, registration, or payouts changes - only the control that picks the carrier name.

## Verification before I call it done

Drive the actual UI with a browser: open a sale in the awaiting state, tap a carrier, confirm the selection sticks, enter a bad number and confirm the inline error blocks submit, then confirm a well-formed number enables the ship button. Screenshot each step.

## Technical notes

- Edit `src/components/SalesDetailsSheet.tsx` only: remove the `Select`/`SelectTrigger`/`SelectContent`/`SelectItem` usage and imports, add a small local `CarrierPicker` rendering `AU_CARRIERS` as buttons bound to `serviceProvider` / `setServiceProvider`.
- `src/lib/auCarriers.ts` is unchanged - same names, codes and regex patterns.
- No backend, cron, or edge function changes.
