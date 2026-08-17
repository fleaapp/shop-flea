import type { TemplateEntry } from './types.ts'

import { template as buyerOrderConfirmation } from './buyer-order-confirmation.tsx'
import { template as buyerOrderShipped } from './buyer-order-shipped.tsx'
import { template as buyerRefundRequested } from './buyer-refund-requested.tsx'
import { template as buyerRefundSent } from './buyer-refund-sent.tsx'
import { template as buyerOfferStatus } from './buyer-offer-status.tsx'
import { template as sellerItemSold } from './seller-item-sold.tsx'
import { template as sellerShippingReminder } from './seller-shipping-reminder.tsx'
import { template as sellerRefundIssued } from './seller-refund-issued.tsx'
import { template as sellerPayoutAvailable } from './seller-payout-available.tsx'
import { template as welcome } from './welcome.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'buyer-order-confirmation': buyerOrderConfirmation,
  'buyer-order-shipped': buyerOrderShipped,
  'buyer-refund-requested': buyerRefundRequested,
  'buyer-refund-sent': buyerRefundSent,
  'buyer-offer-status': buyerOfferStatus,
  'seller-item-sold': sellerItemSold,
  'seller-shipping-reminder': sellerShippingReminder,
  'seller-refund-issued': sellerRefundIssued,
  'seller-payout-available': sellerPayoutAvailable,
  'welcome': welcome,
}
