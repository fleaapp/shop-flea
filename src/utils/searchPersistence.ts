// Persists the home feed's search query + filter state across navigation.
// Restored only if saved within the TTL window.

const STORAGE_KEY = 'flea_home_search_state';
const TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface PersistedSearchState<TFilters = unknown> {
  query: string;
  filters: TFilters | null;
  savedAt: number;
}

export function loadSearchState<TFilters = unknown>(): PersistedSearchState<TFilters> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSearchState<TFilters>;
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSearchState<TFilters = unknown>(query: string, filters: TFilters | null) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ query, filters, savedAt: Date.now() } satisfies PersistedSearchState<TFilters>)
    );
  } catch {
    // ignore quota / privacy-mode failures
  }
}

export function clearSearchState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
