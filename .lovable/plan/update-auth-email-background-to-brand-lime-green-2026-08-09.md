# Update auth email background to brand lime green

## Goal
Replace the cream card background in all authentication emails with Flea's brand lime/mint green, and make future email edits easier via a single shared style file.

## Current state
- Six auth email templates live in `supabase/functions/_shared/email-templates/`.
- Each template hardcodes `card.backgroundColor: '#F4F2EB'` (cream) and `main.backgroundColor: '#ffffff'`.
- Brand lime/mint tint is `#ddfed7` (`--tint: 111 95% 92%`).
- The `auth-email-hook` Edge Function must be redeployed after template edits.

## Proposed changes

1. **Extract shared email styles**
   - Create `supabase/functions/_shared/email-templates/styles.ts` exporting `main`, `container`, `card`, `h1`, `text`, `link`, `button`, `footer`, `codeStyle`.
   - Use `#ddfed7` for `card.backgroundColor` and keep `#ffffff` for the outer body background so emails still feel bright and readable.
   - Keep charcoal text/button colours (`#363B47`) for contrast on the lime background.

2. **Refactor all six templates**
   - `signup.tsx`, `magic-link.tsx`, `recovery.tsx`, `invite.tsx`, `email-change.tsx`, `reauthentication.tsx`
   - Import shared style constants and remove duplicated inline style objects.
   - No copy or layout changes beyond the background colour.

3. **Update contact-form email (optional)**
   - `supabase/functions/contact-form-submit/index.ts` uses `#f6f6f3` for the message box.
   - If requested, switch that inner box to `#ddfed7` as well so all app emails match.

4. **Redeploy**
   - Deploy `auth-email-hook` so the new templates are used.

5. **Preview**
   - Open Cloud → Emails preview for signup/recovery to confirm the lime background renders correctly.

## Easier editing going forward
With shared `styles.ts`, future colour or font changes only need one edit instead of six files. Templates remain plain React Email TSX components, edited directly in the codebase and redeployed via the `auth-email-hook` function.
