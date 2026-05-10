import { supabase } from '@/lib/supabase';

interface ShippingSettings {
  tiered_shipping_enabled: boolean;
  shipping_tier_1: number;
  shipping_tier_2: number;
  shipping_tier_3: number;
}

export interface CartItem {
  id: string;
  sellerId: string;
  shippingPrice: number;
}

export interface SellerShippingInfo {
  sellerId: string;
  tieredEnabled: boolean;
  tier1: number;
  tier2: number;
  tier3: number;
}

/**
 * Fetches shipping settings for multiple sellers
 */
export async function fetchSellerShippingSettings(sellerIds: string[]): Promise<Map<string, SellerShippingInfo>> {
  const uniqueIds = [...new Set(sellerIds)];
  
  const { data } = await supabase
    .from('profiles_public')
    .select('user_id, tiered_shipping_enabled, shipping_tier_1, shipping_tier_2, shipping_tier_3')
    .in('user_id', uniqueIds);

  const settingsMap = new Map<string, SellerShippingInfo>();
  
  (data || []).forEach((profile) => {
    settingsMap.set(profile.user_id, {
      sellerId: profile.user_id,
      tieredEnabled: profile.tiered_shipping_enabled ?? false,
      tier1: Number(profile.shipping_tier_1) || 5,
      tier2: Number(profile.shipping_tier_2) || 7,
      tier3: Number(profile.shipping_tier_3) || 9,
    });
  });

  return settingsMap;
}

/**
 * Calculates total shipping for items from a single seller based on their tiered shipping settings
 */
export function calculateSellerShipping(
  items: CartItem[],
  sellerSettings: SellerShippingInfo | undefined
): number {
  if (!items.length) return 0;

  // If no settings found or tiered shipping is disabled, sum individual shipping prices
  if (!sellerSettings || !sellerSettings.tieredEnabled) {
    return items.reduce((sum, item) => sum + (item.shippingPrice || 0), 0);
  }

  // Tiered shipping is enabled - calculate based on item count
  const itemCount = items.length;
  
  if (itemCount === 1) {
    return sellerSettings.tier1;
  } else if (itemCount <= 3) {
    return sellerSettings.tier2;
  } else {
    return sellerSettings.tier3;
  }
}

/**
 * Groups items by seller and calculates total shipping for all sellers
 */
export function calculateTotalShipping(
  items: CartItem[],
  sellerSettingsMap: Map<string, SellerShippingInfo>
): { totalShipping: number; shippingBySeller: Map<string, number> } {
  // Group items by seller
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

  return { totalShipping, shippingBySeller };
}

/**
 * Hook-friendly function to get shipping breakdown text
 */
export function getShippingBreakdownText(
  itemCount: number,
  sellerSettings: SellerShippingInfo | undefined
): string {
  if (!sellerSettings || !sellerSettings.tieredEnabled) {
    return 'Individual shipping per item';
  }

  if (itemCount === 1) {
    return `Base shipping: $${sellerSettings.tier1.toFixed(2)}`;
  } else if (itemCount <= 3) {
    return `Combined shipping (${itemCount} items): $${sellerSettings.tier2.toFixed(2)}`;
  } else {
    return `Bulk shipping (${itemCount} items): $${sellerSettings.tier3.toFixed(2)}`;
  }
}
