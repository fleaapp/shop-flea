import { supabase } from '@/lib/supabase';

export type BundleShippingMode = 'none' | 'discounted' | 'free' | 'item_discount';

export interface CartItem {
  id: string;
  sellerId: string;
  shippingPrice: number;
}

export interface SellerShippingInfo {
  sellerId: string;
  mode: BundleShippingMode;
  discountPercent: number | null; // 5-50 when mode = 'discounted'
  itemDiscountPercent: number | null; // 5-50 when mode = 'item_discount'
  // Legacy fields kept for back-compat with any older callers
  tieredEnabled?: boolean;
  tier1?: number;
  tier2?: number;
  tier3?: number;
}

/**
 * Fetches bundle offer settings for multiple sellers.
 */
export async function fetchSellerShippingSettings(
  sellerIds: string[]
): Promise<Map<string, SellerShippingInfo>> {
  const uniqueIds = [...new Set(sellerIds)];
  const settingsMap = new Map<string, SellerShippingInfo>();
  if (uniqueIds.length === 0) return settingsMap;

  const selectFields =
    'user_id, bundle_shipping_mode, bundle_shipping_discount_percent, bundle_item_discount_percent, tiered_shipping_enabled, shipping_tier_1, shipping_tier_2, shipping_tier_3';

  const normalizeRows = (rows: any[] | null | undefined) => {
    (rows || []).forEach((profile: any) => {
      const mode = (profile.bundle_shipping_mode as BundleShippingMode) || 'none';
      settingsMap.set(profile.user_id, {
        sellerId: profile.user_id,
        mode,
        discountPercent:
          mode === 'discounted' && profile.bundle_shipping_discount_percent != null
            ? Number(profile.bundle_shipping_discount_percent)
            : null,
        itemDiscountPercent:
          mode === 'item_discount' && profile.bundle_item_discount_percent != null
            ? Number(profile.bundle_item_discount_percent)
            : null,
        tieredEnabled: profile.tiered_shipping_enabled ?? false,
        tier1: Number(profile.shipping_tier_1) || 0,
        tier2: Number(profile.shipping_tier_2) || 0,
        tier3: Number(profile.shipping_tier_3) || 0,
      });
    });
  };

  const publicResponse = await supabase
    .from('profiles_public')
    .select(selectFields)
    .in('user_id', uniqueIds);

  if (!publicResponse.error) {
    normalizeRows(publicResponse.data as any[] | null);
    return settingsMap;
  }

  console.warn('profiles_public unavailable for shipping settings, falling back to profiles table:', publicResponse.error.message);

  const fallbackResponse = await supabase
    .from('profiles')
    .select(selectFields)
    .in('user_id', uniqueIds);

  if (fallbackResponse.error) {
    console.error('Failed to fetch seller shipping settings:', fallbackResponse.error);
    return settingsMap;
  }

  normalizeRows(fallbackResponse.data as any[] | null);

  return settingsMap;
}

export const fetchSellerBundleSettings = fetchSellerShippingSettings;

/**
 * Calculates shipping for one seller's items in a single order.
 *
 * Rules:
 *  - none / item_discount: sum every item's shipping price.
 *  - discounted: if 1 item -> its own shipping. If 2+ items -> sum * (1 - discount%).
 *  - free: if 1 item -> its own shipping. If 2+ items -> 0.
 */
export function calculateSellerShipping(
  items: CartItem[],
  sellerSettings: SellerShippingInfo | undefined
): number {
  if (!items.length) return 0;
  const subtotal = items.reduce((sum, i) => sum + (Number(i.shippingPrice) || 0), 0);
  if (!sellerSettings) return round2(subtotal);

  return calculateBundleShippingTotal(
    items.map((i) => Number(i.shippingPrice) || 0),
    sellerSettings.mode,
    sellerSettings.discountPercent
  );
}

export const calculateSellerBundleShipping = calculateSellerShipping;

/**
 * Raw bundle-shipping math used by both cart and refund calculations.
 *
 * Rules:
 *  - none / item_discount: sum of raw shippings.
 *  - discounted: if 2+ items -> sum * (1 - discount%).
 *  - free: if 2+ items -> 0.
 *  Single items always pay their own raw shipping.
 */
