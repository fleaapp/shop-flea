# Fix: user-side support chat shows no messages

## Diagnosis

Admin sees user messages (they're being written), and support replies are being inserted (function works), but the user's `ChatConversation` view shows nothing. `ChatConversation.tsx` fetches with a plain `.select('*')` from the external Supabase, so if RLS blocks the read, both the user's own messages and support replies disappear from that view — exactly the symptom described.

The likely gaps on the **external** Supabase (source of truth):

1. `chat_messages` SELECT policy does not allow the thread owner to read rows where `sender_type = 'support'` (or the policy is missing entirely on external, unlike the Cloud proxy).
2. `chat_threads` SELECT policy may not let the user read their own thread row, so the header state also falls back.
3. Realtime replication may not be enabled for `chat_messages` / `chat_threads` on external, so even after fixing RLS, new support replies won't stream in.

## Changes

### 1. External Supabase RLS (via migration against external DB)
- Drop and recreate `chat_messages` SELECT policy so any authenticated user can read every row in a thread they own:
  ```sql
  create policy "Users read all messages in their threads"
  on public.chat_messages for select to authenticated
  using (exists (select 1 from public.chat_threads t
                 where t.id = chat_messages.thread_id
                   and t.user_id = auth.uid()));
  ```
- Ensure a matching SELECT policy exists on `chat_threads` for `auth.uid() = user_id`.
- Confirm `GRANT SELECT ON public.chat_messages, public.chat_threads TO authenticated` is in place.

### 2. Realtime
- Add both tables to `supabase_realtime` publication on external if not already:
  ```sql
  alter publication supabase_realtime add table public.chat_messages;
  alter publication supabase_realtime add table public.chat_threads;
  ```

### 3. Verification
- Reload PostgREST schema cache via existing `reload-schema` function.
- Manually open a thread as the affected user and confirm both prior user messages and support replies render, and that new support replies appear live without reload.

## Out of scope
No UI changes; `ChatConversation.tsx` and `NewChatForm.tsx` logic is correct once RLS allows the reads.
