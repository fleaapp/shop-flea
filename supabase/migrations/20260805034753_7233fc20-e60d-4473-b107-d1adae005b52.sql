select cron.schedule(
  'invoke-tracking-sync-fresh-hourly',
  '15 * * * *',
  $$
  select net.http_post(
    url := 'https://teaicrimlqdayqpmxasc.supabase.co/functions/v1/tracking-sync',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlYWljcmltbHFkYXlxcG14YXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MDcxNjYsImV4cCI6MjA4NTA4MzE2Nn0.dsK_39AYUqMvjjj8__z73_oiVAUbQl8nYY6pvMD_-6w"}'::jsonb,
    body := '{"mode": "fresh"}'::jsonb
  ) as request_id;
  $$
);