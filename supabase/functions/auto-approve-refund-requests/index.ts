// auto-approve-refund-requests
// Cron entrypoint for the Vinted-style dispute clock. It no longer refunds
// automatically. Each run it:
//   1. Reminds sellers whose 14 day response window is running out.
//   2. Escalates lapsed requests into the admin dispute queue.
//   3. Closes returns the buyer never posted within their 5 day window.
//
// Money only ever moves through stripe-connect-refund, triggered either by a
// seller/admin decision or by a return parcel being scanned as delivered.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { logEdgeError } from "../_shared/logError.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Service not configured" }, 500);
  }

  // Cron-only endpoint: require the service-role bearer or the cron secret.
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  const providedCron = req.headers.get("x-cron-secret") ?? "";
  const authorized =
    authHeader === `Bearer ${serviceKey}` ||
    (!!cronSecret && providedCron === cronSecret);
  if (!authorized) {
    return json({ error: "Unauthorized" }, 401);
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  const rpc = async (fn: string) => {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers,
      body: "{}",
    });
    if (!res.ok) throw new Error(`${fn}: ${await res.text()}`);
    return await res.json().catch(() => 0);
  };

  try {
    // ---- 1. Seller reminders while the 14 day window is still open ----
    const nowIso = new Date().toISOString();
    const soonIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const pendingUrl =
      `${supabaseUrl}/rest/v1/orders?select=id,seller_id,order_number,refund_request_deadline_at` +
      `&refund_requested_at=not.is.null&refund_declined_at=is.null&refunded_at=is.null` +
      `&refund_escalated_at=is.null&return_required_at=is.null` +
      `&refund_request_deadline_at=gt.${encodeURIComponent(nowIso)}` +
      `&refund_request_deadline_at=lt.${encodeURIComponent(soonIso)}&limit=200`;
    const pendingRes = await fetch(pendingUrl, { headers });
    const pending: Array<{
      id: string;
      seller_id: string;
      order_number: string | null;
      refund_request_deadline_at: string;
    }> = pendingRes.ok ? await pendingRes.json() : [];

    let reminded = 0;
    for (const order of pending) {
      const daysLeft = Math.ceil(
        (new Date(order.refund_request_deadline_at).getTime() - Date.now()) / 86400000,
      );
      if (![7, 2, 1].includes(daysLeft)) continue;

      // Never send the same reminder twice in a day.
      const sinceIso = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
      const dupUrl =
        `${supabaseUrl}/rest/v1/notifications?select=id&type=eq.refund_response_reminder` +
        `&related_order_id=eq.${order.id}&created_at=gt.${encodeURIComponent(sinceIso)}&limit=1`;
      const dupRes = await fetch(dupUrl, { headers });
      const dup = dupRes.ok ? await dupRes.json() : [];
      if (Array.isArray(dup) && dup.length) continue;

      await fetch(`${supabaseUrl}/rest/v1/notifications`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          user_id: order.seller_id,
          type: "refund_response_reminder",
          title: "⏳ Refund request needs your response.",
          message:
            daysLeft === 1
              ? "You have 1 day left to respond before Flea reviews this refund request."
              : `You have ${daysLeft} days left to respond before Flea reviews this refund request.`,
          related_order_id: order.id,
        }),
      }).catch(() => {});
      reminded++;
    }

    // ---- 2. Escalate lapsed requests to the admin dispute queue ----
    const escalated = await rpc("escalate_lapsed_refund_requests");

    // ---- 3. Close returns the buyer never posted ----
    const closedReturns = await rpc("close_stale_returns");

    return json({
      reminded,
      escalated,
      closedReturns,
    });
  } catch (e: any) {
    await logEdgeError({
      functionName: "auto-approve-refund-requests",
      error: e,
      title: "Scheduled job failed: refund dispute clock",
      severity: "error",
      source: "payment",
    });
    console.error("[auto-approve-refund-requests] error:", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});
