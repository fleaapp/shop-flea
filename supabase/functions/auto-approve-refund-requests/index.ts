// auto-approve-refund-requests
// Cron entrypoint. Finds refund requests whose 72h seller-response window
// has elapsed without an approve or decline, and issues the refund on the
// seller's behalf via stripe-connect-refund (called with the service-role
// key so it treats us as a system caller).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

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

  // Distinct order groups (or standalone orders) that are past the 72h
  // deadline and still awaiting a seller response.
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

  // Collapse bundles: refunding any order in a group cascades to siblings
  // inside stripe-connect-refund, so we only need one call per group.
  const seenGroups = new Set<string>();
  const targets: Array<{ orderId: string; groupId: string | null }> = [];
  for (const row of rows) {
    const key = row.order_group_id ?? `single:${row.id}`;
    if (seenGroups.has(key)) continue;
    seenGroups.add(key);
    targets.push({ orderId: row.id, groupId: row.order_group_id });
  }

  const results: Array<{ orderId: string; ok: boolean; error?: string }> = [];
  for (const t of targets) {
    try {
      const refundRes = await fetch(`${supabaseUrl}/functions/v1/stripe-connect-refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({ orderId: t.orderId, reason: "requested_by_customer" }),
      });
      const body = await refundRes.json().catch(() => ({}));
      if (!refundRes.ok || (body && body.error)) {
        const err = (body && body.error) || `HTTP ${refundRes.status}`;
        results.push({ orderId: t.orderId, ok: false, error: String(err) });
        console.error("[auto-approve-refund-requests] refund failed", t.orderId, err);
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
            error_stack: JSON.stringify({ orderId: t.orderId, body }),
            severity: "error",
            source: "auto-approve-refund-requests",
          }),
        }).catch(() => {});
        continue;
      }
      results.push({ orderId: t.orderId, ok: true });
    } catch (e: any) {
      console.error("[auto-approve-refund-requests] exception", t.orderId, e);
      results.push({ orderId: t.orderId, ok: false, error: e?.message || String(e) });
    }
  }

  return json({ scanned: rows.length, processed: results.length, results });
});
