/**
 * User-scoped caches of the listing IDs the user has wishlisted or passed.
 *
 * `useFavorites` / `useDiscardedListings` live inside Home, which unmounts
 * whenever a listing is opened. Without a cache their sets reset to empty on
 * every remount and only refill after a database round-trip - so the cached
 * swipe deck paints already-actioned cards for a few hundred milliseconds
 * (the "ghost card" flash). Seeding state from these caches means the very
 * first render already knows what to hide; the background fetch still runs and
 * reconciles.
 *
 * Persisted to localStorage so the same holds after a cold start.
 */

type Kind = 'fav' | 'discarded';

const memory: Record<Kind, { userId: string | null; ids: Set<string> } | null> = {
  fav: null,
  discarded: null,
};

const storageKey = (kind: Kind, userId: string) =>
  kind === 'fav' ? `flea_fav_ids_${userId}` : `flea_discarded_ids_${userId}`;

export const getActionedIds = (kind: Kind, userId: string | null): Set<string> => {
  if (!userId) return new Set();

  const cached = memory[kind];
  if (cached && cached.userId === userId) return new Set(cached.ids);

  try {
    const raw = localStorage.getItem(storageKey(kind, userId));
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    const ids = new Set(Array.isArray(parsed) ? parsed : []);
    memory[kind] = { userId, ids: new Set(ids) };
    return ids;
  } catch {
    return new Set();
  }
};

export const setActionedIds = (kind: Kind, userId: string | null, ids: Set<string>) => {
  if (!userId) return;
  memory[kind] = { userId, ids: new Set(ids) };
  try {
    localStorage.setItem(storageKey(kind, userId), JSON.stringify([...ids]));
  } catch {
    // Storage full / unavailable - the in-memory cache still helps.
  }
};

export const clearActionedIds = (kind: Kind, userId?: string | null) => {
  const target = userId ?? memory[kind]?.userId ?? null;
  memory[kind] = null;
  if (!target) return;
  try {
    localStorage.removeItem(storageKey(kind, target));
  } catch {
    // no-op
  }
};

export const clearAllActionedIds = (userId?: string | null) => {
  clearActionedIds('fav', userId);
  clearActionedIds('discarded', userId);
};
