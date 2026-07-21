## Goal
Change the auth email sender name from `shop-flea` to `Flea`, and improve deliverability so verification emails stop landing in spam.

## Changes

### 1. Sender name → "Flea"
In `supabase/functions/auth-email-hook/index.ts`:
- Change `SITE_NAME = "shop-flea"` → `SITE_NAME = "Flea"`.
- This is what forms the From header: `Flea <hello@finditonflea.com>` instead of `shop-flea <hello@finditonflea.com>`.
- Templates already say "Flea" (hardcoded `BRAND` constant), so no template changes needed.

Then redeploy `auth-email-hook`.

### 2. Deliverability (spam-folder fix)
Verify DNS/domain health via `email_domain--check_email_domain_status` for `notify.finditonflea.com`. If SPF/DKIM/DMARC or NS delegation shows any issue, surface the exact records the user needs to fix at their registrar (from the tool output).

Content-side improvements to reduce spam scoring in the signup template (`supabase/functions/_shared/email-templates/signup.tsx`):
- Tighten subject line to a clear transactional phrase ("Confirm your email for Flea").
- Ensure preview text is descriptive (already is).
- Templates already render plain-text alongside HTML via `renderAsync({ plainText: true })` — no change needed.

Note: the biggest single deliverability win is a proper "From" name matching brand + verified DKIM/SPF, both of which this plan addresses. Ongoing spam placement past that depends on sending reputation which builds over time.

## Files touched
- `supabase/functions/auth-email-hook/index.ts` (SITE_NAME, subject)
- Redeploy `auth-email-hook`
- No template file structural changes required
