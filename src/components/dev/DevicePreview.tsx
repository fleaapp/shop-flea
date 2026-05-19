import { useEffect, useMemo, useState, useLayoutEffect, useRef } from "react";

/**
 * Dev-only device preview toggle.
 * Renders a floating button on Lovable preview / localhost only.
 * Opens an overlay with an <iframe> of the same origin sized to the chosen device,
 * giving an exact simulation (media queries respond to the iframe's real viewport).
 *
 * Hidden completely on production hosts (finditonflea.com, shop-flea.lovable.app, etc.).
 */

type Device = {
  id: string;
  label: string;
  width: number;
  height: number;
  dpr: number;
  // Safari visible viewport height (URL bar collapsed + bottom toolbar shown), portrait
  safariVisibleHeight: number;
  // PWA standalone visible height (no Safari chrome, just status bar)
  standaloneVisibleHeight: number;
};

// Real CSS dimensions. safariVisibleHeight reflects what you actually see on the
// device when Safari's bottom toolbar is visible (the common case while browsing).
const DEVICES: Device[] = [
  { id: "iphone-se",        label: "iPhone SE",         width: 375, height: 667, dpr: 2,     safariVisibleHeight: 553, standaloneVisibleHeight: 647 },
  { id: "iphone-13-mini",   label: "iPhone 12/13 Mini", width: 375, height: 812, dpr: 3,     safariVisibleHeight: 663, standaloneVisibleHeight: 778 },
  { id: "iphone-standard",  label: "iPhone (15/16)",    width: 393, height: 852, dpr: 3,     safariVisibleHeight: 695, standaloneVisibleHeight: 818 },
  { id: "iphone-pro",       label: "iPhone Pro",        width: 402, height: 874, dpr: 3,     safariVisibleHeight: 715, standaloneVisibleHeight: 840 },
  { id: "iphone-17-pro-max",label: "iPhone 17 Pro Max", width: 440, height: 956, dpr: 3,     safariVisibleHeight: 791, standaloneVisibleHeight: 922 },
  { id: "android-small",    label: "Small Android",     width: 360, height: 740, dpr: 2,     safariVisibleHeight: 620, standaloneVisibleHeight: 716 },
  { id: "android-large",    label: "Large Android",     width: 412, height: 915, dpr: 2.625, safariVisibleHeight: 791, standaloneVisibleHeight: 891 },
];


const STORAGE_KEY = "flea_dev_device_preview";
const IFRAME_PARAM = "devpreview";

const isPreviewHost = (() => {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.includes("id-preview--") ||
    h.endsWith("lovableproject.com")
  );
})();

const isInsideDevicePreviewFrame = (() => {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).has(IFRAME_PARAM);
  } catch {
    return false;
  }
})();

type ChromeMode = "safari" | "standalone" | "full";
const CHROME_KEY = "flea_dev_device_chrome";

export default function DevicePreview() {
  const [open, setOpen] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(STORAGE_KEY);
  });
  const [chromeMode, setChromeMode] = useState<ChromeMode>(() => {
    if (typeof window === "undefined") return "safari";
    return (localStorage.getItem(CHROME_KEY) as ChromeMode) || "safari";
  });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(CHROME_KEY, chromeMode);
  }, [chromeMode]);


  const device = useMemo(() => DEVICES.find((d) => d.id === deviceId) ?? null, [deviceId]);

  useEffect(() => {
    if (deviceId) localStorage.setItem(STORAGE_KEY, deviceId);
    else localStorage.removeItem(STORAGE_KEY);
  }, [deviceId]);

  useEffect(() => {
    if (device) setOpen(true);
  }, [device]);

  if (!isPreviewHost || isInsideDevicePreviewFrame) return null;

  const iframeSrc = (() => {
    const url = new URL(window.location.href);
    url.searchParams.set(IFRAME_PARAM, "1");
    return url.toString();
  })();

  return (
    <>
      {/* Floating toggle */}
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 2147483647,
          background: "#111",
          color: "#fff",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          fontSize: 12,
          fontWeight: 600,
          padding: "8px 12px",
          borderRadius: 999,
          border: "1px solid #333",
          boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
          cursor: "pointer",
        }}
        aria-label="Device preview"
      >
        📱 {device ? device.label : "Device"}
      </button>

      {menuOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 60,
            right: 16,
            zIndex: 2147483647,
            background: "#1a1a1a",
            color: "#fff",
            border: "1px solid #333",
            borderRadius: 12,
            padding: 6,
            minWidth: 200,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            fontSize: 13,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setDeviceId(null);
              setOpen(false);
              setMenuOpen(false);
            }}
            style={menuItemStyle(!device)}
          >
            Off (responsive)
          </button>
          {DEVICES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setDeviceId(d.id);
                setOpen(true);
                setMenuOpen(false);
              }}
              style={menuItemStyle(device?.id === d.id)}
            >
              <span>{d.label}</span>
              <span style={{ opacity: 0.5, marginLeft: 8, fontSize: 11 }}>
                {d.width}×{d.height}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen frame */}
      {open && device && (() => {
        const visibleHeight =
          chromeMode === "safari" ? device.safariVisibleHeight :
          chromeMode === "standalone" ? device.standaloneVisibleHeight :
          device.height;
        return (
        <ScaledFrame
          device={device}
          visibleHeight={visibleHeight}
          chromeMode={chromeMode}
          iframeSrc={iframeSrc}
        >
          <div
            style={{
              position: "fixed",
              top: 12,
              left: 12,
              color: "#aaa",
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
              fontSize: 12,
              zIndex: 10,
            }}
          >
            {device.label} · {device.width}×{visibleHeight} @{device.dpr}x · {chromeMode}
          </div>

          <div
            style={{
              position: "fixed",
              top: 12,
              left: 12,
              color: "#aaa",
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
              fontSize: 12,
            }}
          >
            {device.label} · {device.width}×{visibleHeight} @{device.dpr}x · {chromeMode}
          </div>
          <div
            style={{
              position: "fixed",
              top: 12,
              right: 12,
              display: "flex",
              gap: 6,
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
            }}
          >
            {(["safari", "standalone", "full"] as ChromeMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setChromeMode(m)}
                style={{
                  background: chromeMode === m ? "#fff" : "#222",
                  color: chromeMode === m ? "#000" : "#fff",
                  border: "1px solid #333",
                  borderRadius: 999,
                  padding: "6px 10px",
                  fontSize: 11,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {m === "safari" ? "Safari" : m === "standalone" ? "PWA" : "Full"}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                background: "#222",
                color: "#fff",
                border: "1px solid #333",
                borderRadius: 999,
                padding: "6px 12px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Hide
            </button>
          </div>
        </ScaledFrame>
        );
      })()}

    </>
  );
}

function menuItemStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    width: "100%",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 10px",
    background: active ? "#2a2a2a" : "transparent",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    textAlign: "left",
    fontSize: 13,
  };
}
