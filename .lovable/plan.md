# Email Notifications - Essentials Only

Start with the handful of emails people actually need in their inbox. Everything else stays as in-app alerts and push notifications.

## The starting set (6 emails)

### Buyer
1. **Order confirmation** - sent right after checkout. Order code, items, totals, delivery expectations. This doubles as their receipt.
2. **Order shipped** - sent when the seller marks the item shipped, with the carrier and tracking number.
3. **Refund sent** - sent when money is actually returned to their payment method.

### Seller
4. **Item sold** - sent right after checkout. What sold, what they earn, and a clear "post it within 6 days" instruction.
5. **Shipping reminder** - single reminder if the item still has no tracking after 6 days, warning that an unshipped order is auto-refunded at day 8.
6. **Refund issued** - sent when an order they sold is refunded (buyer request approved, auto-refund, or seller cancellation), with the amount and reason.

Everything else - offers, comments, reviews, messages, delivery confirmations, payout notices - stays push and in-app only for now. Easy to add later once these six are proven.

## Why these six
They are the moments where money moves or where someone has to act. Missing an in-app alert for a comment is harmless; missing "your item sold, post it in 6 days" costs the seller a refund and a bad review.

## What gets built

**1. Transactional email plumbing**
Scaffold the send function, the unsubscribe handler, and the suppression handler. The sender domain is already verified and the email queue is already live, so this is wiring, not new infrastructure.

**2. Six branded templates**
All using the existing Flea lime email styling already used by the auth emails - same lime background, charcoal text, rounded buttons. Each email links straight back to the relevant order or sale screen in the app.

**3. One email preference toggle**
A single "Order emails" toggle inside Settings - Notifications, next to the existing Push notifications and Marketing emails toggles. On by default. Turning it off stops all six.

**4. Hooked into the existing events**
Each email fires from the same place its push notification already fires from, so the two always agree. Sends are keyed to the order so a retry can never double-send.

**5. Unsubscribe page**
A branded in-app page for the unsubscribe link required in the footer of every email.

## Technical notes
- Templates live in `supabase/functions/_shared/transactional-email-templates/` as React Email components, reusing the tokens in `_shared/email-templates/styles.ts`.
- Sends go through the existing `transactional_emails` pgmq queue via `enqueue_email`, the same path `contact-form-submit` already uses.
- New `profiles.email_order_notifications` boolean, default true, checked in a shared helper before enqueuing.
- Trigger points: `finalize-checkout` (buyer confirmation + seller sale), the mark-as-shipped flow, the 6-day shipping reminder cron, and the refund paths (`auto-refund-unshipped`, refund approval, seller cancellation).
- Idempotency key per event: event name + order id + recipient.
