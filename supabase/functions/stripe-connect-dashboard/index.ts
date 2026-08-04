import { rejectUntrustedOrigin } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getStripeSecretKey() {
  const k = (Deno.env.get("STRIPE_SECRET_KEY") ?? "").trim();
  if (!k) throw new Error("Stripe secret key missing");
  return k;
}

function isAppleReviewProfile(p: any) {
  const u = String(p?.username ?? "").toLowerCase();
  const e = String(p?.email ?? "").toLowerCase();
  return u === "@applereview" || e === "appreview@finditonflea.com";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const originBlock = rejectUntrustedOrigin(req);
  if (originBlock) return originBlock;

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const EXTERNAL_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const verifier = createClient(EXTERNAL_URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authErr } = await verifier.auth.getUser(token);
    if (authErr || !authData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const userId = authData.user.id;

    const svc = createClient(EXTERNAL_URL, SERVICE);
    const { data: profile } = await svc
      .from("profiles")
      .select("stripe_account_id, username, email, stripe_onboarding_complete")
      .eq("user_id", userId)
      .single();

    const accountId = profile?.stripe_account_id ?? null;

    if (!accountId) {
      return new Response(
        JSON.stringify({ connected: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Demo / Apple review bypass — return dummy but well-formed data
    if (accountId.startsWith("acct_demo_") && isAppleReviewProfile(profile)) {
      return new Response(
        JSON.stringify({
          connected: true,
          demo: true,
          currency: "aud",
          available: 0,
          pending: 0,
          instantAvailable: 0,
          payouts: [],
          nextPayout: null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });

    const [balance, payouts, account, charges, balanceTx] = await Promise.all([
      stripe.balance.retrieve({ stripeAccount: accountId }),
      stripe.payouts.list({ limit: 10 }, { stripeAccount: accountId }),
      stripe.accounts.retrieve(accountId),
      stripe.charges.list({ limit: 1 }, { stripeAccount: accountId }).catch(() => ({ data: [] as any[] })),
      stripe.balanceTransactions
        .list({ limit: 30 }, { stripeAccount: accountId })
        .catch(() => ({ data: [] as any[] })),
    ]);

    const currency = (balance.available?.[0]?.currency || balance.pending?.[0]?.currency || "aud").toLowerCase();
    const sum = (arr: any[] | undefined, cur: string) =>
      (arr || []).filter((b) => b.currency === cur).reduce((s, b) => s + (b.amount || 0), 0);

    const available = sum(balance.available, currency);
    const pending = sum(balance.pending, currency);
    const instantAvailable = sum((balance as any).instant_available, currency);
    const total = available + pending;
    const negativeBalanceCents = total < 0 ? Math.abs(total) : 0;

    // Compute held funds — orders whose money is not yet released to the seller.
    // Held = awaiting/shipped, delivered within dispute window, or a pending
    // refund request. Matches the guard in stripe-connect-payout.
    // Amounts are NET of the seller Transaction Fee so Pending speaks the same
    // language as the (already net) Stripe available balance.
    let unshippedCents = 0;
    const heldBreakdown: Array<{
      orderId: string;
      orderGroupId: string | null;
      title: string | null;
      grossCents: number;
      feeCents: number;
      netCents: number;
      state: string;
    }> = [];
    try {
      const svc = createClient(EXTERNAL_URL, SERVICE);
      const now = Date.now();
      const nowIso = new Date().toISOString();
      const { data: heldRows } = await svc
        .from("orders")
        .select("id, order_group_id, price, shipping_price, transaction_fee, status, delivered_at, dispute_window_ends_at, refund_requested_at, refund_declined_at, refunded_at, completed_at, listing:listings(title)")
        .eq("seller_id", userId)
        .is("refunded_at", null)
        .is("completed_at", null);
      // A delivered order whose dispute window was never stamped must not hold
      // funds forever — fall back to 48h after delivery.
      const windowEnd = (o: any): string | null => {
        if (o.dispute_window_ends_at) return o.dispute_window_ends_at;
        if (o.delivered_at) return new Date(new Date(o.delivered_at).getTime() + 48 * 3600 * 1000).toISOString();
        return null;
      };
      const heldState = (o: any): string | null => {
        if (o.refunded_at || o.completed_at) return null;
        if (o.refund_requested_at && !o.refund_declined_at) return "refund_requested";
        if (o.status === "awaiting") return "awaiting";
        if (o.status === "shipped") return "shipped";
        if (o.status === "delivered") {
          const end = windowEnd(o);
          if (!end) return "delivered";
          return new Date(end).getTime() > now ? "delivered" : null;
        }
        return null;
      };
      for (const o of heldRows || []) {
        const state = heldState(o);
        if (!state) continue;
        const gross = Math.round(((Number(o.price) || 0) + (Number(o.shipping_price) || 0)) * 100);
        const fee = Math.round((Number(o.transaction_fee) || 0) * 100);
        const net = Math.max(gross - fee, 0);
        unshippedCents += net;
        heldBreakdown.push({
          orderId: o.id,
          orderGroupId: o.order_group_id ?? null,
          title: (o as any).listing?.title ?? null,
          grossCents: gross,
          feeCents: fee,
          netCents: net,
          state,
        });
      }
      void nowIso;
    } catch (e) {
      console.warn("[stripe-connect-dashboard] held calc failed", e);
    }


    const availableToWithdraw = Math.max(available - unshippedCents, 0);
    const instantAvailableToWithdraw = Math.max(instantAvailable - unshippedCents, 0);


    // Mirror to profile so hot paths can gate on it without another Stripe call.
    try {
      await fetch(`${EXTERNAL_URL}/rest/v1/profiles?user_id=eq.${userId}`, {
        method: "PATCH",
        headers: {
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          negative_balance_cents: negativeBalanceCents,
          negative_balance_updated_at: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.warn("[stripe-connect-dashboard] mirror failed", e);
    }

    const nextPayout = payouts.data.find((p) => p.status === "pending" || p.status === "in_transit") ?? null;

    const chargesEnabled = !!account.charges_enabled;
    const payoutsEnabled = !!account.payouts_enabled;
    const hasSucceededCharge = (charges as any).data?.some?.((c: any) => c.status === "succeeded") ?? false;
    const capabilities: any = account.capabilities || {};
    const instantPayoutEligible = capabilities.instant_payouts === "active";
    // Has any payout ever actually landed? Drives the "first payout hold" copy
    // and must match between Settings and the Seller Dashboard.
    const hasPaidPayout = (payouts.data || []).some((p: any) => p.status === "paid");
    // Does the seller have a bank account attached? `null` means we could not
    // determine it - the UI must stay silent in that case rather than telling a
    // correctly set up seller to add bank details.
    let hasExternalAccount: boolean | null =
      ((account as any).external_accounts?.total_count ?? 0) > 0 ? true : null;
    if (hasExternalAccount !== true) {
      try {
        const ext = await stripe.accounts.listExternalAccounts(accountId, { limit: 1 });
        hasExternalAccount = (ext.data || []).length > 0;
      } catch (e) {
        console.warn("[stripe-connect-dashboard] external account check failed", e);
        hasExternalAccount = null;
      }
    }
    // Explicit signal from Stripe that a bank account is missing or rejected.
    const reqs: any = (account as any).requirements || {};
    const externalAccountDue = [
      ...(reqs.currently_due || []),
      ...(reqs.past_due || []),
      ...(reqs.errors || []).map((e: any) => e?.requirement).filter(Boolean),
    ].some((r: string) => typeof r === "string" && r.startsWith("external_account"));


    return new Response(
      JSON.stringify({
        connected: true,
        currency,
        available,
        pending,
        instantAvailable,
        unshippedCents,
        heldBreakdown,
        availableToWithdraw,
        instantAvailableToWithdraw,
        negativeBalanceCents,
        isNegative: negativeBalanceCents > 0,
        chargesEnabled,
        payoutsEnabled,
        hasSucceededCharge,
        instantPayoutEligible,
        hasPaidPayout,
        hasExternalAccount,
        externalAccountDue,
        nextPayout: nextPayout
          ? {
              amount: nextPayout.amount,
              arrivalDate: nextPayout.arrival_date,
              status: nextPayout.status,
            }
          : null,
        payouts: payouts.data.map((p) => ({
          id: p.id,
          amount: p.amount,
          status: p.status,
          arrivalDate: p.arrival_date,
          created: p.created,
          method: p.method,
        })),
        activity: ((balanceTx as any).data || [])
          .filter((t: any) => t.type !== 'payout')
          .slice(0, 25)
          .map((t: any) => ({
            id: t.id,
            type: t.type, // charge, refund, adjustment, stripe_fee, application_fee, application_fee_refund, transfer, payment_refund, etc.
            amount: t.amount, // signed, in cents (negative = out)
            net: t.net,
            fee: t.fee,
            status: t.status, // available | pending
            created: t.created,
            available_on: t.available_on,
            description: t.description,
          })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    console.error("[stripe-connect-dashboard]", e);
    return new Response(JSON.stringify({ error: e.message || "Error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
