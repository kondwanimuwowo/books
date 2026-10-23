import type { payoutStatus, sellerOrderStatus } from '#/db/schema'

export type SellerOrderStatus = (typeof sellerOrderStatus.enumValues)[number]
export type PayoutStatus = (typeof payoutStatus.enumValues)[number]

const NEUTRAL = 'bg-neutral-100 text-neutral-800'
const ACTIVE = 'bg-accent-100 text-accent-800'
const GOOD = 'bg-success-100 text-success-700'
const BAD = 'bg-danger-100 text-danger-700'
const WARN = 'bg-copper-100 text-copper-700'

// Operator-facing wording (admin). Buyer and seller pages phrase these for their side.
export const SELLER_ORDER_STATUS: Record<SellerOrderStatus, { label: string; tone: string }> = {
  awaiting_payment: { label: 'Awaiting payment', tone: NEUTRAL },
  to_ship: { label: 'To ship', tone: WARN },
  shipped: { label: 'Shipped', tone: ACTIVE },
  delivered: { label: 'Delivered', tone: GOOD },
  cancelled: { label: 'Cancelled', tone: NEUTRAL },
  disputed: { label: 'Problem reported', tone: BAD },
  refunded: { label: 'Refunded', tone: NEUTRAL },
}

export const PAYOUT_STATUS: Record<PayoutStatus, { label: string; tone: string }> = {
  held: { label: 'Held until delivery', tone: NEUTRAL },
  released: { label: 'Ready to pay out', tone: WARN },
  processing: { label: 'Paying out', tone: ACTIVE },
  paid: { label: 'Paid', tone: GOOD },
  failed: { label: 'Payout failed', tone: BAD },
  refunded: { label: 'Refunded to buyer', tone: NEUTRAL },
}
