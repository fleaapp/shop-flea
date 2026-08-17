import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logEdgeError } from "../_shared/logError.ts";
import { getVerifiedUserId } from "../_shared/auth.ts";
import { rejectUntrustedOrigin } from "../_shared/cors.ts";
import { checkRateLimit, callerKey, tooManyRequests } from "../_shared/rateLimit.ts";
import { sendTransactionalEmail, getUserEmail, wantsOrderEmails } from "../_shared/sendTransactionalEmail.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

function getStripeSecretKey() {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Stripe key not configured");
  return key;
}

Deno.serve(async (req) => {
  console.log(`[stripe-connect-payout] ${req.method} request received`);
  if (req.method === "OPTIONS") {
    console.log("[stripe-connect-payout] OPTIONS preflight allowed");
    return new Response("ok", { headers: corsHeaders });
  }
  const originBlock = rejectUntrustedOrigin(req);
  if (originBlock) return originBlock;
  if (req.method !== "POST") {
    console.warn(`[stripe-connect-payout] Unsupported method: ${req.method}`);
    return json({ error: "Method not allowed" }, 405);
  }
  console.log("[stripe-connect-payout] POST entered handler");
  try {
    // Verified authentication — never trust an unsigned JWT payload for
    // authorization on a money-moving endpoint.
    const userId = await getVerifiedUserId(req);
    if (!userId) return json({ error: "Not authenticated" }, 401);

    // Rate limit: at most 5 payout attempts per user per 10 minutes.
    if (!(await checkRateLimit(callerKey(req, "payout", userId), 5, 600))) {
      return tooManyRequests(corsHeaders, "Too many payout attempts. Please wait a few minutes.");
    }



    const body = await req.json().catch(() => ({} as any));
    const method = body?.method;
    console.log(`[stripe-connect-payout] payout method=${method === "instant" ? "instant" : method === "standard" ? "standard" : "invalid"}`);
    if (method !== "standard" && method !== "instant") {
      return json({ error: "Invalid payout method" }, 400);
    }

    // Idempotency: derived from a client-supplied request id so a retry of the
    // SAME request reuses the key, while a genuinely new payout always gets a
    // fresh one. A rolling time window was previously used, which could either
    // merge two intentional payouts or split one retry across the boundary.
    const requestId = typeof body?.requestId === "string" && body.requestId.length <= 64
      ? body.requestId.replace(/[^a-zA-Z0-9_-]/g, "")
      : crypto.randomUUID();
    const idemBase = `payout:${userId}:${method}:${requestId}`;


    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "stripe_account_id, stripe_onboarding_complete, bank_status, bank_last_changed_at, payout_review_flag, payout_review_reason, payout_failure_reason, payout_failure_count",
      )
      .eq("user_id", userId)
      .maybeSingle();

    const accountId = (profile as any)?.stripe_account_id;
    if (!accountId || !(profile as any)?.stripe_onboarding_complete) {
      return json({ error: "Seller account not ready." }, 400);
    }

    // ── Bank health + churn guards ──────────────────────────────────────────
    if ((profile as any)?.bank_status === "errored") {
      return json({
        error:
          (profile as any)?.payout_failure_reason
            ? "We couldn't send your last payout. Please re-enter your bank details before trying again."
            : "Your bank details were rejected. Please re-enter them before trying again.",
        reason: "bank_errored",
      }, 409);
    }

    if ((profile as any)?.payout_review_flag) {
      return json({
        error:
          "Your payouts are paused while we run a quick check on your account. We'll let you know as soon as it's cleared.",
        reason: "payout_review",
      }, 409);
    }

    const bankChangedAt = (profile as any)?.bank_last_changed_at
      ? new Date((profile as any).bank_last_changed_at).getTime()
      : 0;
    const coolingMs = 24 * 60 * 60 * 1000;
    if (bankChangedAt && Date.now() - bankChangedAt < coolingMs) {
      const hoursLeft = Math.max(
        1,
        Math.ceil((coolingMs - (Date.now() - bankChangedAt)) / (60 * 60 * 1000)),
      );
      return json({
        error: `You recently changed your bank details, so this payout is held for another ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}. This keeps your money safe.`,
        reason: "bank_cooling_off",
      }, 409);
    }

    const stripe = new Stripe(getStripeSecretKey(), { apiVersion: "2025-08-27.basil" });

    const [balance, account] = await Promise.all([
      stripe.balance.retrieve({ stripeAccount: accountId }),
      stripe.accounts.retrieve(accountId),
    ]);

    if (!account.charges_enabled || !account.payouts_enabled) {
      return json({ error: "Your account isn't fully verified yet." }, 400);
    }

    // Live bank-account validation state from Stripe.
    const extAccounts = ((account as any).external_accounts?.data ?? []) as Array<any>;
    const defaultBank = extAccounts.find((a) => a?.default_for_currency) || extAccounts[0] || null;
    if (defaultBank?.status === "errored") {
      await supabase.from("profiles").update({ bank_status: "errored" }).eq("user_id", userId);
      return json({
        error: "Your bank details were rejected. Please re-enter them before trying again.",
        reason: "bank_errored",
      }, 409);
    }
    // NOTE: Stripe leaves AU bank accounts permanently marked `new` - that is
    // not a review state and it never flips to `validated`, so it must never
    // block a payout. Only genuine rejections stop us here.
    if (defaultBank?.status === "verification_failed") {
      await supabase.from("profiles").update({ bank_status: "errored" }).eq("user_id", userId);
      return json({
        error: "Your bank details couldn't be verified. Please re-enter them before trying again.",
        reason: "bank_errored",
      }, 409);
    }


    // Identity anchor: once a payout has failed, the seller can keep selling
    // but cannot withdraw until their ID document has been accepted.
    const idStatus = (account as any).individual?.verification?.status ?? null;
    const failureCount = Number((profile as any)?.payout_failure_count ?? 0);
    if (failureCount > 0 && idStatus !== "verified") {
      return json({
        error:
          "Before we can send this payout, we need to confirm it's you. Please add a photo of your ID in your seller settings.",
        reason: "id_required",
      }, 409);
    }




    const currency = (balance.available?.[0]?.currency ||
      balance.pending?.[0]?.currency ||
      "aud").toLowerCase();

    const sum = (arr: any[] | undefined) =>
      (arr || []).filter((b) => b.currency === currency).reduce((s, b) => s + (b.amount || 0), 0);

    // ── Held-funds guard ────────────────────────────────────────────────────
    // Sellers cannot withdraw funds that correspond to orders whose money is
    // not yet released. This protects buyers and keeps the seller's balance
    // from going negative if tracking is rejected, a refund is granted, or
    // the buyer disputes within the 48h post-delivery window.
    //
    // Held = any order that is NOT completed/refunded AND belongs to this seller.
    // Specifically:
    //   • status IN ('awaiting','shipped')         → not yet delivered
    //   • status = 'delivered' AND still in dispute window (funds unreleased)
    //   • any status with a pending refund request (not yet declined or refunded)
    const nowIso = new Date().toISOString();
    const { data: heldRows } = await supabase
      .from("orders")
      .select("price, shipping_price, status, dispute_window_ends_at, refund_requested_at, refund_declined_at, refunded_at, completed_at")
      .eq("seller_id", userId)
      .is("refunded_at", null)
      .is("completed_at", null);

    const isHeld = (o: any): boolean => {
      if (o.refunded_at || o.completed_at) return false;
      // Pending refund request awaiting seller response → hold
      if (o.refund_requested_at && !o.refund_declined_at) return true;
      if (o.status === "awaiting" || o.status === "shipped") return true;
      if (o.status === "delivered") {
        if (!o.dispute_window_ends_at) return true;
        return o.dispute_window_ends_at > nowIso;
      }
      return false;
    };

    const heldCents = (heldRows || []).filter(isHeld).reduce((s: number, o: any) => {
      const total = (Number(o.price) || 0) + (Number(o.shipping_price) || 0);
      return s + Math.round(total * 100);
    }, 0);
    const unshippedCents = heldCents; // preserve variable name used below



    if (method === "instant") {
      const instantAvailableRaw = sum((balance as any).instant_available);
      const instantAvailable = Math.max(instantAvailableRaw - unshippedCents, 0);
      if (instantAvailableRaw <= 0) {
        return json({ error: "No funds are available for instant payout right now." }, 400);
      }
      if (instantAvailable <= 0) {
        return json({
          error: `You have $${(unshippedCents / 100).toFixed(2)} in sales still in buyer protection (awaiting shipment, delivery, or the 48h release window). Those funds unlock once the orders complete.`,
          reason: "funds_held",
          unshippedCents,
        }, 409);
      }
      // 1.5% Flea instant-payout fee, transferred from the connected account
      // to the platform account BEFORE the payout leaves. If we cannot collect
      // the fee we must not deduct it from the seller, so the payout aborts.
      const feeAmount = Math.round(instantAvailable * 0.015);
      const netAmount = Math.max(instantAvailable - feeAmount, 1);
      const platformAccountId = Deno.env.get("STRIPE_PLATFORM_ACCOUNT_ID");

      if (feeAmount > 0) {
        if (!platformAccountId || platformAccountId === "self") {
          await logEdgeError({
            functionName: "stripe-connect-payout",
            error: new Error("STRIPE_PLATFORM_ACCOUNT_ID is not configured — instant payout fee cannot be collected"),
            severity: "error",
            source: "payment",
            context: { userId, accountId, feeAmount },
          });
          return json({
            error: "Instant payout is temporarily unavailable. Please use a standard payout.",
            reason: "instant_fee_unavailable",
          }, 503);
        }

        try {
          const feeTransfer = await stripe.transfers.create(
            {
              amount: feeAmount,
              currency,
              destination: platformAccountId,
              description: "Flea instant payout fee (1.5%)",
            },
            {
              stripeAccount: accountId,
              idempotencyKey: `${idemBase}:fee:${feeAmount}`,
            },
          );
          await recordPaymentEvent(supabase, {
            event_id: feeTransfer.id,
            event_type: "instant_payout_fee_collected",
            seller_id: userId,
            amount: feeAmount / 100,
            payload: { transfer_id: feeTransfer.id, currency, account: accountId },
          });
        } catch (feeErr) {
          await logEdgeError({
            functionName: "stripe-connect-payout",
            error: feeErr,
            severity: "error",
            source: "payment",
            context: { step: "instant_fee_transfer", userId, accountId, feeAmount },
          });
          return json({
            error: "We couldn't process the instant payout fee. Please try a standard payout.",
            reason: "instant_fee_failed",
          }, 502);
        }
      }

      const payout = await stripe.payouts.create(
        {
          amount: netAmount,
          currency,
          method: "instant",
          description: "Flea instant payout",
        },
        { stripeAccount: accountId, idempotencyKey: `${idemBase}:instant:${netAmount}` },
      );

      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const email = await getUserEmail(supabaseUrl, serviceKey, userId);
        if (email && (await wantsOrderEmails(supabaseUrl, serviceKey, userId))) {
          await sendTransactionalEmail({
            supabaseUrl,
            serviceKey,
            templateName: "seller-payout-available",
            recipientEmail: email,
            idempotencyKey: `seller-payout-available-${payout.id}`,
            templateData: {
              amount: `$${(payout.amount / 100).toFixed(2)}`,
              dashboardUrl: "https://app.finditonflea.com/seller-dashboard",
            },
          });
        }
      } catch (e) {
        console.error("[stripe-connect-payout] payout email error:", e);
      }

      return json({ ok: true, payout: { id: payout.id, amount: payout.amount, method: "instant" } });
    }


    // Standard payout — cap at available minus unshipped.
    const availableRaw = sum(balance.available);
    const available = Math.max(availableRaw - unshippedCents, 0);
    if (availableRaw <= 0) return json({ error: "No available balance to pay out." }, 400);
    if (available <= 0) {
      return json({
        error: `You have $${(unshippedCents / 100).toFixed(2)} in sales still in buyer protection (awaiting shipment, delivery, or the 48h release window). Those funds unlock once the orders complete.`,
        reason: "funds_held",
        unshippedCents,
      }, 409);
    }

    const payout = await stripe.payouts.create(
      { amount: available, currency, method: "standard", description: "Flea payout" },
      { stripeAccount: accountId, idempotencyKey: `${idemBase}:standard:${available}` },
    );

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const email = await getUserEmail(supabaseUrl, serviceKey, userId);
      if (email && (await wantsOrderEmails(supabaseUrl, serviceKey, userId))) {
        await sendTransactionalEmail({
          supabaseUrl,
          serviceKey,
          templateName: "seller-payout-available",
          recipientEmail: email,
          idempotencyKey: `seller-payout-available-${payout.id}`,
          templateData: {
            amount: `$${(payout.amount / 100).toFixed(2)}`,
            dashboardUrl: "https://app.finditonflea.com/seller-dashboard",
          },
        });
      }
    } catch (e) {
      console.error("[stripe-connect-payout] payout email error:", e);
    }

    return json({ ok: true, payout: { id: payout.id, amount: payout.amount, method: "standard" } });
  } catch (e: any) {
    await logEdgeError({
      functionName: "stripe-connect-payout",
      error: e,
      severity: "error",
      source: "payment",
      context: {
        stripe_type: e?.type ?? null,
        stripe_code: e?.code ?? null,
        stripe_status: e?.statusCode ?? null,
      },
    });
    return json({ error: e?.message || "Payout failed." }, 400);
  }
});

async function recordPaymentEvent(
  supabase: any,
  row: {
    event_id: string;
    event_type: string;
    seller_id?: string;
    amount?: number;
    payload?: Record<string, unknown>;
  },
) {
  try {
    await supabase.from("payment_events").insert({
      provider: "stripe",
      event_id: row.event_id,
      event_type: row.event_type,
      seller_id: row.seller_id ?? null,
      amount: row.amount ?? null,
      payload: row.payload ?? {},
    });
  } catch (_) {
    // Ledger write is best-effort; never block a payout on it.
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
