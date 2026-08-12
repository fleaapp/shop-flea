# Plan: Use Flea logo on the Google "Connecting" loading overlay

## Problem
After the user picks a Google account (or manually logs in / verifies), Auth.tsx shows a
`connectingProvider` overlay. It currently renders plain text "FLEA" instead of the Flea
logo image used on the auth screen and `BrandedLoadingScreen`.

## Change
In `src/pages/Auth.tsx` (lines 767-773), replace the `<span>FLEA</span>` text with the
`fleaLogoAuth` image, matching `BrandedLoadingScreen` styling:

- `<img src={fleaLogoAuth} alt="FLEA" className="h-12 max-[375px]:h-10 object-contain" />`
- Keep the existing spinner and "Connecting to {provider}..." message below the logo.
- Add `px-6` to the container for consistent side padding on small screens.

`fleaLogoAuth` is already imported at the top of `Auth.tsx`, so no new import is needed.

## Result
The Google sign-in connecting overlay will show the same Flea logo as the auth screen and
the post-login `BrandedLoadingScreen`, giving one consistent branded wait state across the
whole Google flow.
