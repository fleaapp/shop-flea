# Email Notifications - Essentials Only

Start with the most important emails people actually need in their inbox. Everything else stays as in-app alerts and push notifications.

## The starting set (9 emails)

### Buyer
1. **Order confirmation** - sent right after checkout. Order code, items, totals, delivery expectations. This doubles as their receipt.
2. **Order shipped** - sent when the seller marks the item shipped, with the carrier and tracking number.
3. **Refund requested** - confirmation that their refund request was submitted and what happens next.
4. **Refund sent** - sent when money is actually returned to their payment method.
5. **Offer status** - sent when a seller accepts, declines, or counters an offer they made.

### Seller
6. **Item sold** - sent right after checkout. What sold, what they earn, and a clear "post it within 6 days" instruction.
7. **Shipping reminder** - single reminder if the item still has no tracking after 6 days, warning that an unshipped order is auto-refunded at day 8.
8. **Refund issued** - sent when an order they sold is refunded (buyer request approved, auto-refund, or seller cancellation), with the amount and reason.
9. **Payout available** - sent when funds clear and can be settled to their bank, or when an automatic payout completes.

Everything else - comments, reviews, messages, delivery confirmations, verification updates - stays push and in-app only for now. Easy to add later once these nine are proven.

## Why these nine
They cover the moments where money moves, where someone has to act, or where a deal is at risk. Missing an in-app alert for a comment is harmless; missing "your item sold, post it in 6 days" or "your offer was accepted" costs a sale or a refund.

## What gets built

**1. Transactional email plumbing**
Scaffold the send function, the unsubscribe handler, and the suppression handler. The sender domain is already verified and the email queue is already live, so this is wiring, not new infrastructure.

**2. Nine branded templates**
All using the existing Flea lime email styling already used by the auth emails - same lime background, charcoal text, rounded buttons. Each email links straight back to the relevant order, sale, or offer screen in the app.

**3. One email preference toggle**
A single "Order emails" toggle inside Settings - Notifications, next to the existing Push notifications and Marketing emails toggles. On by default. Turning it off stops all nine.

**4. Hooked into the existing events**
Each email fires from the same place its push notification already fires from, so the two always agree. Sends are keyed to the order or offer so a retry can never double-send.

**5. Unsubscribe page**
A branded in-app page for the unsubscribe link required in the footer of every email.

## Technical notes
- Templates live in `supabase/functions/_shared/transactional-email-templates/` as React Email components, reusing the tokens in `_shared/email-templates/styles.ts`.
- Sends go through the existing `transactional_emails` pgmq queue via `enqueue_email`, the same path `contact-form-submit` already uses.
- New `profiles.email_order_notifications` boolean, default true, checked in a shared helper before enqueuing.
- Trigger points: `finalize-checkout` (buyer confirmation + seller sale), the mark-as-shipped flow, the 6-day shipping reminder cron, refund request creation, refund approval/auto-refund/seller cancellation, offer accept/decline/counter, and payout settlement.
- Idempotency key per event: event name + order id or offer id + recipient.