export function calculateBundleShippingTotal(
  rawShippings: number[],
  mode: BundleShippingMode,
  discountPercent: number | null
): number {
  if (!rawShippings.length) return 0;
  const subtotal = round2(rawShippings.reduce((sum, s) => sum + (Number(s) || 0), 0));
  if (rawShippings.length < 2) return subtotal;

  if (mode === 'free') return 0;

  if (mode === 'discounted' && discountPercent) {
    const pct = Math.max(0, Math.min(100, Number(discountPercent) || 0));
    return round2(subtotal * (1 - pct / 100));
  }

  return subtotal;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Groups items by seller and totals shipping across all sellers.
 */
export function calculateTotalShipping(
  items: CartItem[],
  sellerSettingsMap: Map<string, SellerShippingInfo>
): { totalShipping: number; shippingBySeller: Map<string, number> } {
  const itemsBySeller = new Map<string, CartItem[]>();
  items.forEach((item) => {
    const existing = itemsBySeller.get(item.sellerId) || [];
    itemsBySeller.set(item.sellerId, [...existing, item]);
  });

  const shippingBySeller = new Map<string, number>();
  let totalShipping = 0;

  itemsBySeller.forEach((sellerItems, sellerId) => {
    const settings = sellerSettingsMap.get(sellerId);
    const sellerShipping = calculateSellerShipping(sellerItems, settings);
    shippingBySeller.set(sellerId, sellerShipping);
    totalShipping += sellerShipping;
  });

  return { totalShipping: round2(totalShipping), shippingBySeller };
}

/**
 * Cart / Checkout bundle label. Returns null when no label should be shown.
 * Bundle labels only appear when itemCount >= 2 AND mode !== 'none'.
 * Shipping-based modes use ✈️, the item discount mode uses 📦.
 */
export function getBundleBreakdownText(
  itemCount: number,
  sellerSettings: SellerShippingInfo | undefined
): { detail: string; emoji: string; label: string } | null {
  if (!sellerSettings || itemCount < 2) return null;
  if (sellerSettings.mode === 'free') {
    return { detail: 'Free shipping on bundles', emoji: '✈️', label: 'Bundle shipping:' };
  }
  if (sellerSettings.mode === 'discounted' && sellerSettings.discountPercent) {
    return {
      detail: `${sellerSettings.discountPercent}% off combined shipping`,
      emoji: '✈️',
      label: 'Bundle shipping:',
    };
  }
  if (sellerSettings.mode === 'item_discount' && sellerSettings.itemDiscountPercent) {
    return {
      detail: `${sellerSettings.itemDiscountPercent}% off items in this bundle`,
      emoji: '📦',
      label: 'Bundle offer:',
    };
  }
  return null;
}

/**
 * Item-level bundle discount. Applies only when the seller's mode is
 * 'item_discount' and the buyer takes 2+ items from that seller.
 * Items bought at an accepted offer price are excluded (no double discount)
 * but still count toward the 2-item threshold.
 */
export function calculateBundleItemDiscount(
  items: { price: number; hasAcceptedOffer?: boolean }[],
  sellerSettings: SellerShippingInfo | undefined
): number {
  if (!sellerSettings || sellerSettings.mode !== 'item_discount') return 0;
  if (items.length < 2) return 0;
  const pct = Math.max(0, Math.min(100, Number(sellerSettings.itemDiscountPercent) || 0));
  if (pct <= 0) return 0;

  return round2(
    items.reduce((sum, item) => {
      if (item.hasAcceptedOffer) return sum;
      const price = Number(item.price) || 0;
      return sum + round2(price - round2(price * (1 - pct / 100)));
    }, 0)
  );
}

/**
 * Totals the item-level bundle discount across every seller in a cart.
 */
export function calculateTotalItemDiscount(
  items: { sellerId: string; price: number; hasAcceptedOffer?: boolean }[],
  sellerSettingsMap: Map<string, SellerShippingInfo>
): { totalDiscount: number; discountBySeller: Map<string, number> } {
  const bySeller = new Map<string, { price: number; hasAcceptedOffer?: boolean }[]>();
  items.forEach((item) => {
    const existing = bySeller.get(item.sellerId) || [];
    bySeller.set(item.sellerId, [...existing, item]);
  });

  const discountBySeller = new Map<string, number>();
  let totalDiscount = 0;
  bySeller.forEach((sellerItems, sellerId) => {
    const d = calculateBundleItemDiscount(sellerItems, sellerSettingsMap.get(sellerId));
    discountBySeller.set(sellerId, d);
    totalDiscount += d;
  });

  return { totalDiscount: round2(totalDiscount), discountBySeller };
}
