import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTERNAL_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") ?? "https://dzglehiopfgfjmxtejve.supabase.co";
const EXTERNAL_ANON_KEY = Deno.env.get("EXTERNAL_SUPABASE_ANON_KEY") ?? "";
const EXTERNAL_SERVICE_ROLE_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? "";

type AdminAction =
  | "listThreads"
  | "getThreadMessages"
  | "sendSupportMessage"
  | "updateThreadStatus"
  | "listReports"
  | "updateReportStatus"
  | "listBannedUsers"
  | "banUser"
  | "updateBanStatus"
  | "listSuggestions"
  | "markSuggestionRead"
  | "listTransactions";

type RestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  prefer?: string;
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isMissingSchemaError(status: number, text: string) {
  return status === 404 || /PGRST20[245]|relation .* does not exist|Could not find the table|Could not find .* column|schema cache/i.test(text);
}

async function rest(path: string, options: RestOptions = {}) {
  const res = await fetch(`${EXTERNAL_URL}/rest/v1/${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: EXTERNAL_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${EXTERNAL_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer ?? "return=representation",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const error = new Error(text || res.statusText) as Error & { status?: number; body?: unknown; missingSchema?: boolean };
    error.status = res.status;
    error.body = json;
    error.missingSchema = isMissingSchemaError(res.status, text);
    throw error;
  }

  return json;
}

function query(table: string, params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.set(key, String(value));
  }
  return `${table}?${search.toString()}`;
}

async function safeSelect(table: string, params: Record<string, string | number | boolean | null | undefined> = {}) {
  try {
    const data = await rest(query(table, { select: "*", ...params }), { prefer: "return=minimal" });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    if ((error as any)?.missingSchema) return [];
    throw error;
  }
}

async function safePatch(table: string, filters: Record<string, string>, body: Record<string, unknown>) {
  if (Object.keys(body).length === 0) return [];

  try {
    return await rest(query(table, { ...filters, select: "*" }), { method: "PATCH", body });
  } catch (error) {
    if ((error as any)?.missingSchema) return [];
    throw error;
  }
}

async function safeInsert(table: string, body: Record<string, unknown>) {
  try {
    return await rest(query(table, { select: "*" }), { method: "POST", body });
  } catch (error) {
    if ((error as any)?.missingSchema) return [];
    throw error;
  }
}

async function getVerifiedUserId(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const verifier = createClient(EXTERNAL_URL, EXTERNAL_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await verifier.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub as string;
}

async function assertAdmin(req: Request) {
  const userId = await getVerifiedUserId(req);
  if (!userId) return { ok: false as const, response: response({ error: "Unauthorized" }, 401) };

  const roles = await safeSelect("user_roles", {
    user_id: `eq.${userId}`,
    role: "eq.admin",
    limit: 1,
  });

  if (roles.length === 0) return { ok: false as const, response: response({ error: "Forbidden" }, 403) };
  return { ok: true as const, userId };
}

function unique(values: Array<string | null | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])];
}

async function profilesByUserIds(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, { username: string; avatar_url: string | null; status?: string | null }>();

  const profiles = await safeSelect("profiles", {
    user_id: `in.(${userIds.join(",")})`,
  });

  return new Map(
    profiles.map((profile: any) => [
      profile.user_id,
      {
        username: profile.username ?? "Unknown",
        avatar_url: profile.avatar_url ?? null,
        status: profile.status ?? null,
      },
    ])
  );
}

async function listThreads(filter = "all") {
  const params: Record<string, string> = { order: "updated_at.desc" };
  if (filter !== "all") params.status = `eq.${filter}`;

  const threads = await safeSelect("chat_threads", params);
  const profileMap = await profilesByUserIds(unique(threads.map((thread: any) => thread.user_id)));

  const enriched = await Promise.all(
    threads.map(async (thread: any) => {
      const [lastMessage, unreadMessages] = await Promise.all([
        safeSelect("chat_messages", {
          thread_id: `eq.${thread.id}`,
          order: "created_at.desc",
          limit: 1,
        }),
        safeSelect("chat_messages", {
          thread_id: `eq.${thread.id}`,
          sender_type: "eq.user",
          read: "eq.false",
        }),
      ]);

      return {
        ...thread,
        status: thread.status ?? "active",
        last_message: lastMessage[0],
        unread_count: unreadMessages.length,
        user_profile: profileMap.get(thread.user_id) ?? { username: "Unknown User", avatar_url: null },
      };
    })
  );

  return { threads: enriched };
}

async function getThreadMessages(threadId: string) {
  const messages = await safeSelect("chat_messages", {
    thread_id: `eq.${threadId}`,
    order: "created_at.asc",
  });

  await safePatch(
    "chat_messages",
    { thread_id: `eq.${threadId}`, sender_type: "eq.user", read: "eq.false" },
    { read: true }
  );

  return { messages };
}

async function sendSupportMessage(userId: string, threadId: string, message: string, attachmentUrl?: string | null) {
  const trimmed = message.trim();
  if (!trimmed && !attachmentUrl) throw new Error("Message required");

  const inserted = await safeInsert("chat_messages", {
    thread_id: threadId,
    sender_id: userId,
    sender_type: "support",
    message: trimmed,
    attachment_url: attachmentUrl ?? null,
    read: false,
  });

  await safePatch("chat_threads", { id: `eq.${threadId}` }, { updated_at: new Date().toISOString() });
  return { message: Array.isArray(inserted) ? inserted[0] : inserted };
}

async function listReports(filter = "all") {
  let reports = await safeSelect("reports", { order: "created_at.desc" });
  reports = reports.map((report: any) => ({
    ...report,
    reported_item_id: report.reported_item_id ?? report.reported_entity_id,
    reporter_user_id: report.reporter_user_id ?? report.reporting_user_id,
    status: report.status ?? "pending",
    admin_notes: report.admin_notes ?? null,
    updated_at: report.updated_at ?? report.created_at,
  }));

  const filtered = filter === "all" ? reports : reports.filter((report: any) => report.status === filter);

  const profileMap = await profilesByUserIds(
    unique(reports.flatMap((report: any) => [report.reported_user_id, report.reporter_user_id]))
  );

  // Fetch reported entities (listings + comments) referenced by visible reports
  const listingIds = unique(filtered.filter((r: any) => r.report_type === "listing").map((r: any) => r.reported_item_id));
  const commentIds = unique(filtered.filter((r: any) => r.report_type === "comment").map((r: any) => r.reported_item_id));

  const [listings, comments] = await Promise.all([
    listingIds.length
      ? safeSelect("listings", { id: `in.(${listingIds.join(",")})` })
      : Promise.resolve([] as any[]),
    commentIds.length
      ? safeSelect("listing_comments", { id: `in.(${commentIds.join(",")})` })
      : Promise.resolve([] as any[]),
  ]);

  const listingMap = new Map<string, any>(listings.map((l: any) => [l.id, l]));
  const commentMap = new Map<string, any>(comments.map((c: any) => [c.id, c]));

  // Per-user report tally (across ALL reports, not just current filter)
  const tallyMap = new Map<string, { count: number; pending: number; accepted: number; rejected: number }>();
  for (const r of reports) {
    const uid = r.reported_user_id;
    if (!uid) continue;
    const t = tallyMap.get(uid) ?? { count: 0, pending: 0, accepted: 0, rejected: 0 };
    t.count += 1;
    if (r.status === "pending") t.pending += 1;
    else if (r.status === "accepted") t.accepted += 1;
    else if (r.status === "rejected") t.rejected += 1;
    tallyMap.set(uid, t);
  }

  const enrichedReports = filtered.map((report: any) => {
    let reported_entity: any = null;
    if (report.report_type === "listing") {
      const l = listingMap.get(report.reported_item_id);
      if (l) reported_entity = {
        kind: "listing",
        id: l.id,
        title: l.title,
        price: l.price,
        image: Array.isArray(l.images) ? l.images[0] ?? null : null,
        status: l.status,
      };
    } else if (report.report_type === "comment") {
      const c = commentMap.get(report.reported_item_id);
      if (c) reported_entity = {
        kind: "comment",
        id: c.id,
        content: c.content,
        listing_id: c.listing_id,
      };
    } else if (report.report_type === "user") {
      const p = profileMap.get(report.reported_user_id);
      reported_entity = { kind: "user", id: report.reported_user_id, username: p?.username ?? "Unknown" };
    }
    const tally = tallyMap.get(report.reported_user_id);
    return {
      ...report,
      reported_user_profile: profileMap.get(report.reported_user_id) ?? { username: "Unknown", avatar_url: null },
      reporter_user_profile: profileMap.get(report.reporter_user_id) ?? { username: "Unknown", avatar_url: null },
      reported_entity,
      reported_user_total_reports: tally?.count ?? 1,
    };
  });

  // Top reported users summary
  const topReportedUsers = [...tallyMap.entries()]
    .map(([user_id, t]) => ({
      user_id,
      ...t,
      profile: profileMap.get(user_id) ?? { username: "Unknown", avatar_url: null },
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);

  return { reports: enrichedReports, topReportedUsers };
}

async function updateReportStatus(id: string, status: string, adminNotes?: string) {
  const body: Record<string, unknown> = { status };
  if (adminNotes !== undefined) body.admin_notes = adminNotes;

  try {
    await safePatch("reports", { id: `eq.${id}` }, body);
  } catch (error) {
    if (!/status|admin_notes|schema cache/i.test(String((error as any)?.message ?? error))) throw error;
  }

  return { ok: true };
}

async function listBannedUsers(filter = "all") {
  let bans = await safeSelect("banned_users", { order: "banned_at.desc" });

  if (bans.length === 0) {
    const blockedProfiles = await safeSelect("profiles", { status: "eq.blocked", order: "updated_at.desc" });
    bans = blockedProfiles.map((profile: any) => ({
      id: profile.user_id,
      user_id: profile.user_id,
      reason: "Profile blocked",
      related_report_id: null,
      status: "active",
      banned_at: profile.updated_at ?? profile.created_at,
      lifted_at: null,
      banned_by: "system",
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    }));
  }

  bans = bans.map((ban: any) => ({ ...ban, status: ban.status ?? "active", banned_at: ban.banned_at ?? ban.created_at }));
  if (filter !== "all") bans = bans.filter((ban: any) => ban.status === filter);

  const profileMap = await profilesByUserIds(unique(bans.map((ban: any) => ban.user_id)));
  return {
    bannedUsers: bans.map((ban: any) => ({
      ...ban,
      user_profile: profileMap.get(ban.user_id) ?? { username: "Unknown", avatar_url: null },
      related_report: null,
    })),
  };
}

async function banUser(adminId: string, userId: string, reason: string, relatedReportId?: string | null) {
  await safeInsert("banned_users", {
    user_id: userId,
    reason,
    related_report_id: relatedReportId ?? null,
    banned_by: adminId,
    status: "active",
  });
  await safePatch("profiles", { user_id: `eq.${userId}` }, { status: "blocked" });
  return { ok: true };
}

async function updateBanStatus(banId: string, status: "active" | "lifted") {
  const existing = await safeSelect("banned_users", { id: `eq.${banId}`, limit: 1 });
  const userId = existing[0]?.user_id ?? banId;

  await safePatch("banned_users", { id: `eq.${banId}` }, {
    status,
    lifted_at: status === "lifted" ? new Date().toISOString() : null,
  });
  await safePatch("profiles", { user_id: `eq.${userId}` }, { status: status === "lifted" ? "active" : "blocked" });
  return { ok: true };
}

async function listSuggestions() {
  const suggestions = await safeSelect("suggestions", { order: "created_at.desc" });
  const profileMap = await profilesByUserIds(unique(suggestions.map((suggestion: any) => suggestion.user_id)));

  return {
    suggestions: suggestions.map((suggestion: any) => ({
      ...suggestion,
      read: Boolean(suggestion.read),
      profile: profileMap.get(suggestion.user_id) ?? { username: "Unknown", avatar_url: null },
    })),
  };
}

async function markSuggestionRead(id: string) {
  await safePatch("suggestions", { id: `eq.${id}` }, { read: true });
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!EXTERNAL_ANON_KEY || !EXTERNAL_SERVICE_ROLE_KEY) {
      return response({ error: "Admin backend is not configured" }, 500);
    }

    const auth = await assertAdmin(req);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const action = body?.action as AdminAction | undefined;
    const payload = body?.payload ?? {};

    switch (action) {
      case "listThreads":
        return response(await listThreads(payload.filter));
      case "getThreadMessages":
        return response(await getThreadMessages(payload.threadId));
      case "sendSupportMessage":
        return response(await sendSupportMessage(auth.userId, payload.threadId, payload.message ?? "", payload.attachmentUrl));
      case "updateThreadStatus":
        await safePatch("chat_threads", { id: `eq.${payload.threadId}` }, { status: payload.status, updated_at: new Date().toISOString() });
        return response({ ok: true });
      case "listReports":
        return response(await listReports(payload.filter));
      case "updateReportStatus":
        return response(await updateReportStatus(payload.id, payload.status, payload.adminNotes));
      case "listBannedUsers":
        return response(await listBannedUsers(payload.filter));
      case "banUser":
        return response(await banUser(auth.userId, payload.userId, payload.reason ?? "Admin action", payload.relatedReportId));
      case "updateBanStatus":
        return response(await updateBanStatus(payload.banId, payload.status));
      case "listSuggestions":
        return response(await listSuggestions());
      case "markSuggestionRead":
        return response(await markSuggestionRead(payload.id));
      default:
        return response({ error: "Unknown admin action" }, 400);
    }
  } catch (error) {
    console.error("admin-data failed", error);
    return response({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
