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
  hasNotch: boolean; // notched/Dynamic Island iPhones — bigger Safari chrome offset
};

// Real CSS pixel dimensions (portrait) — public Apple/Android specs.
const DEVICES: Device[] = [
  // iPhone SE — Touch ID, no notch
  { id: "iphone-se",            label: "iPhone SE",              width: 375, height: 667, dpr: 2, hasNotch: false },

  // 13 family
  { id: "iphone-13-mini",       label: "iPhone 13 mini",         width: 375, height: 812, dpr: 3, hasNotch: true },
  { id: "iphone-13",            label: "iPhone 13 / 13 Pro",     width: 390, height: 844, dpr: 3, hasNotch: true },
  { id: "iphone-13-pro-max",    label: "iPhone 13 Pro Max",      width: 428, height: 926, dpr: 3, hasNotch: true },

  // 14 family
  { id: "iphone-14",            label: "iPhone 14",              width: 390, height: 844, dpr: 3, hasNotch: true },
  { id: "iphone-14-plus",       label: "iPhone 14 Plus",         width: 428, height: 926, dpr: 3, hasNotch: true },
  { id: "iphone-14-pro",        label: "iPhone 14 Pro",          width: 393, height: 852, dpr: 3, hasNotch: true },
  { id: "iphone-14-pro-max",    label: "iPhone 14 Pro Max",      width: 430, height: 932, dpr: 3, hasNotch: true },

  // 15 family
  { id: "iphone-15",            label: "iPhone 15 / 15 Pro",     width: 393, height: 852, dpr: 3, hasNotch: true },
  { id: "iphone-15-plus",       label: "iPhone 15 Plus / Pro Max", width: 430, height: 932, dpr: 3, hasNotch: true },

  // 16 family
  { id: "iphone-16",            label: "iPhone 16",              width: 393, height: 852, dpr: 3, hasNotch: true },
  { id: "iphone-16-plus",       label: "iPhone 16 Plus",         width: 430, height: 932, dpr: 3, hasNotch: true },
  { id: "iphone-16-pro",        label: "iPhone 16 Pro",          width: 402, height: 874, dpr: 3, hasNotch: true },
  { id: "iphone-16-pro-max",    label: "iPhone 16 Pro Max",      width: 440, height: 956, dpr: 3, hasNotch: true },

  // 17 family
  { id: "iphone-17",            label: "iPhone 17",              width: 402, height: 874, dpr: 3, hasNotch: true },
  { id: "iphone-17-pro",        label: "iPhone 17 Pro",          width: 402, height: 874, dpr: 3, hasNotch: true },
  { id: "iphone-17-pro-max",    label: "iPhone 17 Pro Max",      width: 440, height: 992, dpr: 3, hasNotch: true },

  // Android
  { id: "android-small",        label: "Small Android",          width: 360, height: 740, dpr: 2,     hasNotch: false },
  { id: "android-large",        label: "Large Android",          width: 412, height: 915, dpr: 2.625, hasNotch: false },
];

// Mobile Safari (or Chrome on Android) UI eats space at top + bottom.
// Notched iPhones: ~59px top + ~114px bottom toolbar visible.
// Touch-ID SE: ~50px top + ~64px bottom.
// Android Chrome: ~56px top + ~48px bottom.
function getSafariVisibleHeight(d: Device): number {
  if (d.id === "iphone-se") return d.height - 114;
  if (d.hasNotch) return d.height - 173;
  return d.height - 104; // android
}
// PWA / standalone: only status bar / status bar + gesture pill.
function getStandaloneVisibleHeight(d: Device): number {
  if (d.id === "iphone-se") return d.height - 20;
  if (d.hasNotch) return d.height - 34; // status area; home-indicator overlays content
  return d.height - 24;
}



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

function ScaledFrame({
  device,
  visibleHeight,
  chromeMode,
  iframeSrc,
  children,
}: {
  device: Device;
  visibleHeight: number;
  chromeMode: ChromeMode;
  iframeSrc: string;
  children?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  const bezel = chromeMode === "full" ? 10 : 2;
  const frameWidth = device.width + bezel * 2;
  const frameHeight = visibleHeight + bezel * 2;

  useLayoutEffect(() => {
    const compute = () => {
      const el = containerRef.current;
      if (!el) return;
      // Leave ~80px margin for the top chrome toolbar + breathing room
      const availW = el.clientWidth - 32;
      const availH = el.clientHeight - 80;
      const s = Math.min(availW / frameWidth, availH / frameHeight, 1);
      setScale(s > 0 ? s : 1);
    };
    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [frameWidth, frameHeight]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483646,
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: frameWidth,
          height: frameHeight,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          background: "#000",
          borderRadius: chromeMode === "full" ? 40 : 20,
          padding: bezel,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          border: "1px solid #222",
          boxSizing: "border-box",
          flexShrink: 0,
        }}
      >
        <iframe
          src={iframeSrc}
          title={device.label}
          style={{
            width: device.width,
            height: visibleHeight,
            border: "none",
            borderRadius: chromeMode === "full" ? 30 : 18,
            background: "#fff",
            display: "block",
          }}
        />
      </div>
      {children}
    </div>
  );
}

