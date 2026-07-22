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

  const { data } = await supabase
    .from('profiles_public')
    .select(
      'user_id, bundle_shipping_mode, bundle_shipping_discount_percent, tiered_shipping_enabled, shipping_tier_1, shipping_tier_2, shipping_tier_3'
    )
    .in('user_id', uniqueIds);

  (data || []).forEach((profile: any) => {
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

  const isBundle = items.length >= 2;

  if (sellerSettings.mode === 'free' && isBundle) return 0;

  if (sellerSettings.mode === 'discounted' && isBundle && sellerSettings.discountPercent) {
    const pct = Math.max(0, Math.min(100, sellerSettings.discountPercent));
    return round2(subtotal * (1 - pct / 100));
  }

  return round2(subtotal);
}

export const calculateSellerBundleShipping = calculateSellerShipping;

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
 */
export function getBundleBreakdownText(
  itemCount: number,
  sellerSettings: SellerShippingInfo | undefined
): string | null {
  if (!sellerSettings || itemCount < 2) return null;
  if (sellerSettings.mode === 'free') return 'Free bundle shipping';
  if (sellerSettings.mode === 'discounted' && sellerSettings.discountPercent) {
    return `Bundle discount: ${sellerSettings.discountPercent}% off shipping`;
  }
  return null;
}
