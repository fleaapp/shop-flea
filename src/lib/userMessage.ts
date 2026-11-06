/** Shared presentation only - never alter stored messages or provider diagnostics. */
export function userMessage(value: unknown): unknown {
  if (typeof value !== 'string' || !value.trim()) return value;
  const text = value.trim().replace(/[—–]/g, '-').replace(/\bStripe\b/gi, 'payment provider');
  return text.endsWith('.') ? text : `${text}.`;
}