import type { payoutStatus, sellerOrderStatus } from '#/db/schema'

export type SellerOrderStatus = (typeof sellerOrderStatus.enumValues)[number]
export type PayoutStatus = (typeof payoutStatus.enumValues)[number]

const NEUTRAL = 'bg-sunken text-ink'
const ACTIVE = 'bg-accent-soft text-accent-soft-ink'
const GOOD = 'bg-success-soft text-success'
const BAD = 'bg-danger-soft text-danger'
const WARN = 'bg-warning-soft text-warning'

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
