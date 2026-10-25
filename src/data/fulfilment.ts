import type { ShippingMethod } from './shipping'

// What happens between payment and delivery: shipping deadlines, proof of shipping, and refunds.

/** A paid parcel not shipped by then is cancelled and the buyer refunded in full. */
export const SHIP_WITHIN_DAYS = 5
/** The seller is reminded this long after payment. */
export const SHIP_REMINDER_DAYS = 3
/** Automatic refunds that fail this often go to admin to send by hand. */
export const MAX_REFUND_ATTEMPTS = 3

/** Couriers that hand over a receipt or waybill; its photo is required to mark the parcel shipped. */
export const PROOF_REQUIRED: readonly ShippingMethod[] = ['platinum', 'mercury', 'bus_parcel']

export const SHIP_FORM: Partial<Record<ShippingMethod, { label: string; placeholder: string }>> = {
  yango: { label: 'Yango trip link', placeholder: 'Paste the trip link from the Yango app' },
  collect: { label: 'Where and when to pick up', placeholder: 'Manda Hill entrance, Saturday 10:00' },
}
export const SHIP_FORM_DEFAULT = { label: 'Receipt or waybill number', placeholder: 'Platinum waybill 12345, arriving Thursday' }

export const FULFILMENT_COPY = {
  proofLabel: 'Photo of the receipt',
  proofHint: 'The courier’s receipt or waybill. Only Kuwala sees it, if there’s ever a problem.',
  proofRequired: 'Add a photo of the courier’s receipt',
  shipBy: (day: string) => `Ship by ${day}, or the order is refunded to the buyer.`,
  reminderSubject: (number: string) => `Ship order ${number} by tomorrow`,
  reminderLines: (day: string) => [
    `A buyer paid for books from your shop ${SHIP_REMINDER_DAYS} days ago and they haven’t been marked as shipped.`,
    `Ship them and mark them shipped by ${day}. After that the order is cancelled and the buyer refunded.`,
  ],
  cancelledBuyerSubject: (number: string) => `Refund for order ${number}`,
  cancelledBuyerLines: (store: string, amount: string, automatic: boolean) => [
    `${store} didn’t ship your books within ${SHIP_WITHIN_DAYS} days, so we’ve cancelled that part of your order.`,
    automatic ? `${amount} is on its way back to your mobile money.` : `We’re refunding ${amount} to your card. It can take a few days to show.`,
  ],
  cancelledSellerSubject: (number: string) => `Order ${number} was cancelled`,
  cancelledSellerLines: [
    `The order wasn’t marked as shipped within ${SHIP_WITHIN_DAYS} days, so the buyer has been refunded and you won’t be paid for it.`,
    'We’ve paused the listing in case you’re out of copies. Switch it back on in Your listings if you still have it.',
  ],
} as const

/** A seller has this long to answer a problem report before admin decides without them. */
export const DISPUTE_REPLY_HOURS = 48
/** Problem reports by one buyer (or refunded ones against one seller) in this window that start to count against them. */
export const CLAIM_WINDOW_DAYS = 180
export const CLAIM_FLAG_AT = 2

export const DISPUTE_COPY = {
  sellerSubject: (number: string) => `A buyer reported a problem with order ${number}`,
  sellerLines: (note: string, hours: number) => [
    'The buyer says:',
    note,
    `Reply within ${hours} hours with what happened and a photo of your courier receipt or tracking. If we don’t hear from you, we decide on what the buyer told us.`,
  ],
  replyHeading: 'Your side',
  replyHint: (due: string) => `Reply by ${due}: what happened, with a photo of the receipt, tracking or chat.`,
  replyPlaceholder: 'Sent with Platinum on Monday, waybill 12345. The tracking says it reached Kitwe on Wednesday.',
  proofLabel: 'Photo of your proof',
  proofHint: 'Receipt, tracking screen or chat. Only Kuwala sees it.',
  sent: 'Thanks. We’ll look at both sides and decide within 3 working days.',
} as const
