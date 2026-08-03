import { BundleShippingMode } from '@/utils/shippingCalculator';

interface BundleOfferBadgeProps {
  mode?: BundleShippingMode | string | null;
  discountPercent?: number | null;
  itemDiscountPercent?: number | null;
  className?: string;
}

export function getBundleOfferLabel(
  mode?: BundleShippingMode | string | null,
  discountPercent?: number | null,
  itemDiscountPercent?: number | null
): string | null {
  if (mode === 'free') return 'Free ✈️ on bundles';
  if (mode === 'discounted' && discountPercent) return `${discountPercent}% off ✈️ on bundles`;
  if (mode === 'item_discount' && itemDiscountPercent) return `📦 ${itemDiscountPercent}% off bundles`;
  return null;
}

const BundleOfferBadge = ({ mode, discountPercent, itemDiscountPercent, className = '' }: BundleOfferBadgeProps) => {
  const label = getBundleOfferLabel(mode, discountPercent, itemDiscountPercent);
  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border border-primary bg-primary/20 px-3 py-1 text-xs font-semibold text-foreground ${className}`}
    >
      {label}
    </span>
  );
};

export default BundleOfferBadge;
