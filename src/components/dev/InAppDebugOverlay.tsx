import { useEffect, useRef, useState } from 'react';

type LogEntry = {
  t: number;
  level: 'log' | 'warn' | 'error' | 'info';
  msg: string;
};

// Global ring buffer so logs captured BEFORE the overlay mounts aren't lost.
const BUF: LogEntry[] = [];
const MAX = 200;
let installed = false;
const listeners = new Set<() => void>();

const push = (level: LogEntry['level'], args: unknown[]) => {
  const msg = args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    })
    .join(' ');
  BUF.push({ t: Date.now(), level, msg });
  if (BUF.length > MAX) BUF.shift();
  listeners.forEach((l) => l());
};

const install = () => {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  (['log', 'info', 'warn', 'error'] as const).forEach((lvl) => {
    const orig = console[lvl].bind(console);
    console[lvl] = (...args: unknown[]) => {
      try { push(lvl, args); } catch {}
      orig(...args);
    };
  });

  window.addEventListener('error', (e) => {
    push('error', [`window.error: ${e.message}`, e.filename, `:${e.lineno}`]);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = (e as PromiseRejectionEvent).reason;
    push('error', ['unhandledrejection:', r?.message || r]);
  });

  push('info', [`boot @ ${new Date().toISOString()} ua=${navigator.userAgent.slice(0, 80)}`]);
};

install();

const fmtTime = (t: number) => {
  const d = new Date(t);
  return d.toTimeString().slice(0, 8);
};

export const InAppDebugOverlay = ({ context }: { context?: string }) => {
  const [, force] = useState(0);
  const [open, setOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cb = () => force((n) => n + 1);
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [BUF.length]);

  const copyAll = async () => {
    const text = BUF.map((e) => `[${fmtTime(e.t)}] ${e.level.toUpperCase()} ${e.msg}`).join('\n');
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 12, right: 12, zIndex: 2147483647,
          background: '#000', color: '#0f0', padding: '6px 10px',
          fontSize: 12, borderRadius: 8, fontFamily: 'monospace',
        }}
      >
        debug ({BUF.length})
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', left: 8, right: 8, bottom: 8, zIndex: 2147483647,
        maxHeight: '55vh', display: 'flex', flexDirection: 'column',
        background: 'rgba(0,0,0,0.92)', color: '#e5e7eb', borderRadius: 10,
        fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11,
        border: '1px solid #333', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderBottom: '1px solid #222' }}>
        <strong style={{ color: '#9bff9b' }}>DEBUG</strong>
        {context && <span style={{ color: '#aaa' }}>· {context}</span>}
        <span style={{ marginLeft: 'auto', color: '#888' }}>{BUF.length} entries</span>
        <button onClick={copyAll} style={{ background: '#222', color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: 11 }}>copy</button>
        <button onClick={() => { BUF.length = 0; force((n) => n + 1); }} style={{ background: '#222', color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: 11 }}>clear</button>
        <button onClick={() => setOpen(false)} style={{ background: '#222', color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: 11 }}>×</button>
      </div>
      <div ref={scrollRef} style={{ overflowY: 'auto', padding: '6px 8px', flex: 1 }}>
        {BUF.length === 0 && <div style={{ color: '#888' }}>(no logs yet)</div>}
        {BUF.map((e, i) => {
          const color = e.level === 'error' ? '#ff8a8a' : e.level === 'warn' ? '#ffd27a' : e.level === 'info' ? '#9ad7ff' : '#e5e7eb';
          return (
            <div key={i} style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 2 }}>
              <span style={{ color: '#666' }}>{fmtTime(e.t)} </span>
              <span style={{ color: '#888' }}>{e.level.padEnd(5)} </span>
              {e.msg}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InAppDebugOverlay;
