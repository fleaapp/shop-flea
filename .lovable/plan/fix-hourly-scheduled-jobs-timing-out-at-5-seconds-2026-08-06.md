# Fix hourly scheduled jobs timing out at 5 seconds

## Status of the three reported issues

All three are resolved and verified:

- 17track webhook accepts live carrier pushes.
- Seller Stripe status check no longer returns 500s.
- Scheduled tracking sync now authenticates - live run returned success, and both jobs are active on the corrected config.

## New issue found

In the last 24 hours the scheduled job log shows 12 requests that never got a response, three every hour on the hour, each ending in "Timeout of 5000 ms reached". The jobs that run on the hour are the refund auto-approval and the saved-search match notifier. They are slower than the default 5 second wait pg_net allows, so the scheduler gives up waiting and records a failure.

The functions themselves most likely still finish their work - the timeout is on the waiting side, not the function side - but it means there is no success or failure record for those runs, so a real failure would be invisible.

## Fix

Reschedule the affected hourly jobs with an explicit longer request timeout (60 seconds) so the scheduler waits for the function to finish and records the real result:

- `auto-approve-refund-requests-hourly`
- `flea-auto-approve-refunds`
- `notify-saved-search-matches-hourly`

Then confirm on the next hour boundary that those runs record a 200 status instead of a timeout.

## Technical notes

- `net.http_post` takes a `timeout_milliseconds` argument; the default is 5000. Set it to 60000 on each of these jobs.
- No edge function code changes and no schema changes - this is only the cron job definitions.
- Job schedules, URLs, bodies and auth headers stay exactly as they are.
