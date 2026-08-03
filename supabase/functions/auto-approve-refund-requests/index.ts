// auto-approve-refund-requests
// Cron entrypoint. Finds refund requests whose 72h seller-response window
// has elapsed without an approve or decline, and issues the refund on the
// seller's behalf via stripe-connect-refund (called with the service-role
// key so it treats us as a system caller).
//
// Refunds are processed per order row so that multi-item bundles only refund
// the specific items whose buyers requested a refund.

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

  // Order rows that are past the 72h deadline and still awaiting a seller response.
  const nowIso = new Date().toISOString();
  const url =
    `${supabaseUrl}/rest/v1/orders?select=id,order_group_id,refund_request_deadline_at` +
    `&refund_requested_at=not.is.null` +
    `&refund_declined_at=is.null` +
    `&refunded_at=is.null` +
    `&refund_request_deadline_at=lt.${encodeURIComponent(nowIso)}` +
    `&order=refund_request_deadline_at.asc&limit=100`;

  const listRes = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!listRes.ok) {
    const text = await listRes.text();
    console.error("[auto-approve-refund-requests] list failed:", listRes.status, text);
    return json({ error: "Failed to list refund requests", detail: text }, 500);
  }
  const rows: Array<{ id: string; order_group_id: string | null }> = await listRes.json();

  // Process each row individually. stripe-connect-refund in "single" mode only
  // refunds the requested item and reverses only that item's share of the
  // seller transfer, leaving the rest of the bundle intact.
  const results: Array<{ orderId: string; ok: boolean; error?: string }> = [];
  for (const row of rows) {
    try {
      const refundRes = await fetch(`${supabaseUrl}/functions/v1/stripe-connect-refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({ orderId: row.id, reason: "requested_by_customer", mode: "single" }),
      });
      const body = await refundRes.json().catch(() => ({}));
      if (!refundRes.ok || (body && body.error)) {
        const err = (body && body.error) || `HTTP ${refundRes.status}`;
        results.push({ orderId: row.id, ok: false, error: String(err) });
        console.error("[auto-approve-refund-requests] refund failed", row.id, err);
        await fetch(`${supabaseUrl}/rest/v1/error_logs`, {
          method: "POST",
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            error_message: `auto-approve-refund-requests: ${err}`,
            error_stack: JSON.stringify({ orderId: row.id, body }),
            severity: "error",
            source: "auto-approve-refund-requests",
          }),
        }).catch(() => {});
        continue;
      }
      results.push({ orderId: row.id, ok: true });
    } catch (e: any) {
      await logEdgeError({ functionName: "auto-approve-refund-requests", error: e, title: "Scheduled job failed: refund auto-approval", severity: "error", source: "payment" });
      console.error("[auto-approve-refund-requests] exception", row.id, e);
      results.push({ orderId: row.id, ok: false, error: e?.message || String(e) });
    }
  }

  return json({ scanned: rows.length, processed: results.length, results });
});
