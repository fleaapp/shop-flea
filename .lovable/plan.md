Fix onboarding carousel spacing and centre balance

Current state
- The walkthrough GIF/text was moved down and the progress dots/Next button were moved up to close the gap.
- Feedback: the text is now almost touching the dots — too tight — and the whole composition should feel balanced in the centre of the screen.

Goal
- Centre the entire onboarding group (media + text + dots + Next button) vertically in the screen.
- Keep a clear but modest gap between the text and the dots so they don't overlap.

Changes
1. In `src/components/OnboardingCarousel.tsx`:
   - Restructure the carousel body so the media/text and the controls live inside one centred flex column instead of content pushed to the top of the bottom controls.
   - Outer container: `flex-1 flex flex-col items-center justify-center px-6 pb-[calc(84px+env(safe-area-inset-bottom))] max-[375px]:pb-[calc(76px+env(safe-area-inset-bottom))]`.
   - Content block: centred, no `flex-1`.
   - Controls block: sits directly below the content with `mt-8` (or equivalent) spacing, no `-translate-y` offset.
   - Remove the previous `justify-end pb-10` / `-translate-y-10` tweaks.

Verification
- Render the carousel via a temporary test route and capture a mobile screenshot to confirm the group is centred and the text/dots gap looks balanced.
- Run `tsc --noEmit` to ensure no type errors.
- Remove the temporary test route/file before finishing.
