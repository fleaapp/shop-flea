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
  | "listTransactions"
  | "listUsers"
  | "getUserDetail"
  | "userAction"
  | "listListings"
  | "listingAction";

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
  return status === 404 || /PGRST20[245]|42703|relation .* does not exist|column .* does not exist|Could not find the table|Could not find .* column|schema cache/i.test(text);
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

const ORDER_ADMIN_SELECT = "id,listing_id,buyer_id,seller_id,order_group_id,price,shipping_price,status,tracking_number,tracking_provider,shipped_at,delivered_at,created_at,updated_at,order_number,payment_method,checkout_reference,shipping_city,shipping_state,shipping_postcode";

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

async function listTransactions() {
  const orders = await safeSelect("orders", { select: ORDER_ADMIN_SELECT, order: "created_at.desc", limit: 1000 });
  if (orders.length === 0) return { orders: [] };

  const buyerIds = unique(orders.map((o: any) => o.buyer_id));
  const sellerIds = unique(orders.map((o: any) => o.seller_id));
  const userIds = unique([...buyerIds, ...sellerIds]);
  const listingIds = unique(orders.map((o: any) => o.listing_id));
  const groupIds = unique(orders.map((o: any) => o.order_group_id).filter(Boolean));

  const [profiles, listings, messages] = await Promise.all([
    userIds.length
      ? safeSelect("profiles", { user_id: `in.(${userIds.join(",")})` })
      : Promise.resolve([] as any[]),
    listingIds.length
      ? safeSelect("listings", { id: `in.(${listingIds.join(",")})` })
      : Promise.resolve([] as any[]),
    groupIds.length
      ? safeSelect("order_messages", { order_group_id: `in.(${groupIds.join(",")})`, select: "order_group_id" })
      : Promise.resolve([] as any[]),
  ]);

  const profileMap = new Map(
    profiles.map((p: any) => [p.user_id, { username: p.username ?? "Unknown", avatar_url: p.avatar_url ?? null }])
  );
  const listingMap = new Map(
    listings.map((l: any) => [l.id, {
      title: l.title,
      images: Array.isArray(l.images) ? l.images : [],
      brand: l.brand,
      category: l.category,
    }])
  );
  const msgCounts = new Map<string, number>();
  for (const m of messages as any[]) {
    if (!m.order_group_id) continue;
    msgCounts.set(m.order_group_id, (msgCounts.get(m.order_group_id) ?? 0) + 1);
  }

  const enriched = orders.map((o: any) => ({
    ...o,
    listing: listingMap.get(o.listing_id) ?? null,
    buyer_profile: profileMap.get(o.buyer_id) ?? { username: "Unknown", avatar_url: null },
    seller_profile: profileMap.get(o.seller_id) ?? { username: "Unknown", avatar_url: null },
    message_count: o.order_group_id ? (msgCounts.get(o.order_group_id) ?? 0) : 0,
  }));

  return { orders: enriched };
}

// ----------------- Users -----------------

