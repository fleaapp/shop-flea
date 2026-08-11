# Apple App Review — Test Account Setup

Apple reviewers need to reach every gated screen, including the seller ID verification flow. Prepare the following before each submission.

## Reviewer login
- Username: `@applereview`
- Email: `appreview@finditonflea.com`
- Password: (rotated per submission — put in App Store Connect "Sign-in Information")

## Apple Pay (real Apple Pay sheet, no charge)
The `@applereview` account ships with a pre-filled AU shipping address (1 Apple Park Way, Sydney NSW 2000), so checkout is not blocked at the shipping gate.

When the reviewer taps Apple Pay:
1. `stripe-connect-payment-intent` detects `profiles.is_apple_reviewer = true` and creates a **platform-account authorize-only** PaymentIntent (`capture_method: manual`) for the correct AUD total (items + shipping + secure checkout fee).
2. The real Apple Pay sheet opens with that total. The reviewer authorizes.
3. The PaymentIntent lands in `requires_capture`.
4. `finalize-checkout` verifies the payment (`requires_capture` counts as paid), creates the orders as `payment_method = "demo"` (no seller transfer or payout), then **voids the authorization** (`paymentIntents.cancel`).

No charge ever posts. A temporary card authorization hold may appear on the reviewer's card and drop off within a few days — standard and reversible for App Review.

Manual card checkout also works via the same reviewer path.

## Reaching the ID verification screen
To let the reviewer see the ID capture step:
1. Create a second test seller account in Stripe **sandbox** with `individual.verification.document` in `currently_due`.
2. Attach the sandbox `acct_...` to a throwaway user (e.g. `@applereview_id`).
3. Log in as that user → Settings → Payment Methods → tap the "Action required" row. The ID sheet opens.

Do **not** submit real IDs from Apple reviewers. The screen text tells reviewers this is optional and that they can back out at any time.

## Reviewer notes to include in App Store Connect
> This is an Australia-only C2C marketplace. To become a seller, users complete identity verification via our payment processor. The ID capture screen only appears when the processor requests additional documentation. Use the `@applereview` credentials above to browse and buy.
>
> The reviewer account has a pre-filled Australian shipping address, so you can reach checkout. Tap Apple Pay to open the real Apple Pay sheet with the correct AUD total. The authorization is voided immediately after — no charge posts to the card. Manual card checkout also works.
>
> To view the seller onboarding flow, tap Settings → Payment Methods → Become a Seller. To view the ID verification screen, use the `@applereview_id` test account provided.
