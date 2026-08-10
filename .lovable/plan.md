# Flea: Running Costs and Financial Viability

Based on live inspection of the backend (database size, table sizes, storage buckets, cron jobs, 53 edge functions, integrations) plus the current fee structure.

## What was measured

- Database size today: 3.45 GB with only 9 profiles, 23 listings, 7 orders.
- 3.43 GB of that (over 99%) is `cron.job_run_details` - the history log of scheduled jobs. One orphaned job (jobid 2, the 5-second email-queue dispatcher) has logged 876,347 runs since May and its history is never purged.
- Real app data is tiny: all business tables together are under 5 MB.
- Storage: 65 listing images = 10 MB (avg ~155 KB/image), plus 500 KB of order attachments.
- 11 active cron jobs; the busiest run every 10-15 minutes.
- 53 edge functions. Payments (Stripe Connect), tracking (17track), email (Resend), push.
- Content moderation is a local wordlist - no AI/LLM spend anywhere in the backend.

## Cost per transaction

Assuming a typical AU order of $40 item + $10 shipping = $50 charged.

Revenue:
- Buyer secure checkout fee: 4% + $0.70 = $2.70
- Seller transaction fee: 2% + $0.50 = $1.30
- Total gross revenue: ~$4.00 per order

Costs:
- Card processing (Stripe AU domestic, 1.75% + $0.30 on the full ~$52.70 charged): ~$1.22
- Connect Standard: no extra per-charge platform fee; seller pays their own payout costs on Standard
- 17track registration: ~$0.005-0.01 per parcel
- Push, email (Resend), edge function invocations for the order lifecycle: well under $0.02
- Amortised infra: negligible per order at low volume

Net contribution: **~$2.75 per order, or roughly 5.5% of GMV.** That is a healthy unit economic. Apple Pay/Google Pay do not add fees; international cards (2.9% + $0.30) would cut it to ~$2.15.

Watch item: on very low-value orders the maths inverts less than you'd think but tightens - a $10 item + $8 shipping yields ~$1.82 revenue against ~$0.62 processing, so still positive. There is no order where the current fee structure loses money on processing alone.

## Estimated monthly infrastructure cost

Assumes 20% of users transact monthly, ~1.5 listings/active seller, images at 155 KB.

| | 1k users | 10k users | 100k users |
|---|---|---|---|
| Database (compute + disk) | $10-25 | $60-110 | $250-500 |
| Storage (images) | ~$1 | $5-10 | $50-90 |
| Bandwidth/CDN egress | $5-15 | $50-150 | $500-1,500 |
| Edge functions | included | $10-30 | $100-300 |
| Email (Resend) | $0-20 | $20-40 | $90-200 |
| Push notifications | $0 | $0 | $0 |
| 17track | $5-15 | $50-120 | $500-1,200 |
| Hosting/CDN for the app | $0-20 | $20 | $20-100 |
| **Total/month** | **~$25-95** | **~$215-480** | **~$1,510-3,690** |

Against revenue: at 10k users (~2,000 orders/month) gross fee revenue is ~$8,000 and infra costs ~$350. At 100k users (~20,000 orders/month) revenue is ~$80,000 against ~$2,500 infra. **Infrastructure is 3-5% of fee revenue - it is not the thing that decides viability.**

## Whether the fees leave a healthy margin

Yes, on infrastructure. The real cost line is not servers, it is the trust-and-safety obligations the product has already committed to:

- Buyer protection refunds and chargebacks. A single chargeback costs $25 in Stripe dispute fees plus the refunded amount if lost. At a 0.3% dispute rate on 20,000 orders that is 60 disputes = $1,500 in fees per month plus losses - more than all infrastructure combined.
- Auto-refunds for unshipped orders after 8 days: if funds have already been released or the seller balance is empty, the platform eats it.
- Manual admin review (untracked deliveries, ID verification failures, disputes) is human time and scales close to linearly with users.

Budget 1-2% of GMV for fraud/refund losses and treat that, not hosting, as the margin risk. At that level the model still nets roughly 3.5-4.5% of GMV.

## Costs that could become unexpectedly expensive

1. **`cron.job_run_details` bloat - already happening.** 3.43 GB of pure log rows from an orphaned job, on a database with 7 orders. This alone could push the project onto a larger paid disk tier for no reason. Highest priority.
2. **Image bandwidth.** Card-stack browsing means every user pulls dozens of full-size images per session. Egress is the single fastest-growing line at 100k users. Images are 155 KB now, unoptimised in format.
3. **17track per-parcel pricing.** Linear with orders, and per-parcel plans get expensive above ~10,000 parcels/month. Renegotiate or move to volume tiers before then.
4. **`net._http_response`** (2 MB) also accumulates from `pg_net` calls and is not pruned.
5. **Cron frequency.** Jobs every 10-15 minutes wake compute constantly; harmless now, but each one is an edge function invocation billed at scale.
6. **Stripe international card mix.** Every non-AU card cuts per-order margin by roughly 40%.
7. **Chargebacks** - see above, the largest single scale risk.

## What to change now (cheap fixes, large payoff)

1. Purge `cron.job_run_details` and add a nightly job that deletes rows older than 7 days. Recovers ~3.4 GB immediately and permanently caps the growth.
2. Unschedule the orphaned jobid 2 dispatcher if it is still registered, and prune `net._http_response` on the same schedule.
3. Compress and resize listing images on upload (WebP, max ~1200px on the long edge). Cuts egress and storage 50-70% for no visible quality loss at the app's 4:5 card size.
4. Serve listing images with long cache headers so repeat card-stack views hit the CDN rather than storage.
5. Consolidate the hourly/15-minute cron jobs that touch the same tables into fewer combined runs.
6. Add a chargeback/refund loss line to the operating model and track it as a percentage of GMV from day one.
7. Consider a minimum order value or a slightly higher fixed component on sub-$15 orders if low-value volume grows.

## Bottom line

Yes - the model is financially viable and profitable as it scales. Roughly $4.00 of fee revenue against ~$1.25 of hard cost per order gives ~5.5% net take on GMV, and infrastructure never exceeds about 5% of fee revenue even at 100k users. The margin is not threatened by hosting; it is threatened by fraud, chargebacks and manual dispute handling. Fix the database log bloat and image weight now (both are unforced costs), keep loss rates under 2% of GMV, and the economics hold up at every tier modelled.

## Optional next step

If you want, the cleanup items 1-4 above can be implemented as a single change: a nightly retention job for cron/http logs, plus client-side image compression to WebP on listing upload.
