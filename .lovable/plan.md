# Walkthrough GIF Position Adjustment

## Goal
Move the media/GIFs in the app walkthrough (OnboardingCarousel) lower on the screen so they sit closer to the progress dots and Next button.

## Current State
- `src/components/OnboardingCarousel.tsx` centers the slide content vertically using `justify-center` in the main content area.
- The controls (progress dots + Next button) are pinned to the bottom with `-translate-y-16`.
- This creates a large vertical gap between the walkthrough GIFs/videos/gestures and the progress dots.

## Changes
1. In `src/components/OnboardingCarousel.tsx`:
   - Change the main content wrapper from vertical centering (`justify-center`) to bottom-weighted alignment (`justify-end`).
   - Add bottom padding to the main content area so the media stops above the controls instead of overlapping them.
   - Reduce the `-translate-y-16` lift on the controls slightly so the dots sit a little higher, closing the gap further without crowding the bottom nav.
   - Keep spotlight slides visually stable: the spotlight overlay and glow ring positioning remain unchanged; only the non-spotlight slide content block is shifted down.

## Verification
- Open the onboarding walkthrough in the preview.
- Confirm the GIF/video/gesture card on each non-spotlight slide is visibly closer to the pagination dots.
- Check that text remains readable and nothing overlaps the Next button or bottom nav on small screens (iPhone SE / 375px width).
