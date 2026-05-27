-- Restrict Realtime channel subscriptions so users can only subscribe to
-- their own user-scoped topics (e.g. "notifications-<their uid>"). Without
-- this, any authenticated user could subscribe to any topic name and receive
-- broadcasts intended for other users.

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can subscribe to own user topics" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to own user topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Allow only topics that end with the user's own UID. App-side channel
  -- names follow the pattern "<prefix>-<auth.uid()>".
  (realtime.topic()) LIKE ('%' || auth.uid()::text)
);

-- Block all non-broadcast/postgres_changes writes from clients.
DROP POLICY IF EXISTS "Block client realtime writes" ON realtime.messages;
CREATE POLICY "Block client realtime writes"
ON realtime.messages
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (false);