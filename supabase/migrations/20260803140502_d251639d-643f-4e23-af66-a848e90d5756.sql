
SELECT cron.unschedule('notify-saved-search-matches-hourly');

SELECT cron.schedule(
  'notify-saved-search-matches-hourly',
  '0 * * * *',
  $cron$
  select net.http_post(
    url:='https://teaicrimlqdayqpmxasc.supabase.co/functions/v1/notify-saved-search-matches',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret','5a00d8564354d94e3b6c71bea125208470f5b486a95a62632e7ef4483aeda339'
    ),
    body:='{}'::jsonb
  ) as request_id;
  $cron$
);
