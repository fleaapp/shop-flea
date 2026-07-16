No changes required. The user was confirming the existing ID / extra-verification setup, which is already implemented as described:

- `stripe-connect-status` surfaces `needsIdDocument`, `currentlyDue`, and `verificationError`.
- `IdVerificationStep` handles native ID capture (front + back for AU licence, single image for passport) and streams to `stripe-connect-upload-id`.
- Non-ID requirements route through embedded `ConnectAccountOnboarding` inside `SellerOnboardingSheet`.
- Listing / checkout gated on `chargesEnabled`; withdraw gated on `payoutsEnabled`.
- `stripe-webhook` clears state on `account.updated`.
- `docs/verification-runbook.md` documents field-to-fix mapping.

Approve this plan to close out with no code changes.