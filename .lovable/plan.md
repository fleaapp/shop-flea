## Cause

The screenshot is the **Sheet** primitive (used by `SellerOnboardingSheet`), not the Drawer. In `src/components/ui/sheet.tsx`:

- Line 39: `shadow-lg` on `sheetVariants` — this is the dark drop shadow visible above the sheet's rounded top edge.
- Line 45: `border-t` on the bottom variant — adds a hairline dark border across the top of the sheet.

The earlier fix targeted `[data-vaul-drawer-wrapper]` (Vaul Drawer), which is why the Sheet variants were unaffected.

## Fix (frontend only)

Edit `src/components/ui/sheet.tsx`:

1. Remove `shadow-lg` from the shared `sheetVariants` base string.
2. Remove `border-t` from the `bottom` variant (and `border-b`/`border-l`/`border-r` from the other sides for parity — none of them are meant to render a visible seam).

That's the entire change. No other component consumes these classes for structural reasons.

### Verification

- Reopen the Seller Onboarding sheet on native — no dark line/shadow above the rounded top.
- Spot-check other bottom sheets (checkout, sales details, refund) to confirm they look clean and haven't lost anything intentional.