async function listUsers(payload: any = {}) {
  const search = (payload.search ?? "").trim().toLowerCase();
  const status = payload.status ?? "all"; // all | active | blocked | suspended
  const sort = payload.sort ?? "created_at"; // created_at | last_sign_in_at | username
  const dir = payload.dir === "asc" ? "asc" : "desc";

  const params: Record<string, string> = { order: `${sort}.${dir}.nullslast`, limit: "500" };
  if (status !== "all") params.status = `eq.${status}`;
  let users = await safeSelect("profiles", params);

  if (search) {
    users = users.filter((u: any) =>
      (u.username ?? "").toLowerCase().includes(search) ||
      (u.email ?? "").toLowerCase().includes(search) ||
      (u.first_name ?? "").toLowerCase().includes(search) ||
      (u.last_name ?? "").toLowerCase().includes(search)
    );
  }

  const userIds = users.map((u: any) => u.user_id);
  if (userIds.length === 0) return { users: [] };

  const inList = `in.(${userIds.join(",")})`;
  const [listings, ordersAsBuyer, ordersAsSeller, reportsAgainst] = await Promise.all([
    safeSelect("listings", { user_id: inList, select: "user_id,status" }),
    safeSelect("orders", { buyer_id: inList, select: "buyer_id,price,shipping_price,status" }),
    safeSelect("orders", { seller_id: inList, select: "seller_id,price,shipping_price,status" }),
    safeSelect("reports", { reported_user_id: inList, select: "reported_user_id" }),
  ]);

  const listingCounts = new Map<string, { total: number; active: number; sold: number }>();
  for (const l of listings as any[]) {
    const t = listingCounts.get(l.user_id) ?? { total: 0, active: 0, sold: 0 };
    t.total += 1;
    if (l.status === "active") t.active += 1;
    if (l.status === "sold") t.sold += 1;
    listingCounts.set(l.user_id, t);
  }
  const buyerStats = new Map<string, { count: number; volume: number; refunds: number }>();
  for (const o of ordersAsBuyer as any[]) {
    const t = buyerStats.get(o.buyer_id) ?? { count: 0, volume: 0, refunds: 0 };
    t.count += 1;
    t.volume += Number(o.price ?? 0) + Number(o.shipping_price ?? 0);
    if (o.status === "refunded") t.refunds += 1;
    buyerStats.set(o.buyer_id, t);
  }
  const sellerStats = new Map<string, { count: number; volume: number; refunds: number }>();
  for (const o of ordersAsSeller as any[]) {
    const t = sellerStats.get(o.seller_id) ?? { count: 0, volume: 0, refunds: 0 };
    t.count += 1;
    t.volume += Number(o.price ?? 0) + Number(o.shipping_price ?? 0);
    if (o.status === "refunded") t.refunds += 1;
    sellerStats.set(o.seller_id, t);
  }
  const reportCounts = new Map<string, number>();
  for (const r of reportsAgainst as any[]) {
    reportCounts.set(r.reported_user_id, (reportCounts.get(r.reported_user_id) ?? 0) + 1);
  }

  const enriched = users.map((u: any) => {
    const listing = listingCounts.get(u.user_id) ?? { total: 0, active: 0, sold: 0 };
    const buyer = buyerStats.get(u.user_id) ?? { count: 0, volume: 0, refunds: 0 };
    const seller = sellerStats.get(u.user_id) ?? { count: 0, volume: 0, refunds: 0 };
    const reports = reportCounts.get(u.user_id) ?? 0;
    const strikes = Number(u.report_strike_count ?? 0);
    // Simple risk score 0-100
    const risk = Math.min(100,
      strikes * 25 +
      reports * 8 +
      (buyer.refunds + seller.refunds) * 10 +
      (u.status === "blocked" ? 30 : 0) +
      (u.status === "suspended" ? 15 : 0)
    );
    return {
      user_id: u.user_id,
      username: u.username,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      avatar_url: u.avatar_url,
      status: u.status ?? "active",
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      country_code: u.country_code,
      region_id: u.region_id,
      rating: Number(u.rating ?? 0),
      total_reviews: Number(u.total_reviews ?? 0),
      report_strike_count: strikes,
      stripe_onboarding_complete: !!u.stripe_onboarding_complete,
      paypal_onboarding_complete: !!u.paypal_onboarding_complete,
      listings_total: listing.total,
      listings_active: listing.active,
      listings_sold: listing.sold,
      orders_as_buyer: buyer.count,
      orders_as_seller: seller.count,
      buyer_volume: buyer.volume,
      seller_volume: seller.volume,
      refunds_count: buyer.refunds + seller.refunds,
      reports_against: reports,
      risk_score: risk,
    };
  });

  return { users: enriched };
}

