import { useEffect, useState } from 'react';
import type { Listing } from '@/types/listing';

const KEY = 'flea_guest_wishlist';
const EVENT = 'flea-guest-wishlist-change';

type Stored = Listing & { _addedAt: number };

const readAll = (): Stored[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAll = (items: Stored[]) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* ignore quota */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
};

export const addGuestFavorite = (listing?: Listing) => {
  if (!listing) return;
  const items = readAll().filter((l) => l.id !== listing.id);
  items.unshift({ ...(listing as Listing), _addedAt: Date.now() } as Stored);
  writeAll(items);
};

export const removeGuestFavorite = (listingId: string) => {
  const next = readAll().filter((l) => l.id !== listingId);
  writeAll(next);
};

export const clearGuestFavorites = () => {
  writeAll([]);
};

export const getGuestFavorites = (): Listing[] => readAll();

export const useGuestWishlist = (): Listing[] => {
  const [items, setItems] = useState<Listing[]>(() => readAll());
  useEffect(() => {
    const onChange = () => setItems(readAll());
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  return items;
};
