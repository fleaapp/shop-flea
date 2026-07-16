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
  | "listingAction"
  | "listSystemIssues"
  | "runSystemFix"
  | "listWaitlist"
  | "listContactSubmissions"
  | "getBadges"
  | "listBrands"
  | "updateBrand"
  | "deleteBrand"
  | "listRefunds";

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

function missingColumnName(error: unknown) {
  const raw = String((error as any)?.message ?? error ?? "");
  return raw.match(/column\s+(?:\w+\.)?(\w+)\s+does not exist/i)?.[1] ?? null;
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
  let currentParams = { ...params };
  let currentSelect = typeof params.select === "string" ? params.select : "";
  // Retry up to 8 times, stripping one missing column per attempt
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const reqParams = currentSelect
        ? { ...currentParams, select: currentSelect }
        : { select: "*", ...currentParams };
      const data = await rest(query(table, reqParams), { prefer: "return=minimal" });
      return Array.isArray(data) ? data : [];
    } catch (error) {
      const missingColumn = missingColumnName(error);
      if ((error as any)?.missingSchema && missingColumn && currentSelect.includes(missingColumn)) {
        const fallbackSelect = currentSelect
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p && p !== missingColumn)
          .join(",");
        if (fallbackSelect) {
          currentSelect = fallbackSelect;
          continue;
        }
      }
      if ((error as any)?.missingSchema) return [];
      throw error;
    }
  }
  return [];
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

