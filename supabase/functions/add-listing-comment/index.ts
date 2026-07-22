import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { logEdgeError } from "../_shared/logError.ts";

type NotificationInsert = {
  user_id: string;
  type: "new_comment" | "comment_reply";
  title: string;
  message: string;
  related_listing_id: string;
  related_user_id: string;
};

async function getVerifiedUserId(req: Request, supabaseUrl: string, anonKey: string): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;

  try {
    const verifier = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await verifier.auth.getUser(token);
    if (error || !data.user?.id) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function firePushNotification(userId: string, notification: NotificationInsert) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const res = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ user_id: userId, notification }),
  });

  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const userId = await getVerifiedUserId(req, supabaseUrl, anonKey);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const listingId = typeof body.listingId === "string" ? body.listingId.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const parentId = typeof body.parentId === "string" && body.parentId.trim() ? body.parentId.trim() : null;

    if (!listingId) return json({ error: "listingId is required." }, 400);
    if (!content || content.length > 1000) return json({ error: "Comment must be 1–1000 characters." }, 400);

    const svc = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const [{ data: profile, error: profileError }, { data: listing, error: listingError }] = await Promise.all([
      svc.from("profiles").select("username, status").eq("user_id", userId).maybeSingle(),
      svc.from("listings").select("id, user_id, title, status").eq("id", listingId).maybeSingle(),
    ]);

    if (profileError) throw profileError;
    if (listingError) throw listingError;
    if (!listing) return json({ error: "Listing not found." }, 404);
    if (profile?.status === "blocked") return json({ error: "Your account is restricted. You cannot post comments." }, 403);

    let parentAuthorId: string | null = null;
    if (parentId) {
      const { data: parent, error: parentError } = await svc
        .from("listing_comments")
        .select("id, user_id, listing_id")
        .eq("id", parentId)
        .maybeSingle();
      if (parentError) throw parentError;
      if (!parent || parent.listing_id !== listingId) return json({ error: "Parent comment not found." }, 404);
      parentAuthorId = parent.user_id;
    }

    const { data: comment, error: commentError } = await svc
      .from("listing_comments")
      .insert({ listing_id: listingId, user_id: userId, content, parent_id: parentId })
      .select("id, listing_id, user_id, content, parent_id, created_at")
      .single();

    if (commentError) throw commentError;

    const username = profile?.username || "@user";
    const listingTitle = String(listing.title || "item").slice(0, 30);
    const notifications: NotificationInsert[] = [];

    if (parentAuthorId && parentAuthorId !== userId) {
      notifications.push({
        user_id: parentAuthorId,
        type: "comment_reply",
        title: "New Reply",
        message: `${username} replied to your comment on "${listingTitle}".`,
        related_listing_id: listingId,
        related_user_id: userId,
      });
    }

    if (listing.user_id && listing.user_id !== userId && (!parentAuthorId || listing.user_id !== parentAuthorId)) {
      notifications.push({
        user_id: listing.user_id,
        type: "new_comment",
        title: "New Comment",
        message: `${username} commented on your listing "${listingTitle}".`,
        related_listing_id: listingId,
        related_user_id: userId,
      });
    }

    const pushResults: Array<Record<string, unknown>> = [];
    if (notifications.length > 0) {
      const { error: notificationError } = await svc.from("notifications").insert(notifications);
      if (notificationError) throw notificationError;

      for (const notification of notifications) {
        try {
          pushResults.push({ user_id: notification.user_id, ...(await firePushNotification(notification.user_id, notification)) });
        } catch (pushError) {
          await logEdgeError({
            functionName: "add-listing-comment",
            title: "Comment push failed",
            error: pushError,
            severity: "warning",
            userId: notification.user_id,
            context: { listing_id: listingId, notification_type: notification.type },
          });
          pushResults.push({ user_id: notification.user_id, ok: false, error: pushError instanceof Error ? pushError.message : String(pushError) });
        }
      }
    }

    return json({ ok: true, comment, notifications_created: notifications.length, push_results: pushResults });
  } catch (err) {
    console.error("[add-listing-comment] error:", err);
    await logEdgeError({
      functionName: "add-listing-comment",
      title: "Listing comment failed",
      error: err,
      severity: "error",
      httpStatus: 500,
    });
    return json({ error: err instanceof Error ? err.message : "Failed to add comment." }, 500);
  }
});