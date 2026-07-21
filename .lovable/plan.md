## Problem

The `Toaster` in `src/components/ui/sonner.tsx` never sets a `position` prop, so sonner falls back to its default `bottom-right`. Combined with the fixed `w-[calc(100vw-24px)]` width, toasts on iPhone anchor to the right edge and clip off screen (matches the screenshots throughout the recent conversation).

## Fix

In `src/components/ui/sonner.tsx`, set `position="top-center"` on the `<Sonner />` component so toasts render centered horizontally at the top, respecting the existing safe-area top offset.

No other changes — width, offset, icons, styling all stay the same.