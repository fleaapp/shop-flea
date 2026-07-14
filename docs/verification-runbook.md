# Seller Verification Runbook

Internal doc. What to do when a seller is stuck at "Action required" or "Pending review".

## 1. Check the seller in the Stripe dashboard
1. Find the account by `stripe_account_id` on the profile.
2. Look at `requirements.currently_due`, `requirements.past_due`, `requirements.errors[]`, and `requirements.disabled_reason`.

## 2. Map the field to the fix

| `currently_due` field | What's happening | User-facing fix |
| --- | --- | --- |
| `individual.verification.document` | Original ID couldn't be verified. | Ask user to retake the ID via Settings → Payment Methods → Seller Dashboard → ID banner. |
| `individual.verification.additional_document` | Stripe wants a second doc (usually proof of address). | Direct user to embedded onboarding — Stripe hosts the extra doc upload. |
| `individual.first_name` / `last_name` | Name entered doesn't match ID name. | User must edit their legal name in the onboarding sheet, then re-upload. |
| `individual.dob.*` | DOB missing or invalid. | Re-enter DOB in onboarding. Users under 18 cannot be verified. |
| `external_account` | Bank details missing/invalid. | Re-add BSB + account number in embedded dashboard. |
| `tos_acceptance.date` | Stripe ToS not accepted. | Run onboarding again. |

## 3. Common `requirements.errors[].code` values

- `verification_document_photo_mismatch` — ID photo doesn't match selfie. Retake in good light.
- `verification_document_not_readable` — Blurry or glare. Retake, hold steady.
- `verification_document_expired` — Provide a current ID.
- `verification_document_type_not_supported` — Not an accepted AU doc. Use passport or full driver's licence.
- `verification_failed_keyed_match` / `verification_failed_other` — Data on ID doesn't match entered details. Check spelling of legal name and DOB.

## 4. Escalation
- If Stripe status hasn't updated 24h after the seller re-uploaded, check the `account.updated` webhook logs in `stripe-webhook` edge function.
- If everything looks correct but Stripe still rejects, open a support ticket at https://support.stripe.com and include the `acct_...` ID.

## 5. Never do
- Never ask the user for their ID or DOB over email or support chat. All verification goes through the in-app flow.
- Never store an uploaded ID image server-side. `stripe-connect-upload-id` streams it directly to Stripe Files.
