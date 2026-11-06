/** Internal callers must present the actual server credential, never decoded claims. */
export function matchesServiceCredential(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header?.startsWith('Bearer ')) return false;
  const token = header.slice(7).trim();
  if (token.length !== secret.length) return false;
  let difference = 0;
  for (let i = 0; i < secret.length; i++) difference |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  return difference === 0;
}