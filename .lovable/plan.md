Fix onboarding carousel spacing balance

Current state
- The walkthrough GIF/text was moved down and the progress dots/Next button were moved up to close the gap.
- Feedback: the text is now almost touching the dots — too tight.

Goal
- Keep the GIF/text closer to the dots than the original centered layout, but restore enough breathing room so nothing overlaps or feels cramped.

Changes
1. In `src/components/OnboardingCarousel.tsx`:
   - Main content area: change `justify-end pb-10` to `justify-end pb-14` (adds 16px more space above the dots).
   - Controls container: change `-translate-y-10` to `-translate-y-12` (lowers the dots/button slightly, away from the text).

Verification
- Render the carousel via a temporary test route and capture a mobile screenshot to confirm the text and dots are clearly separated but not distant.
- Run `tsc --noEmit` to ensure no type errors.
- Remove the temporary test route/file before finishing.
