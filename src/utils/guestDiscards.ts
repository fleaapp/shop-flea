const KEY = 'flea_guest_discards';
const EVENT = 'flea-guest-discards-change';

const readAll = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
};

const writeAll = (ids: string[]) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
};

export const addGuestDiscard = (listingId: string) => {
  const ids = readAll();
  if (ids.includes(listingId)) return;
  ids.push(listingId);
  writeAll(ids);
};

export const removeGuestDiscard = (listingId: string) => {
  writeAll(readAll().filter((id) => id !== listingId));
};

export const getGuestDiscards = (): string[] => readAll();

export const clearGuestDiscards = () => {
  writeAll([]);
};
