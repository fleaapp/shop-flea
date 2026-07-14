# Apple App Review — Test Account Setup

Apple reviewers need to reach every gated screen, including the seller ID verification flow. Prepare the following before each submission.

## Reviewer login
- Username: `@applereview`
- Email: `appreview@finditonflea.com`
- Password: (rotated per submission — put in App Store Connect "Sign-in Information")

## Demo bypass (already implemented)
`stripe-connect-status` recognises the `@applereview` username + email combo and returns a fully-verified state for synthetic `acct_demo_*` accounts. This lets the reviewer list, buy, and reach the Seller Dashboard without touching Stripe.

## Reaching the ID verification screen
To let the reviewer see the ID capture step:
1. Create a second test seller account in Stripe **sandbox** with `individual.verification.document` in `currently_due`.
2. Attach the sandbox `acct_...` to a throwaway user (e.g. `@applereview_id`).
3. Log in as that user → Settings → Payment Methods → tap the "Action required" row. The ID sheet opens.

Do **not** submit real IDs from Apple reviewers. The screen text tells reviewers this is optional and that they can back out at any time.

## Reviewer notes to include in App Store Connect
> This is an Australia-only C2C marketplace. To become a seller, users complete identity verification via our payment processor. The ID capture screen only appears when the processor requests additional documentation. Use the credentials above to browse and buy. To view the seller onboarding flow, tap Settings → Payment Methods → Become a Seller. To view the ID verification screen, use the `@applereview_id` test account provided.
