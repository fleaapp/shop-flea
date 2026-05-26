import { useEffect, useState } from "react";
import { netLogger, NetEntry } from "@/lib/netLogger";

/**
 * Floating debug button + panel that lists every network request the app
 * has made. Tap the 📡 button (bottom-right) to open. Works in production
 * builds inside the iOS simulator so you don't need Safari Web Inspector.
 *
 * To hide permanently, remove <NetworkLogOverlay /> from App.tsx, or
 * set localStorage.setItem('flea_net_overlay', 'off').
 */
const NetworkLogOverlay = () => {
  const [entries, setEntries] = useState<NetEntry[]>(netLogger.getEntries());
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(
    typeof window !== "undefined" &&
      localStorage.getItem("flea_net_overlay") !== "off"
  );

  useEffect(() => {
    return netLogger.subscribe(setEntries);
  }, []);

  if (!enabled) return null;

  const pending = entries.filter((e) => e.status === "pending").length;
  const errors = entries.filter(
    (e) => e.status === "error" || e.status === "timeout"
  ).length;

  const now = Date.now();

  const dotColor = (e: NetEntry) => {
    if (e.status === "pending") {
      const age = now - e.startedAt;
      return age > 8000 ? "#f97316" : "#fbbf24"; // stuck=orange, fresh=yellow
    }
    if (e.status === "ok") return "#22c55e";
    return "#ef4444"; // error / timeout
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Network log"
        style={{
          position: "fixed",
          right: 12,
          bottom: 96,
          zIndex: 2147483646,
          width: 44,
          height: 44,
          borderRadius: 22,
          background: "rgba(17,17,17,0.85)",
          color: "white",
          border: "1px solid rgba(255,255,255,0.2)",
          fontSize: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        }}
      >
        📡
        {(pending > 0 || errors > 0) && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              borderRadius: 9,
              background: errors > 0 ? "#ef4444" : "#fbbf24",
              color: "white",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {errors > 0 ? errors : pending}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483647,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            flexDirection: "column",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              marginTop: "auto",
              background: "#0a0a0a",
              color: "white",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid #222",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                Network · {entries.length} total · {pending} pending · {errors} failed
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => netLogger.clear()}
                  style={btnStyle}
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem("flea_net_overlay", "off");
                    setEnabled(false);
                  }}
                  style={btnStyle}
                >
                  Hide
                </button>
                <button onClick={() => setOpen(false)} style={btnStyle}>
                  Close
                </button>
              </div>
            </div>
            <div
              style={{
                overflowY: "auto",
                paddingBottom: "max(16px, env(safe-area-inset-bottom))",
              }}
            >
              {entries.length === 0 && (
                <div style={{ padding: 24, opacity: 0.6, textAlign: "center" }}>
                  No requests yet.
                </div>
              )}
              {entries.map((e) => {
                const duration =
                  e.durationMs ?? Math.max(0, now - e.startedAt);
                return (
                  <div
                    key={e.id}
                    style={{
                      padding: "8px 16px",
                      borderBottom: "1px solid #1a1a1a",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          background: dotColor(e),
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: 700, color: "#a3e635" }}>
                        {e.method}
                      </span>
                      <span style={{ opacity: 0.6 }}>
                        {e.httpStatus ?? (e.status === "pending" ? "…" : "—")}
                      </span>
                      <span style={{ marginLeft: "auto", opacity: 0.7 }}>
                        {duration}ms
                      </span>
                    </div>
                    <div
                      style={{
                        wordBreak: "break-all",
                        opacity: 0.85,
                        fontSize: 11,
                      }}
                    >
                      {e.url}
                    </div>
                    {e.error && (
                      <div style={{ color: "#fca5a5", fontSize: 11 }}>
                        {e.error}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const btnStyle: React.CSSProperties = {
  background: "#1f1f1f",
  color: "white",
  border: "1px solid #333",
  padding: "6px 10px",
  borderRadius: 6,
  fontSize: 12,
  fontFamily: "inherit",
};

export default NetworkLogOverlay;