const ORDER_ADMIN_SELECT = "id,listing_id,buyer_id,seller_id,order_group_id,price,shipping_price,status,tracking_number,tracking_provider,shipped_at,delivered_at,created_at,updated_at,order_number,checkout_reference,shipping_city,shipping_state,shipping_postcode";

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

  const messageOrderIds = unique(orders.map((o: any) => o.id));
  const [profiles, listings, groupMessages, orderMessages] = await Promise.all([
    userIds.length
      ? safeSelect("profiles", { user_id: `in.(${userIds.join(",")})` })
      : Promise.resolve([] as any[]),
    listingIds.length
      ? safeSelect("listings", { id: `in.(${listingIds.join(",")})` })
      : Promise.resolve([] as any[]),
    groupIds.length
      ? safeSelect("order_messages", { order_group_id: `in.(${groupIds.join(",")})`, select: "order_group_id" })
      : Promise.resolve([] as any[]),
    messageOrderIds.length
      ? safeSelect("order_messages", { order_id: `in.(${messageOrderIds.join(",")})`, select: "order_id" })
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
  const groupMsgCounts = new Map<string, number>();
  for (const m of groupMessages as any[]) {
    if (!m.order_group_id) continue;
    groupMsgCounts.set(m.order_group_id, (groupMsgCounts.get(m.order_group_id) ?? 0) + 1);
  }
  const orderMsgCounts = new Map<string, number>();
  for (const m of orderMessages as any[]) {
    if (!m.order_id) continue;
    orderMsgCounts.set(m.order_id, (orderMsgCounts.get(m.order_id) ?? 0) + 1);
  }

  const enriched = orders.map((o: any) => ({
    ...o,
    payment_method: o.payment_method ?? "stripe",
    listing: listingMap.get(o.listing_id) ?? null,
    buyer_profile: profileMap.get(o.buyer_id) ?? { username: "Unknown", avatar_url: null },
    seller_profile: profileMap.get(o.seller_id) ?? { username: "Unknown", avatar_url: null },
    message_count: (o.order_group_id ? (groupMsgCounts.get(o.order_group_id) ?? 0) : 0) || (orderMsgCounts.get(o.id) ?? 0),
  }));

  return { orders: enriched };
}

// ----------------- Users -----------------

async function fetchLiveAuthUsers(): Promise<Map<string, { email: string | null; created_at: string | null }>> {
  const map = new Map<string, { email: string | null; created_at: string | null }>();
  const admin = createClient(EXTERNAL_URL, EXTERNAL_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let page = 1;
  const perPage = 1000;
  while (page <= 20) {
    const { data, error } = await (admin.auth.admin as any).listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const u of users) map.set(u.id, { email: u.email ?? null, created_at: u.created_at ?? null });
    if (users.length < perPage) break;
    page += 1;
  }
  return map;
}

async function fetchLiveAuthUserIds(): Promise<Set<string>> {
  const map = await fetchLiveAuthUsers();
  return new Set(map.keys());
}

async function deleteOrphanProfiles(orphanIds: string[]) {
  if (orphanIds.length === 0) return;
  // Chunk into groups of 100 for URL length safety.
  for (let i = 0; i < orphanIds.length; i += 100) {
    const chunk = orphanIds.slice(i, i + 100);
    try {
      await rest(`profiles?user_id=in.(${chunk.join(",")})`, { method: "DELETE", prefer: "return=minimal" });
    } catch (e) {
      console.warn("[admin-data] orphan profile cleanup failed:", (e as Error).message);
    }
  }
}

async function listUsers(payload: any = {}) {
  const search = (payload.search ?? "").trim().toLowerCase();
  const status = payload.status ?? "all"; // all | active | blocked | suspended
  const sort = payload.sort ?? "created_at"; // created_at | last_sign_in_at | username
  const dir = payload.dir === "asc" ? "asc" : "desc";

  const params: Record<string, string> = { order: `${sort}.${dir}.nullslast`, limit: "500" };
  if (status !== "all") params.status = `eq.${status}`;
  let users = await safeSelect("profiles", params);

  // Reconcile with auth.users so profiles orphaned by admin deletion disappear immediately.
  try {
    const liveIds = await fetchLiveAuthUserIds();
    const orphans = users.filter((u: any) => !liveIds.has(u.user_id)).map((u: any) => u.user_id);
    if (orphans.length > 0) {
      // Fire-and-forget cleanup; do not block the response.
      deleteOrphanProfiles(orphans);
    }
    users = users.filter((u: any) => liveIds.has(u.user_id));
  } catch (e) {
    console.warn("[admin-data] auth reconciliation failed, returning raw profiles:", (e as Error).message);
  }

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
    safeSelect("orders", { buyer_id: inList, select: "buyer_id,price,shipping_price,status,refunded_at" }),
    safeSelect("orders", { seller_id: inList, select: "seller_id,price,shipping_price,status,refunded_at" }),
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
    if (o.refunded_at) t.refunds += 1;
    buyerStats.set(o.buyer_id, t);
  }
  const sellerStats = new Map<string, { count: number; volume: number; refunds: number }>();
  for (const o of ordersAsSeller as any[]) {
    const t = sellerStats.get(o.seller_id) ?? { count: 0, volume: 0, refunds: 0 };
    t.count += 1;
    t.volume += Number(o.price ?? 0) + Number(o.shipping_price ?? 0);
    if (o.refunded_at) t.refunds += 1;
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

// ----------------- System Diagnostics / Error Dashboard -----------------

type Severity = "low" | "medium" | "high" | "critical";

interface SystemIssue {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  user_impact: string;
  suggested_fix: string;
  auto_fix_id: string | null;
  category: string;
  count: number;
  examples: any[];
  detected_at: string;
}

const DAY = 24 * 60 * 60 * 1000;
function daysAgo(n: number) {
  return new Date(Date.now() - n * DAY).toISOString();
}

async function listSystemIssues() {
  const now = new Date().toISOString();
  const issues: SystemIssue[] = [];

  // Pull data sets in parallel
  const [
    activeListings,
    soldListings,
    profiles,
    awaitingOrders,
    shippedOrders,
    refundedOrders,
    pendingReports,
    flaggedListings,
    duplicateScan,
  ] = await Promise.all([
    safeSelect("listings", { status: "eq.active", select: "id,user_id,title,brand,images,report_count,region_id,shipping_price,created_at" }),
    safeSelect("listings", { status: "eq.sold", select: "id,user_id,title,updated_at" }),
    safeSelect("profiles", { select: "user_id,username,status,report_strike_count,stripe_account_id,stripe_onboarding_complete,pause_selling" }),
    safeSelect("orders", { status: "eq.awaiting", select: "id,buyer_id,seller_id,listing_id,price,created_at,checkout_reference" }),
    safeSelect("orders", { status: "eq.shipped", select: "id,buyer_id,seller_id,listing_id,shipped_at,tracking_number,tracking_provider,delivered_at" }),
    safeSelect("orders", { refunded_at: "not.is.null", select: "id,refunded_at,updated_at,buyer_id,seller_id" }),
    safeSelect("reports", { status: "eq.pending", order: "created_at.asc", select: "id,created_at,report_type,reported_user_id,reported_entity_id" }),
    safeSelect("listings", { select: "id,user_id,title,status,report_count" }),
    safeSelect("listings", { select: "id,user_id,title,brand,status" }),
  ]);

  const profileMap = new Map<string, any>(profiles.map((p: any) => [p.user_id, p]));
  const orderListingIds = new Set<string>();
  const sellersWithOrders = new Set<string>();
  for (const o of [...awaitingOrders, ...shippedOrders] as any[]) {
    if (o.listing_id) orderListingIds.add(o.listing_id);
    if (o.seller_id) sellersWithOrders.add(o.seller_id);
  }

  // 1. Stuck awaiting orders > 4 days
  const stuckAwaiting = (awaitingOrders as any[]).filter(
    (o) => o.created_at && o.created_at < daysAgo(4)
  );
  if (stuckAwaiting.length) {
    issues.push({
      id: "stuck_awaiting_orders",
      title: "Orders stuck awaiting shipment",
      description: `${stuckAwaiting.length} order(s) have been awaiting shipment for more than 4 days. Sellers haven't marked them as shipped.`,
      severity: stuckAwaiting.length >= 5 ? "high" : "medium",
      user_impact: "Buyers are waiting for items they paid for. May trigger refund requests and damage trust.",
      suggested_fix: "Send urgent reminders to sellers, or process automatic refunds after 7 days.",
      auto_fix_id: null,
      category: "Orders",
      count: stuckAwaiting.length,
      examples: stuckAwaiting.slice(0, 5).map((o) => ({ id: o.id, created_at: o.created_at, seller_id: o.seller_id })),
      detected_at: now,
    });
  }

  // 2. Shipped > 14 days, never delivered
  const overdueShipped = (shippedOrders as any[]).filter(
    (o) => !o.delivered_at && o.shipped_at && o.shipped_at < daysAgo(14)
  );
  if (overdueShipped.length) {
    issues.push({
      id: "overdue_shipped_orders",
      title: "Shipped orders never marked delivered",
      description: `${overdueShipped.length} order(s) shipped over 14 days ago and have not been confirmed delivered.`,
      severity: "high",
      user_impact: "Buyers may not have received items. Sellers can't be paid out cleanly. Possible lost packages.",
      suggested_fix: "Contact buyer and seller, verify tracking, escalate to refund if undeliverable.",
      auto_fix_id: null,
      category: "Shipping",
      count: overdueShipped.length,
      examples: overdueShipped.slice(0, 5).map((o) => ({ id: o.id, shipped_at: o.shipped_at, tracking: o.tracking_number })),
      detected_at: now,
    });
  }

  // 3. Shipped without tracking
  const missingTracking = (shippedOrders as any[]).filter((o) => !o.tracking_number);
  if (missingTracking.length) {
    issues.push({
      id: "shipped_missing_tracking",
      title: "Shipped orders missing tracking",
      description: `${missingTracking.length} order(s) marked shipped but have no tracking number.`,
      severity: "medium",
      user_impact: "Buyers can't track their package. Reduces confidence in marketplace.",
      suggested_fix: "Require sellers to add tracking before marking shipped.",
      auto_fix_id: null,
      category: "Shipping",
      count: missingTracking.length,
      examples: missingTracking.slice(0, 5).map((o) => ({ id: o.id, seller_id: o.seller_id })),
      detected_at: now,
    });
  }

  // 4. Sellers with successful orders but no payout connection
  const sellersNoPayout: any[] = [];
  for (const sid of sellersWithOrders) {
    const p = profileMap.get(sid);
    if (!p) continue;
    const noStripe = !p.stripe_onboarding_complete || !p.stripe_account_id;
    if (noStripe) sellersNoPayout.push(p);
  }
  if (sellersNoPayout.length) {
    issues.push({
      id: "sellers_no_payout",
      title: "Sellers with sales but no payout method",
      description: `${sellersNoPayout.length} seller(s) have orders but no working Stripe connection.`,
      severity: "critical",
      user_impact: "Sellers cannot receive their money. Funds may be held by payment provider indefinitely.",
      suggested_fix: "Email affected sellers to complete payment onboarding via Settings.",
      auto_fix_id: null,
      category: "Payments",
      count: sellersNoPayout.length,
      examples: sellersNoPayout.slice(0, 5).map((p) => ({ user_id: p.user_id, username: p.username })),
      detected_at: now,
    });
  }

  // 5. Stale Stripe onboarding flag (complete=true but no account_id)
  const staleStripe = profiles.filter(
    (p: any) => p.stripe_onboarding_complete && !p.stripe_account_id
  );
  if (staleStripe.length) {
    issues.push({
      id: "stale_stripe_flag",
      title: "Inconsistent Stripe onboarding state",
      description: `${staleStripe.length} profile(s) marked Stripe-complete but have no Stripe account ID.`,
      severity: "medium",
      user_impact: "Sellers see 'Connected' incorrectly and won't reconnect, blocking payouts.",
      suggested_fix: "Auto-reset the onboarding flag so they can reconnect.",
      auto_fix_id: "fix_stale_stripe_flag",
      category: "Payments",
      count: staleStripe.length,
      examples: staleStripe.slice(0, 5).map((p: any) => ({ user_id: p.user_id, username: p.username })),
      detected_at: now,
    });
  }


  // 7. Listings reported >=3 still active
  const heavyReported = (flaggedListings as any[]).filter(
    (l) => l.status === "active" && Number(l.report_count ?? 0) >= 3
  );
  if (heavyReported.length) {
    issues.push({
      id: "heavily_reported_listings_active",
      title: "Heavily reported listings still live",
      description: `${heavyReported.length} listing(s) with 3+ reports are still active.`,
      severity: "high",
      user_impact: "Potentially harmful, fraudulent, or off-policy listings remain visible to buyers.",
      suggested_fix: "Remove these listings automatically pending review.",
      auto_fix_id: "fix_remove_heavily_reported",
      category: "Moderation",
      count: heavyReported.length,
      examples: heavyReported.slice(0, 5).map((l) => ({ id: l.id, title: l.title, reports: l.report_count })),
      detected_at: now,
    });
  }

  // 8. Users with 3+ strikes not blocked
  const overStrike = profiles.filter(
    (p: any) => Number(p.report_strike_count ?? 0) >= 3 && p.status !== "blocked"
  );
  if (overStrike.length) {
    issues.push({
      id: "overstrike_users_active",
      title: "Users past strike limit still active",
      description: `${overStrike.length} user(s) have 3+ strikes but are not blocked.`,
      severity: "high",
      user_impact: "Repeat offenders continue trading on the marketplace.",
      suggested_fix: "Auto-block these accounts pending appeal.",
      auto_fix_id: "fix_block_overstrike_users",
      category: "Trust & Safety",
      count: overStrike.length,
      examples: overStrike.slice(0, 5).map((p: any) => ({ user_id: p.user_id, username: p.username, strikes: p.report_strike_count })),
      detected_at: now,
    });
  }

  // 9. Active listings owned by blocked users
  const activeBlocked = (activeListings as any[]).filter((l) => {
    const p = profileMap.get(l.user_id);
    return p && p.status === "blocked";
  });
  if (activeBlocked.length) {
    issues.push({
      id: "active_listings_blocked_owners",
      title: "Active listings from blocked sellers",
      description: `${activeBlocked.length} active listing(s) belong to blocked accounts and should be archived.`,
      severity: "high",
      user_impact: "Buyers can purchase from blocked sellers, creating order failures and trust issues.",
      suggested_fix: "Archive these listings.",
      auto_fix_id: "fix_archive_blocked_listings",
      category: "Moderation",
      count: activeBlocked.length,
      examples: activeBlocked.slice(0, 5).map((l) => ({ id: l.id, title: l.title })),
      detected_at: now,
    });
  }

  // 10. Refunded orders missing refunded_at timestamp
  const refundsMissingTs = (refundedOrders as any[]).filter((o) => !o.refunded_at);
  if (refundsMissingTs.length) {
    issues.push({
      id: "refunds_missing_timestamp",
      title: "Refunded orders missing timestamp",
      description: `${refundsMissingTs.length} refunded order(s) have no refund timestamp recorded.`,
      severity: "low",
      user_impact: "Reporting and audit trail incomplete; buyers can't see when refund was processed.",
      suggested_fix: "Backfill timestamp from updated_at.",
      auto_fix_id: "fix_backfill_refund_timestamps",
      category: "Refunds",
      count: refundsMissingTs.length,
      examples: refundsMissingTs.slice(0, 5).map((o) => ({ id: o.id })),
      detected_at: now,
    });
  }

  // 11. Sold listings with no order rows (orphan)
  const orderListingsAll = await safeSelect("orders", { select: "listing_id" });
  const listingsWithOrders = new Set((orderListingsAll as any[]).map((o) => o.listing_id));
  const orphanSold = (soldListings as any[]).filter((l) => !listingsWithOrders.has(l.id));
  if (orphanSold.length) {
    issues.push({
      id: "orphan_sold_listings",
      title: "Sold listings with no order record",
      description: `${orphanSold.length} listing(s) marked sold but no order exists.`,
      severity: "medium",
      user_impact: "Inventory unavailable to other buyers despite no actual sale. Lost revenue.",
      suggested_fix: "Restore listing status to active.",
      auto_fix_id: "fix_restore_orphan_sold",
      category: "Listings",
      count: orphanSold.length,
      examples: orphanSold.slice(0, 5).map((l) => ({ id: l.id, title: l.title })),
      detected_at: now,
    });
  }

  // 12. Active listings with no images
  const noImages = (activeListings as any[]).filter(
    (l) => !Array.isArray(l.images) || l.images.length === 0
  );
  if (noImages.length) {
    issues.push({
      id: "active_listings_no_images",
      title: "Live listings with no images",
      description: `${noImages.length} active listing(s) have no images uploaded.`,
      severity: "medium",
      user_impact: "Buyers can't see the item, low conversion, looks broken.",
      suggested_fix: "Hide these listings until seller adds photos.",
      auto_fix_id: "fix_hide_imageless_listings",
      category: "Listings",
      count: noImages.length,
      examples: noImages.slice(0, 5).map((l) => ({ id: l.id, title: l.title })),
      detected_at: now,
    });
  }

  // 13. Active listings outside AU region
  const wrongRegion = (activeListings as any[]).filter(
    (l) => l.region_id && l.region_id !== "au"
  );
  if (wrongRegion.length) {
    issues.push({
      id: "wrong_region_listings",
      title: "Listings outside AU region",
      description: `${wrongRegion.length} active listing(s) are tagged to a non-AU region.`,
      severity: "medium",
      user_impact: "Listings won't show to AU buyers (Flea is AU-exclusive).",
      suggested_fix: "Reassign to AU region.",
      auto_fix_id: "fix_relocate_to_au",
      category: "Compliance",
      count: wrongRegion.length,
      examples: wrongRegion.slice(0, 5).map((l) => ({ id: l.id, title: l.title, region_id: l.region_id })),
      detected_at: now,
    });
  }

  // 14. Pending reports older than 7 days
  const oldReports = (pendingReports as any[]).filter(
    (r) => r.created_at && r.created_at < daysAgo(7)
  );
  if (oldReports.length) {
    issues.push({
      id: "moderation_backlog",
      title: "Moderation queue backlog",
      description: `${oldReports.length} report(s) have been pending for over 7 days.`,
      severity: oldReports.length >= 10 ? "high" : "medium",
      user_impact: "Reported content stays visible. Reporters lose confidence.",
      suggested_fix: "Triage in the Reports tab.",
      auto_fix_id: null,
      category: "Moderation",
      count: oldReports.length,
      examples: oldReports.slice(0, 5).map((r) => ({ id: r.id, created_at: r.created_at, type: r.report_type })),
      detected_at: now,
    });
  }

  // 15. Duplicate listings (same seller + title + brand)
  const dupKeys = new Map<string, any[]>();
  for (const l of duplicateScan as any[]) {
    if (l.status !== "active") continue;
    const k = `${l.user_id}|${(l.title ?? "").toLowerCase().trim()}|${(l.brand ?? "").toLowerCase().trim()}`;
    if (!k.split("|")[1]) continue;
    const arr = dupKeys.get(k) ?? [];
    arr.push(l);
    dupKeys.set(k, arr);
  }
  const duplicates = [...dupKeys.values()].filter((arr) => arr.length > 1);
  const totalDupes = duplicates.reduce((s, arr) => s + arr.length, 0);
  if (duplicates.length) {
    issues.push({
      id: "duplicate_listings",
      title: "Duplicate listings detected",
      description: `${duplicates.length} group(s) of duplicate listings (${totalDupes} listings total) from same seller.`,
      severity: "low",
      user_impact: "Spammy feed, possible fraud, dilutes search quality.",
      suggested_fix: "Manual review in Listings tab; remove duplicates.",
      auto_fix_id: null,
      category: "Spam & Fraud",
      count: duplicates.length,
      examples: duplicates.slice(0, 5).map((arr) => ({ count: arr.length, title: arr[0].title, seller: arr[0].user_id })),
      detected_at: now,
    });
  }

  // 16. Suspicious title patterns (URLs, emails)
  const suspicious = (activeListings as any[]).filter((l) =>
    /(https?:\/\/|www\.|@\w+\.\w+)/i.test(l.title ?? "")
  );
  if (suspicious.length) {
    issues.push({
      id: "suspicious_title_patterns",
      title: "Listings with off-platform contact links",
      description: `${suspicious.length} listing(s) contain URLs or emails in titles — likely off-platform fraud attempts.`,
      severity: "high",
      user_impact: "Buyers can be lured off-platform and scammed. Direct policy violation.",
      suggested_fix: "Hide listings and warn sellers.",
      auto_fix_id: "fix_hide_suspicious_titles",
      category: "Spam & Fraud",
      count: suspicious.length,
      examples: suspicious.slice(0, 5).map((l) => ({ id: l.id, title: l.title })),
      detected_at: now,
    });
  }

  // 17. Sellers paused but with active listings
  const pausedWithActive = (activeListings as any[]).filter((l) => {
    const p = profileMap.get(l.user_id);
    return p && p.pause_selling === true;
  });
  const pausedSellersAffected = new Set(pausedWithActive.map((l) => l.user_id));
  if (pausedWithActive.length) {
    issues.push({
      id: "paused_sellers_active_listings",
      title: "Paused sellers with active listings",
      description: `${pausedSellersAffected.size} paused seller(s) have ${pausedWithActive.length} listings still showing as active.`,
      severity: "low",
      user_impact: "Buyers may purchase from sellers on holiday, leading to delays.",
      suggested_fix: "These should display as paused — verify pause UI is applied.",
      auto_fix_id: null,
      category: "Listings",
      count: pausedWithActive.length,
      examples: pausedWithActive.slice(0, 5).map((l) => ({ id: l.id, title: l.title, seller: l.user_id })),
      detected_at: now,
    });
  }

  // Sort: critical → high → medium → low, then by count desc
  const sevOrder: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  issues.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || b.count - a.count);

  const summary = {
    total: issues.length,
    critical: issues.filter((i) => i.severity === "critical").length,
    high: issues.filter((i) => i.severity === "high").length,
    medium: issues.filter((i) => i.severity === "medium").length,
    low: issues.filter((i) => i.severity === "low").length,
    auto_fixable: issues.filter((i) => i.auto_fix_id).length,
    last_scan: now,
  };

  return { issues, summary };
}

async function runSystemFix(fixId: string) {
  switch (fixId) {
    case "fix_stale_stripe_flag": {
      const stale = await safeSelect("profiles", {
        stripe_onboarding_complete: "eq.true",
        stripe_account_id: "is.null",
        select: "user_id",
      });
      let fixed = 0;
      for (const p of stale as any[]) {
        await safePatch("profiles", { user_id: `eq.${p.user_id}` }, { stripe_onboarding_complete: false });
        fixed++;
      }
      return { ok: true, fixed, message: `Reset Stripe onboarding flag for ${fixed} profile(s).` };
    }


    case "fix_remove_heavily_reported": {
      const targets = await safeSelect("listings", {
        status: "eq.active",
        report_count: "gte.3",
        select: "id",
      });
      let fixed = 0;
      for (const l of targets as any[]) {
        await safePatch("listings", { id: `eq.${l.id}` }, { status: "removed" });
        fixed++;
      }
      return { ok: true, fixed, message: `Removed ${fixed} heavily-reported listing(s).` };
    }

    case "fix_block_overstrike_users": {
      const targets = await safeSelect("profiles", {
        report_strike_count: "gte.3",
        status: "neq.blocked",
        select: "user_id",
      });
      let fixed = 0;
      for (const p of targets as any[]) {
        await safePatch("profiles", { user_id: `eq.${p.user_id}` }, { status: "blocked" });
        fixed++;
      }
      return { ok: true, fixed, message: `Blocked ${fixed} repeat-offender account(s).` };
    }

    case "fix_archive_blocked_listings": {
      const blockedProfiles = await safeSelect("profiles", { status: "eq.blocked", select: "user_id" });
      const ids = (blockedProfiles as any[]).map((p) => p.user_id);
      if (ids.length === 0) return { ok: true, fixed: 0, message: "Nothing to fix." };
      const targets = await safeSelect("listings", {
        user_id: `in.(${ids.join(",")})`,
        status: "eq.active",
        select: "id",
      });
      let fixed = 0;
      for (const l of targets as any[]) {
        await safePatch("listings", { id: `eq.${l.id}` }, { status: "archived" });
        fixed++;
      }
      return { ok: true, fixed, message: `Archived ${fixed} listing(s) from blocked sellers.` };
    }

    case "fix_backfill_refund_timestamps": {
      return { ok: true, fixed: 0, message: "Refunds are tracked by refund timestamp. No backfill needed." };
    }

    case "fix_restore_orphan_sold": {
      const orderListingsAll = await safeSelect("orders", { select: "listing_id" });
      const withOrders = new Set((orderListingsAll as any[]).map((o) => o.listing_id));
      const sold = await safeSelect("listings", { status: "eq.sold", select: "id" });
      let fixed = 0;
      for (const l of sold as any[]) {
        if (!withOrders.has(l.id)) {
          await safePatch("listings", { id: `eq.${l.id}` }, { status: "active" });
          fixed++;
        }
      }
      return { ok: true, fixed, message: `Restored ${fixed} orphan listing(s) to active.` };
    }

    case "fix_hide_imageless_listings": {
      const all = await safeSelect("listings", { status: "eq.active", select: "id,images" });
      let fixed = 0;
      for (const l of all as any[]) {
        if (!Array.isArray(l.images) || l.images.length === 0) {
          await safePatch("listings", { id: `eq.${l.id}` }, { status: "hidden" });
          fixed++;
        }
      }
      return { ok: true, fixed, message: `Hidden ${fixed} listing(s) with no images.` };
    }

    case "fix_relocate_to_au": {
      const wrong = await safeSelect("listings", {
        status: "eq.active",
        region_id: "neq.au",
        select: "id",
      });
      let fixed = 0;
      for (const l of wrong as any[]) {
        await safePatch("listings", { id: `eq.${l.id}` }, { region_id: "au" });
        fixed++;
      }
      return { ok: true, fixed, message: `Reassigned ${fixed} listing(s) to AU region.` };
    }

    case "fix_hide_suspicious_titles": {
      const all = await safeSelect("listings", { status: "eq.active", select: "id,title" });
      let fixed = 0;
      for (const l of all as any[]) {
        if (/(https?:\/\/|www\.|@\w+\.\w+)/i.test(l.title ?? "")) {
          await safePatch("listings", { id: `eq.${l.id}` }, { status: "hidden" });
          fixed++;
        }
      }
      return { ok: true, fixed, message: `Hidden ${fixed} listing(s) with off-platform contact links.` };
    }

    default:
      throw new Error(`Unknown fix: ${fixId}`);
  }
}

// ----------------- Live Badges -----------------
async function countRows(table: string, params: Record<string, string> = {}) {
  const search = new URLSearchParams({ select: "id", ...params, limit: "1" });
  const res = await fetch(`${EXTERNAL_URL}/rest/v1/${table}?${search.toString()}`, {
    headers: {
      apikey: EXTERNAL_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${EXTERNAL_SERVICE_ROLE_KEY}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  const range = res.headers.get("content-range") ?? "";
  const total = Number(range.split("/")[1] ?? 0);
  return Number.isFinite(total) ? total : 0;
}

async function getBadges() {
  const [supportUnread, reportsPending, bansActive, suggestionsUnread, waitlist, contact, awaitingOrders, refundedOrders, listingsActive, users, brands] = await Promise.all([
    countRows("chat_messages", { sender_type: "eq.user", read: "eq.false" }),
    countRows("reports", { status: "eq.pending" }),
    countRows("banned_users", { status: "eq.active" }).catch(() => 0),
    countRows("suggestions", { read: "eq.false" }).catch(() => 0),
    countRows("waitlist", {}).catch(() => 0),
    countRows("contact_submissions", {}).catch(() => 0),
    countRows("orders", { status: "eq.awaiting" }),
    countRows("orders", { refunded_at: "not.is.null" }),
    countRows("listings", { status: "eq.active" }),
    countRows("profiles", {}),
    countRows("brands", {}).catch(() => 0),
  ]);
  return {
    support: supportUnread,
    reports: reportsPending,
    bans: bansActive,
    suggestions: suggestionsUnread,
    waitlist,
    contact,
    transactions: awaitingOrders,
    refunds: refundedOrders,
    listings: listingsActive,
    users,
    brands,
  };
}

// ----------------- Brands -----------------
async function listBrands(payload: any = {}) {
  const search = (payload?.search ?? "").trim().toLowerCase();
  const rows = await safeSelect("brands", { order: "usage_count.desc.nullslast", limit: "1000" });
  const filtered = search
    ? rows.filter((b: any) =>
        (b.brand_name ?? "").toLowerCase().includes(search) ||
        (b.display_name ?? "").toLowerCase().includes(search))
    : rows;
  return { brands: filtered };
}

async function updateBrand(payload: any = {}) {
  const { id, display_name } = payload ?? {};
  if (!id || !display_name) throw new Error("id and display_name required");
  const trimmed = String(display_name).trim();
  if (!trimmed) throw new Error("display_name required");
  const brand_name = trimmed
    .toLowerCase()
    .replace(/[^\w\s&+'-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  await safePatch("brands", { id: `eq.${id}` }, { display_name: trimmed, brand_name });
  return { ok: true };
}

async function deleteBrand(payload: any = {}) {
  const { id } = payload ?? {};
  if (!id) throw new Error("id required");
  await rest(query("brands", { id: `eq.${id}` }), { method: "DELETE", prefer: "return=minimal" });
  return { ok: true };
}

// ----------------- Refunds & Disputes -----------------
async function listRefunds(payload: any = {}) {
  const filter = payload?.filter ?? "all"; // all | refunded | requested
  const params: Record<string, string> = { select: ORDER_ADMIN_SELECT + ",refunded_at,refund_reason", order: "updated_at.desc", limit: "500" };
  if (filter === "refunded") params.refunded_at = "not.is.null";
  else if (filter === "requested") params.status = "eq.refund_requested";
  else params.or = "(refunded_at.not.is.null,status.eq.refund_requested)";
  const orders = await safeSelect("orders", params);
  const userIds = unique([...orders.map((o: any) => o.buyer_id), ...orders.map((o: any) => o.seller_id)]);
  const listingIds = unique(orders.map((o: any) => o.listing_id));
  const [profiles, listings] = await Promise.all([
    userIds.length ? safeSelect("profiles", { user_id: `in.(${userIds.join(",")})` }) : Promise.resolve([] as any[]),
    listingIds.length ? safeSelect("listings", { id: `in.(${listingIds.join(",")})`, select: "id,title,images,price" }) : Promise.resolve([] as any[]),
  ]);
  const profileMap = new Map(profiles.map((p: any) => [p.user_id, { username: p.username, avatar_url: p.avatar_url }]));
  const listingMap = new Map(listings.map((l: any) => [l.id, l]));
  return {
    orders: orders.map((o: any) => ({
      ...o,
      buyer_profile: profileMap.get(o.buyer_id) ?? null,
      seller_profile: profileMap.get(o.seller_id) ?? null,
      listing: listingMap.get(o.listing_id) ?? null,
    })),
  };
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
      case "listSystemIssues":
        return response(await listSystemIssues());
      case "runSystemFix":
        return response(await runSystemFix(payload.fixId));
      case "listWaitlist": {
        const rows = await safeSelect("waitlist", { order: "created_at.desc", limit: 5000 });
        return response({ entries: rows });
      }
      case "listContactSubmissions": {
        const rows = await safeSelect("contact_submissions", { order: "created_at.desc", limit: 5000 });
        return response({ submissions: rows });
      }
      case "getBadges":
        return response(await getBadges());
      case "listBrands":
        return response(await listBrands(payload));
      case "updateBrand":
        return response(await updateBrand(payload));
      case "deleteBrand":
        return response(await deleteBrand(payload));
      case "listRefunds":
        return response(await listRefunds(payload));
      default:
        return response({ error: "Unknown admin action" }, 400);
    }
  } catch (error) {
    console.error("admin-data failed", error);
    return response({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
