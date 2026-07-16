// One-off admin fix: adds refunded_at/refund_reason columns to external
// orders table (if missing) and marks the specified order(s) as refunded.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const dbUrl = Deno.env.get("EXTERNAL_SUPABASE_DB_URL") ?? Deno.env.get("SUPABASE_DB_URL") ?? "";
    if (!dbUrl) throw new Error("DB URL not set");
    console.log("[admin-fix-refund-schema] host:", new URL(dbUrl.replace("postgresql://", "http://")).host);
    const body = await req.json().catch(() => ({}));
    const orderId: string | undefined = body.orderId;
    const orderGroupId: string | undefined = body.orderGroupId;
    const reason: string = body.reason ?? "seller_refund";

    const sql = postgres(dbUrl, { max: 1 });
    try {
      await sql`ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_at timestamptz`;
      await sql`ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_reason text`;

      let updated: Array<{ id: string }> = [];
      if (orderGroupId) {
        updated = await sql`
          UPDATE public.orders
          SET refunded_at = now(), refund_reason = ${reason}, updated_at = now()
          WHERE order_group_id = ${orderGroupId} AND refunded_at IS NULL
          RETURNING id
        `;
      } else if (orderId) {
        updated = await sql`
          UPDATE public.orders
          SET refunded_at = now(), refund_reason = ${reason}, updated_at = now()
          WHERE id = ${orderId} AND refunded_at IS NULL
          RETURNING id
        `;
      }

      // Notify PostgREST to reload the schema so the new columns are visible.
      try { await sql`NOTIFY pgrst, 'reload schema'`; } catch (_) {}

      let currentRow: any[] = [];
      if (orderId) {
        currentRow = await sql`SELECT id, status, refunded_at, refund_reason, order_group_id FROM public.orders WHERE id = ${orderId}`;
      } else if (orderGroupId) {
        currentRow = await sql`SELECT id, status, refunded_at, refund_reason, order_group_id FROM public.orders WHERE order_group_id = ${orderGroupId}`;
      }

      return new Response(JSON.stringify({ success: true, updated_ids: updated.map((r) => r.id), current: currentRow }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      await sql.end();
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
