import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTERNAL_PUBLIC_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "";
const EXTERNAL_PUBLIC_ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";
const EXTERNAL_SERVICE_ROLE_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!EXTERNAL_PUBLIC_URL || !EXTERNAL_PUBLIC_ANON_KEY || !EXTERNAL_SERVICE_ROLE_KEY) {
      return json({ error: "Mention notifications are not configured." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    const externalClient = createClient(EXTERNAL_PUBLIC_URL, EXTERNAL_PUBLIC_ANON_KEY, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: authError,
    } = await externalClient.auth.getUser();

    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { listingId, content } = await req.json();

    if (typeof listingId !== "string" || !listingId.trim()) {
      return json({ error: "listingId is required." }, 400);
    }

    if (typeof content !== "string" || !content.trim()) {
      return json({ error: "content is required." }, 400);
    }

    const trimmedContent = content.trim();
    const mentionHandles = Array.from(
      new Set(
        (trimmedContent.match(/@[\w]+/g) ?? [])
          .map((mention) => mention.replace(/^@/, "").trim().toLowerCase())
          .filter(Boolean),
      ),
    ).slice(0, 10);

    if (mentionHandles.length === 0) {
      return json({ inserted: 0 });
    }

    const mentionFilters = mentionHandles.flatMap((handle) => [
      `username.ilike.${handle}`,
      `username.ilike.@${handle}`,
    ]);

    const serviceClient = createClient(EXTERNAL_PUBLIC_URL, EXTERNAL_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: mentionedProfiles, error: profileError } = await serviceClient
      .from("profiles")
      .select("user_id, username")
      .or(mentionFilters.join(","))
      .limit(mentionHandles.length * 2);

    if (profileError) {
      throw profileError;
    }

    const notificationsToInsert = Array.from(
      new Map(
        (mentionedProfiles ?? [])
          .filter((profile) => {
            const normalizedUsername = profile.username?.replace(/^@/, "").toLowerCase();
            return !!normalizedUsername && mentionHandles.includes(normalizedUsername) && profile.user_id !== user.id;
          })
          .map((profile) => [
            profile.user_id,
            {
              user_id: profile.user_id,
              type: "mention",
              title: "You were mentioned in a comment",
              message: trimmedContent.slice(0, 100),
              related_listing_id: listingId,
              related_user_id: user.id,
            },
          ]),
      ).values(),
    );

    if (notificationsToInsert.length === 0) {
      return json({ inserted: 0 });
    }

    const { error: insertError } = await serviceClient
      .from("notifications")
      .insert(notificationsToInsert);

    if (insertError) {
      throw insertError;
    }

    // Send push notifications for each mentioned user (fire-and-forget)
    const pushUrl = `${EXTERNAL_PUBLIC_URL}/functions/v1/send-push-notification`;
    // We don't have the Cloud URL here, so call send-push via the external edge function URL
    // Actually, send-push is on Lovable Cloud. Use the Cloud URL from env.
    const cloudUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const cloudServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    for (const notif of notificationsToInsert) {
      try {
        await fetch(`${cloudUrl}/functions/v1/send-push-notification`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${cloudServiceKey}`,
          },
          body: JSON.stringify({
            user_id: notif.user_id,
            notification: {
              type: notif.type,
              title: notif.title,
              message: notif.message,
              related_listing_id: notif.related_listing_id,
            },
          }),
        });
      } catch (pushErr) {
        console.error("[comment-mentions] Push failed for user:", notif.user_id, pushErr);
      }
    }

    return json({ inserted: notificationsToInsert.length });
  } catch (error) {
    console.error("[comment-mentions] Failed to create mention notifications:", error);
    return json(
      {
        error: error instanceof Error ? error.message : "Failed to create mention notifications.",
      },
      500,
    );
  }
});