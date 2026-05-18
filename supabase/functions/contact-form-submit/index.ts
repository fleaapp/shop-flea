import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EMAIL_TO = ["hello@finditonflea.com", "shop.flea.au@gmail.com"];
const SENDER_DOMAIN = "notify.finditonflea.com";
const FROM_DOMAIN = "finditonflea.com";
const FROM_ADDRESS = "hello";
const SITE_NAME = "Flea";

function ok(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return ok({ error: "Method not allowed" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return ok({ error: "Invalid JSON" }, 400);
  }

  const name = String(body?.name ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const message = String(body?.message ?? "").trim();
  // Honeypot — silently accept and drop bots
  const honeypot = String(body?.website ?? "").trim();

  if (name.length < 1 || name.length > 100) return ok({ error: "Invalid name" }, 400);
  if (!EMAIL_RE.test(email) || email.length > 255) return ok({ error: "Invalid email" }, 400);
  if (message.length < 1 || message.length > 5000) return ok({ error: "Invalid message" }, 400);

  if (honeypot) return ok({ success: true });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  const userAgent = req.headers.get("user-agent") ?? null;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Rate limit: max 5 per IP per hour, plus 10 per email per hour
  try {
    const { data: ipOk } = await supabase.rpc("check_and_record_rate_limit", {
      _key: `contact_form:ip:${ip}`,
      _max: 5,
      _window_seconds: 3600,
    });
    if (ipOk === false) return ok({ error: "Too many submissions. Please try again later." }, 429);

    const { data: emailOk } = await supabase.rpc("check_and_record_rate_limit", {
      _key: `contact_form:email:${email}`,
      _max: 10,
      _window_seconds: 3600,
    });
    if (emailOk === false) return ok({ error: "Too many submissions. Please try again later." }, 429);
  } catch (e) {
    console.warn("rate limit check failed", e);
  }

  // Insert submission
  const { data: insertData, error: insertErr } = await supabase
    .from("contact_submissions")
    .insert({
      name,
      email,
      message,
      ip_address: ip,
      user_agent: userAgent,
    })
    .select("id")
    .single();

  if (insertErr) {
    console.error("contact insert failed", insertErr);
    return ok({ error: "Could not save submission" }, 500);
  }

  // Build email
  const subject = `New contact form submission from ${name}`;
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMsg = escapeHtml(message).replace(/\n/g, "<br />");

  const html = `<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#fff;color:#1a1a1a;padding:24px;">
<div style="max-width:560px;margin:0 auto;border:1px solid #eee;border-radius:12px;padding:24px;">
<h2 style="margin:0 0 16px;font-size:18px;">New contact form submission</h2>
<p style="margin:0 0 8px;"><strong>From:</strong> ${safeName} &lt;<a href="mailto:${safeEmail}" style="color:#1a1a1a;">${safeEmail}</a>&gt;</p>
<p style="margin:16px 0 8px;"><strong>Message:</strong></p>
<div style="background:#f6f6f3;padding:14px;border-radius:8px;white-space:pre-wrap;font-size:14px;line-height:1.5;">${safeMsg}</div>
<p style="margin:20px 0 0;font-size:12px;color:#888;">Reply directly to this email to respond to ${safeName}.</p>
</div></body></html>`;

  const text = `New contact form submission

From: ${name} <${email}>

Message:
${message}

Reply directly to this email to respond.`;

  // Enqueue one email per recipient via the existing email queue
  const submissionId = insertData?.id ?? crypto.randomUUID();
  let queued = 0;
  for (const to of EMAIL_TO) {
    const messageId = crypto.randomUUID();
    try {
      // Get or create a stable unsubscribe token for this recipient
      let unsubscribeToken: string | null = null;
      const { data: existingTok } = await supabase
        .from("email_unsubscribe_tokens")
        .select("token")
        .eq("email", to)
        .maybeSingle();
      if (existingTok?.token) {
        unsubscribeToken = existingTok.token as string;
      } else {
        const newToken = crypto.randomUUID();
        const { data: inserted } = await supabase
          .from("email_unsubscribe_tokens")
          .insert({ email: to, token: newToken })
          .select("token")
          .maybeSingle();
        unsubscribeToken = (inserted?.token as string | undefined) ?? newToken;
      }

      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: "contact_form",
        recipient_email: to,
        status: "pending",
      });

      const { error: enqErr } = await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: messageId,
          to,
          from: `${SITE_NAME} <${FROM_ADDRESS}@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text,
          purpose: "transactional",
          label: "contact_form",
          idempotency_key: `contact-${submissionId}-${to}`,
          reply_to: email,
          unsubscribe_token: unsubscribeToken,
          queued_at: new Date().toISOString(),
        },
      });

      if (enqErr) {
        console.error("enqueue failed", { to, enqErr });
        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: "contact_form",
          recipient_email: to,
          status: "failed",
          error_message: "enqueue failed",
        });
      } else {
        queued += 1;
      }
    } catch (e) {
      console.error("enqueue threw", { to, e });
    }
  }

  // Mark notified if at least one queued
  if (queued > 0) {
    await supabase
      .from("contact_submissions")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", submissionId);
  }

  return ok({ success: true, id: submissionId });
});