async function getUserDetail(userId: string) {
  const [profileArr, listings, ordersBuyer, ordersSeller, reportsAgainst, reportsBy, reviews, threads] = await Promise.all([
    safeSelect("profiles", { user_id: `eq.${userId}`, limit: 1 }),
    safeSelect("listings", { user_id: `eq.${userId}`, order: "created_at.desc", limit: 100 }),
    safeSelect("orders", { buyer_id: `eq.${userId}`, select: ORDER_ADMIN_SELECT, order: "created_at.desc", limit: 100 }),
    safeSelect("orders", { seller_id: `eq.${userId}`, select: ORDER_ADMIN_SELECT, order: "created_at.desc", limit: 100 }),
    safeSelect("reports", { reported_user_id: `eq.${userId}`, order: "created_at.desc", limit: 50 }),
    safeSelect("reports", { reporting_user_id: `eq.${userId}`, order: "created_at.desc", limit: 50 }),
    safeSelect("reviews", { reviewed_user_id: `eq.${userId}`, order: "created_at.desc", limit: 50 }),
    safeSelect("chat_threads", { user_id: `eq.${userId}`, order: "updated_at.desc", limit: 25 }),
  ]);

  return {
    profile: profileArr[0] ?? null,
    listings,
    ordersAsBuyer: ordersBuyer,
    ordersAsSeller: ordersSeller,
    reportsAgainst,
    reportsBy,
    reviews,
    threads,
  };
}

