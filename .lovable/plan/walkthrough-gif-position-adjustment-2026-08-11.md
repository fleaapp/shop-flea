# Walkthrough GIF Position Adjustment

## Goal
Close the vertical gap in the app walkthrough by moving the GIFs and text down, and moving the progress dots and Next button up.

## Current State
- `src/components/OnboardingCarousel.tsx` centers the slide content vertically using `justify-center` in the main content area.
- The controls (progress dots + Next button) are pinned to the bottom with `-translate-y-16`.
- This leaves a large empty space between the walkthrough media/text and the pagination controls.

## Changes
1. In `src/components/OnboardingCarousel.tsx`:
   - Move the slide content (GIFs/videos/gestures and their text) down by changing the main content wrapper from vertical centering (`justify-center`) to bottom-weighted alignment (`justify-end`) with reduced bottom padding.
   - Move the controls (progress dots + Next button) up by reducing the `-translate-y-16` lift or adjusting the bottom padding so they sit closer to the content.
   - Keep spotlight slides visually stable: the spotlight overlay and glow ring positioning remain unchanged; only the non-spotlight slide content block is shifted.

## Verification
- Open the onboarding walkthrough in the preview.
- Confirm the GIF/video/gesture card and its text are visibly closer to the pagination dots.
- Confirm the progress dots and Next button are higher on the screen without overlapping the content or bottom nav.
- Check readability and spacing on small screens (iPhone SE / 375px width).
