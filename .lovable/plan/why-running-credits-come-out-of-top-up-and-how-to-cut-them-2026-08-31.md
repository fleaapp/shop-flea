# Why running credits come out of top-up, and how to cut them

## What the billing data shows

Workspace: Pro, period Aug 11 - Sep 11.

- Daily grant: 5.00 credits, still fully unused today.
- Monthly billing grant: 0.00 left of 100.
- Rollover: 0.00 left of 100.
- Top-up: 8.54 left (this is what running costs are now eating).
- Period usage so far: 253.46 credits.

Breakdown for the period:

```text
Build mode messages     106.60
Plan mode messages       79.20
Cloud compute small      50.44
Project Monitoring       15.10
Cloud compute pico        2.02
Everything else (fn/egress/storage) ~0.10
```

## Why daily credits are not paying for it

Daily credits are build-time credits. They cover chat: build mode, plan mode, visual edits. They do **not** apply to run-time usage (Cloud compute, storage, egress, functions, monitoring), and they expire at the end of each day rather than banking.

Run-time usage draws in this order: free monthly Cloud allowance (20 credits) -> monthly billing credits -> rollover -> top-up. Your billing and rollover buckets are already at zero for this period, so every hour of Cloud compute now comes straight out of top-up. That is why it drains while the app sits idle - the database instance bills 24/7 whether or not you open the project.

## Where the ~2.95/day actually goes

Almost all of it is `Cloud compute small` (50.44 credits over the period, roughly 1.7-2.5/day) plus `Project Monitoring` (15.10). Functions, storage and egress are effectively free at your traffic level.

## Options to reduce it

1. **Resize the database compute down.** The project is on the `small` instance. Your real data is a few MB; the workload is tiny. Dropping to `micro` or `nano` roughly halves to quarters the largest line item. Requires a short restart.
2. **Reclaim the disk bloat.** The earlier audit found ~3.4 GB of `cron.job_run_details` log rows on a database with a handful of orders. Purging those and adding a nightly 7-day retention job removes the pressure that justified a bigger instance/disk in the first place. Do this before or alongside the resize.
3. **Trim cron frequency.** Several jobs run every 10-15 minutes and keep compute awake. Consolidating the ones that touch the same tables into fewer, less frequent runs lowers sustained CPU.
4. **Turn off Project Monitoring** if you are not actively using its findings - that is 15.10 credits this period on its own.
5. **Top up or wait.** Billing and rollover credits refresh at the start of the next billing period (Sep 11); until then run-time usage keeps drawing from the 8.54 top-up credits remaining.

## Suggested action

Do 2 then 1, in that order: purge the cron log table and add nightly retention, then resize compute down a tier and watch the daily run-time figure for a couple of days. Combined, that should take running cost from ~2.95/day to well under 1/day without touching app behaviour.

Nothing here changes app code or user-facing behaviour.