async function userAction(adminId: string, payload: any) {
  const { userId, type, reason } = payload ?? {};
  if (!userId || !type) throw new Error("userId and type required");

  switch (type) {
    case "suspend":
      await safePatch("profiles", { user_id: `eq.${userId}` }, { status: "suspended" });
      return { ok: true };
    case "activate":
    case "restore":
      await safePatch("profiles", { user_id: `eq.${userId}` }, { status: "active" });
      return { ok: true };
    case "ban":
      await banUser(adminId, userId, reason ?? "Banned by admin");
      return { ok: true };
    case "delete": {
      const url = `${EXTERNAL_URL}/auth/v1/admin/users/${userId}`;
      const res = await fetch(url, {
        method: "DELETE",
        headers: { apikey: EXTERNAL_SERVICE_ROLE_KEY, Authorization: `Bearer ${EXTERNAL_SERVICE_ROLE_KEY}` },
      });
      if (!res.ok && res.status !== 404) throw new Error(`Delete failed: ${await res.text()}`);
      return { ok: true };
    }
    case "reset_password": {
      // Get email
      const profile = await safeSelect("profiles", { user_id: `eq.${userId}`, select: "email", limit: 1 });
      const email = profile[0]?.email;
      if (!email) throw new Error("No email on file");
      const url = `${EXTERNAL_URL}/auth/v1/admin/generate_link`;
      const res = await fetch(url, {
        method: "POST",
        headers: { apikey: EXTERNAL_SERVICE_ROLE_KEY, Authorization: `Bearer ${EXTERNAL_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type: "recovery", email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.msg || "Reset failed");
      return { ok: true, action_link: json.action_link ?? json.properties?.action_link ?? null };
    }
    default:
      throw new Error(`Unknown user action: ${type}`);
  }
}

// ----------------- Listings -----------------

async function listListings(payload: any = {}) {
  const search = (payload.search ?? "").trim().toLowerCase();
  const status = payload.status ?? "all"; // all | active | sold | removed | hidden | archived
  const sort = payload.sort ?? "created_at";
  const dir = payload.dir === "asc" ? "asc" : "desc";
  const minReports = Number(payload.minReports ?? 0);

  const params: Record<string, string> = { order: `${sort}.${dir}.nullslast`, limit: "500" };
  if (status !== "all") params.status = `eq.${status}`;
  let listings = await safeSelect("listings", params);

  if (search) {
    listings = listings.filter((l: any) =>
      (l.title ?? "").toLowerCase().includes(search) ||
      (l.brand ?? "").toLowerCase().includes(search) ||
      (l.id ?? "").toLowerCase().includes(search)
    );
  }
  if (minReports > 0) {
    listings = listings.filter((l: any) => Number(l.report_count ?? 0) >= minReports);
  }

  const sellerIds = unique(listings.map((l: any) => l.user_id));
  const listingIds = listings.map((l: any) => l.id);

  const [profiles, favorites, comments, ordersForListings] = await Promise.all([
    sellerIds.length ? safeSelect("profiles", { user_id: `in.(${sellerIds.join(",")})` }) : Promise.resolve([] as any[]),
    listingIds.length ? safeSelect("favorites", { listing_id: `in.(${listingIds.join(",")})`, select: "listing_id" }) : Promise.resolve([] as any[]),
    listingIds.length ? safeSelect("listing_comments", { listing_id: `in.(${listingIds.join(",")})`, select: "listing_id" }) : Promise.resolve([] as any[]),
    listingIds.length ? safeSelect("orders", { listing_id: `in.(${listingIds.join(",")})`, select: "listing_id,status" }) : Promise.resolve([] as any[]),
  ]);

  const profileMap = new Map(profiles.map((p: any) => [p.user_id, { username: p.username, avatar_url: p.avatar_url, status: p.status, email: p.email }]));
  const favCounts = new Map<string, number>();
  for (const f of favorites as any[]) favCounts.set(f.listing_id, (favCounts.get(f.listing_id) ?? 0) + 1);
  const commentCounts = new Map<string, number>();
  for (const c of comments as any[]) commentCounts.set(c.listing_id, (commentCounts.get(c.listing_id) ?? 0) + 1);
  const orderCounts = new Map<string, number>();
  for (const o of ordersForListings as any[]) orderCounts.set(o.listing_id, (orderCounts.get(o.listing_id) ?? 0) + 1);

  // Duplicate detection: identical title+brand+seller
  const dupKey = (l: any) => `${l.user_id}|${(l.title ?? "").toLowerCase().trim()}|${(l.brand ?? "").toLowerCase().trim()}`;
  const dupCounts = new Map<string, number>();
  for (const l of listings as any[]) {
    const k = dupKey(l);
    dupCounts.set(k, (dupCounts.get(k) ?? 0) + 1);
  }

  const enriched = listings.map((l: any) => {
    const reports = Number(l.report_count ?? 0);
    const isDup = (dupCounts.get(dupKey(l)) ?? 0) > 1;
    // simple spam/fraud heuristic
    const titleLen = (l.title ?? "").length;
    const spamSignal = reports >= 2 || titleLen < 4 || /(http|www\.|@)/i.test(l.title ?? "") || isDup;
    return {
      ...l,
      seller_profile: profileMap.get(l.user_id) ?? { username: "Unknown", avatar_url: null },
      favorites_count: favCounts.get(l.id) ?? 0,
      comments_count: commentCounts.get(l.id) ?? 0,
      orders_count: orderCounts.get(l.id) ?? 0,
      is_duplicate: isDup,
      spam_signal: spamSignal,
    };
  });

  return { listings: enriched };
}

async function listingAction(payload: any) {
  const { listingId, type } = payload ?? {};
  if (!listingId || !type) throw new Error("listingId and type required");

  switch (type) {
    case "hide":
      await safePatch("listings", { id: `eq.${listingId}` }, { status: "hidden" });
      return { ok: true };
    case "feature":
      await safePatch("listings", { id: `eq.${listingId}` }, { status: "featured" });
      return { ok: true };
    case "approve":
    case "restore":
    case "activate":
      await safePatch("listings", { id: `eq.${listingId}` }, { status: "active" });
      return { ok: true };
    case "reject":
    case "remove":
    case "soft_delete":
      await safePatch("listings", { id: `eq.${listingId}` }, { status: "removed" });
      return { ok: true };
    case "archive":
      await safePatch("listings", { id: `eq.${listingId}` }, { status: "archived" });
      return { ok: true };
    case "delete":
      await rest(query("listings", { id: `eq.${listingId}` }), { method: "DELETE", prefer: "return=minimal" });
      return { ok: true };
    default:
      throw new Error(`Unknown listing action: ${type}`);
  }
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
      case "listTransactions":
        return response(await listTransactions());
      case "listUsers":
        return response(await listUsers(payload));
      case "getUserDetail":
        return response(await getUserDetail(payload.userId));
      case "userAction":
        return response(await userAction(auth.userId, payload));
      case "listListings":
        return response(await listListings(payload));
      case "listingAction":
        return response(await listingAction(payload));
      default:
        return response({ error: "Unknown admin action" }, 400);
    }
  } catch (error) {
    console.error("admin-data failed", error);
    return response({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
