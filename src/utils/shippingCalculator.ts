import { supabase } from '@/lib/supabase';

export type BundleShippingMode = 'none' | 'discounted' | 'free';

export interface CartItem {
  id: string;
  sellerId: string;
  shippingPrice: number;
}

export interface SellerShippingInfo {
  sellerId: string;
  mode: BundleShippingMode;
  discountPercent: number | null; // 10/20/30/40/50 when mode = 'discounted'
  // Legacy fields kept for back-compat with any older callers
  tieredEnabled?: boolean;
  tier1?: number;
  tier2?: number;
  tier3?: number;
}

/**
 * Fetches bundle shipping settings for multiple sellers.
 */
export async function fetchSellerShippingSettings(
  sellerIds: string[]
): Promise<Map<string, SellerShippingInfo>> {
  const uniqueIds = [...new Set(sellerIds)];
  const settingsMap = new Map<string, SellerShippingInfo>();
  if (uniqueIds.length === 0) return settingsMap;

  const selectFields =
    'user_id, bundle_shipping_mode, bundle_shipping_discount_percent, tiered_shipping_enabled, shipping_tier_1, shipping_tier_2, shipping_tier_3';

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
 *  - none: sum every item's shipping price.
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
 *  - none: sum of raw shippings.
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
 * Callers render the ✈️ and bold "Bundle shipping:" prefix themselves.
 */
export function getBundleBreakdownText(
  itemCount: number,
  sellerSettings: SellerShippingInfo | undefined
): { detail: string } | null {
  if (!sellerSettings || itemCount < 2) return null;
  if (sellerSettings.mode === 'free') return { detail: 'Free shipping on bundles' };
  if (sellerSettings.mode === 'discounted' && sellerSettings.discountPercent) {
    return { detail: `${sellerSettings.discountPercent}% off combined shipping` };
  }
  return null;
}
