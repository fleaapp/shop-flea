/**
 * In-app network request logger.
 *
 * Wraps window.fetch and XMLHttpRequest to capture every network call
 * — including ones that hang — so they can be inspected from a debug
 * overlay inside the app (no Safari Web Inspector required).
 */

export type NetStatus = "pending" | "ok" | "error" | "timeout";

export interface NetEntry {
  id: number;
  method: string;
  url: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  status: NetStatus;
  httpStatus?: number;
  error?: string;
  kind: "fetch" | "xhr";
}

type Listener = (entries: NetEntry[]) => void;

const MAX_ENTRIES = 200;
const STUCK_AFTER_MS = 8000;

let entries: NetEntry[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
let installed = false;

const notify = () => {
  // shallow copy so consumers can rely on reference identity to re-render
  const snapshot = entries.slice();
  listeners.forEach((l) => {
    try {
      l(snapshot);
    } catch {
      /* ignore */
    }
  });
};

const push = (entry: NetEntry) => {
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  notify();
};

const update = (id: number, patch: Partial<NetEntry>) => {
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return;
  entries[idx] = { ...entries[idx], ...patch };
  notify();
};

export const netLogger = {
  getEntries(): NetEntry[] {
    return entries.slice();
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  clear() {
    entries = [];
    notify();
  },
  pendingCount(): number {
    const now = Date.now();
    return entries.filter(
      (e) => e.status === "pending" && now - e.startedAt > STUCK_AFTER_MS
    ).length;
  },
  errorCount(): number {
    return entries.filter((e) => e.status === "error" || e.status === "timeout")
      .length;
  },
};

const shortUrl = (raw: string): string => {
  try {
    const u = new URL(raw, window.location.origin);
    return `${u.host}${u.pathname}${u.search}`;
  } catch {
    return raw;
  }
};

export const installNetLogger = () => {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // ----- fetch -----
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const id = nextId++;
    const method = (init?.method || (typeof input !== "string" && "method" in (input as Request) ? (input as Request).method : "GET") || "GET").toUpperCase();
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const startedAt = Date.now();
    push({ id, method, url: shortUrl(url), startedAt, status: "pending", kind: "fetch" });
    try {
      const res = await originalFetch(input as RequestInfo, init);
      const endedAt = Date.now();
      update(id, {
        endedAt,
        durationMs: endedAt - startedAt,
        status: res.ok ? "ok" : "error",
        httpStatus: res.status,
      });
      return res;
    } catch (err: unknown) {
      const endedAt = Date.now();
      update(id, {
        endedAt,
        durationMs: endedAt - startedAt,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };

  // ----- XHR -----
  const OriginalXHR = window.XMLHttpRequest;
  function PatchedXHR(this: XMLHttpRequest) {
    const xhr = new OriginalXHR();
    let id = 0;
    let startedAt = 0;
    let method = "GET";
    let url = "";

    const origOpen = xhr.open.bind(xhr);
    xhr.open = function (m: string, u: string | URL, ...rest: unknown[]) {
      method = (m || "GET").toUpperCase();
      url = typeof u === "string" ? u : u.toString();
      // @ts-expect-error - passthrough rest args
      return origOpen(m, u, ...rest);
    } as typeof xhr.open;

    const origSend = xhr.send.bind(xhr);
    xhr.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      id = nextId++;
      startedAt = Date.now();
      push({ id, method, url: shortUrl(url), startedAt, status: "pending", kind: "xhr" });
      xhr.addEventListener("loadend", () => {
        const endedAt = Date.now();
        if (xhr.status === 0) {
          update(id, {
            endedAt,
            durationMs: endedAt - startedAt,
            status: "error",
            error: "Network error / aborted",
          });
        } else {
          update(id, {
            endedAt,
            durationMs: endedAt - startedAt,
            status: xhr.status >= 200 && xhr.status < 400 ? "ok" : "error",
            httpStatus: xhr.status,
          });
        }
      });
      xhr.addEventListener("timeout", () => {
        const endedAt = Date.now();
        update(id, {
          endedAt,
          durationMs: endedAt - startedAt,
          status: "timeout",
          error: "Timeout",
        });
      });
      return origSend(body);
    } as typeof xhr.send;

    return xhr;
  }
  PatchedXHR.prototype = OriginalXHR.prototype;
  window.XMLHttpRequest = PatchedXHR as unknown as typeof XMLHttpRequest;

  // Periodic re-render so the overlay shows stuck-pending durations ticking up
  setInterval(() => {
    if (entries.some((e) => e.status === "pending")) notify();
  }, 1000);
};
