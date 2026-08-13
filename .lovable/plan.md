# Email Notification Strategy & Implementation Plan

## Goal
Add branded transactional email notifications for buyers and sellers at the moments that matter, without leaving the app. Emails complement in-app alerts and push notifications and respect user preferences.

## Current State
- Auth emails (signup, magic link, password reset, etc.) are live via `notify.finditonflea.com` and use the lime-green Flea brand.
- In-app notifications and push notifications already fire for sales, shipping, refunds, offers, comments, reviews, etc.
- Contact-form submissions already enqueue transactional emails directly to the `transactional_emails` queue.
- There is no reusable `send-transactional-email` wrapper, no marketplace event templates, and no granular email preferences beyond a single `marketing_opt_in` toggle.
- The `process-email-queue` Edge Function and `transactional_emails` queue are already in place.

## Recommended Email Touchpoints

### Buyer emails
1. **Welcome** - after first signup / email verification.
2. **Order confirmation** - immediately after successful checkout, with item summary and order code.
3. **Order shipped** - when seller marks item shipped (include tracking link if available).
4. **Order delivered** - when carrier scan confirms delivery or buyer marks delivered.
5. **Refund requested** - confirmation that buyer's refund request was submitted.
6. **Refund approved / rejected** - outcome of refund request.
7. **Refund sent** - when money is returned to buyer's payment method.
8. **Offer accepted / declined / countered** - status of any offer the buyer made.
9. **Item in cart/wishlist sold** - optional, low frequency.
10. **Review received** - when the seller leaves a review on the buyer.

### Seller emails
1. **Sale made** - immediately after checkout, with item, buyer, and earnings breakdown.
2. **Shipping reminder** - at 3 days and 6 days if order still unshipped.
3. **Order message from buyer** - when a new message is sent in an order thread.
4. **Offer received / countered / accepted / declined** - any offer activity on their listings.
5. **Refund requested** - buyer opened a refund request, with reason and required next steps.
6. **Refund sent / order refunded** - the order was refunded (auto or manual).
7. **Payout available** - funds are available and can be settled manually, or automatic payout summary.
8. **Payout failed / action required** - when Stripe/payout method needs attention.
9. **Review received** - when the buyer leaves a review on the seller.
10. **Verification status** - seller onboarding / ID verification approved or action required.

### Account / trust & safety emails
1. **Email changed** - already handled by auth email hook.
2. **Password changed** - already handled by auth email hook.
3. **Payout / bank details changed** - security notice.
4. **Suspicious login / new device** - optional future hardening.

## Implementation Plan

### 1. Scaffold transactional email infrastructure
- Run `email_domain--scaffold_transactional_email` to create:
  - `send-transactional-email` Edge Function.
  - `handle-email-unsubscribe` Edge Function and in-app unsubscribe page.
  - `handle-email-suppression` Edge Function.
  - Sample template registry in `supabase/functions/_shared/transactional-email-templates/`.
- This is safe because the domain is already verified and the queue already exists.

### 2. Build Flea-branded transactional templates
Create React Email `.tsx` templates in `supabase/functions/_shared/transactional-email-templates/`:
- `buyer-order-confirmation.tsx`
- `buyer-order-shipped.tsx`
- `buyer-order-delivered.tsx`
- `buyer-refund-requested.tsx`
- `buyer-refund-sent.tsx`
- `buyer-offer-status.tsx`
- `seller-sale-made.tsx`
- `seller-shipping-reminder.tsx`
- `seller-refund-requested.tsx`
- `seller-refund-sent.tsx`
- `seller-offer-status.tsx`
- `seller-review-received.tsx`
- `seller-payout-available.tsx`
- `seller-payout-failed.tsx`
- `seller-verification-status.tsx`
- `welcome.tsx`

All templates reuse the existing `supabase/functions/_shared/email-templates/styles.ts` tokens (lime card, charcoal text, rounded buttons) so the email background is the brand lime green as already requested.

### 3. Add granular email preferences
- Add columns to `public.profiles`:
  - `email_buyer_notifications` boolean default true
  - `email_seller_notifications` boolean default true
  - `email_offers` boolean default true
  - `email_shipping_reminders` boolean default true
  - `email_refunds` boolean default true
  - `email_reviews` boolean default true
- Update `src/integrations/supabase/types.ts` if not auto-generated.
- Add a new "Email notifications" sub-section inside Settings → Notifications with toggles for each category.
- Continue to respect `marketing_opt_in` for any future marketing sends (not covered here).

### 4. Create reusable send helper
- Create or extend `supabase/functions/_shared/sendTransactionalEmail.ts` with a helper that:
  - Looks up the recipient's email preferences.
  - Returns early if the category is disabled.
  - Generates an idempotency key from event + recipient + order/listing id.
  - Fetches or creates an unsubscribe token.
  - Enqueues to `transactional_emails` via `enqueue_email` RPC.
  - Logs to `email_send_log`.

### 5. Wire emails into existing event triggers
Update the following Edge Functions / flows to call the send helper after writing the in-app notification:
- `finalize-checkout` → buyer order confirmation + seller sale made.
- `order-messages` or message trigger → new order message email to recipient.
- Shipping reminder cron → seller shipping reminder.
- `offers` → offer received / countered / accepted / declined to both sides.
- Refund request flow → buyer refund requested + seller refund requested.
- `auto-refund-unshipped` / `auto-approve-refund-requests` / manual refund → buyer refund sent + seller refund sent.
- Review creation trigger → seller/buyer review received.
- Seller onboarding state change → verification status email.
- Payout completion/failure → payout available / payout failed.
- Welcome flow → welcome email (after first verified signup).

### 6. Unsubscribe and compliance
- Use the scaffolded unsubscribe footer on every transactional email.
- Ensure the unsubscribe link points to the in-app unsubscribe page route.
- Honor unsubscribe tokens in `email_unsubscribe_tokens` (already used by contact-form emails).
- Only send app/transactional emails tied to a specific user action or event.

### 7. Testing and monitoring
- Add preview data for each template so they can be tested from the Lovable email preview UI.
- Use idempotency keys to prevent duplicate sends on retries.
- Monitor `email_send_log` and DLQ counts in Cloud → Emails.
- Add a one-time backfill only if explicitly requested; otherwise new events trigger emails going forward.

## Out of Scope (for this plan)
- Marketing/promotional email campaigns (requires separate marketing email strategy).
- SMS notifications.
- Real-time delivery event webhooks from Mailgun (suppression already handled).

## Success Criteria
- Buyers receive order confirmation, shipping, delivery, refund, and offer emails.
- Sellers receive sale-made, shipping reminder, offer, refund, review, and payout emails.
- Every email uses Flea lime branding and includes a working unsubscribe link.
- Users can toggle email categories in Settings → Notifications.
- No duplicate emails on retries and no emails sent to users who have opted out.
