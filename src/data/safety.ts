// Copy that keeps payments and conversations on Kuwala, where escrow covers them.
// Phone numbers are only shared once an order is paid (see getOrder and getMySales).
import { CARD_PAYMENTS, NETWORKS } from './payments'

export const SAFETY = {
  checkout: 'Pay and agree everything on Kuwala. Your money is held until you confirm the book arrived. If you pay a seller directly, we can’t get it back for you.',
  buyerContact: 'Use this number to arrange delivery, never to pay. Confirm only once the book is in your hands.',
  sellerContact: 'Use this number to arrange delivery. Never ask a buyer to pay you outside Kuwala: those payments aren’t protected and can close your shop.',
  offer: 'Numbers are shared once an order is paid, so leave them out of your message.',
  phoneInMessage: 'Leave phone numbers out. They’re shared once an order is paid.',
} as const

// Web addresses, so reviews and messages can't send buyers off Kuwala.
export function containsLink(text: string) {
  return /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|co\.zm|zm|net|org|me|link|ly)\b/i.test(text)
}

// Zambian mobile numbers however they're typed: 097 123 4567, 0971-234567, +260 97 1234567.
export function containsPhoneNumber(text: string) {
  // Not inside a longer run of digits, so ISBNs and prices pass.
  return /(?<!\d)(?:\+?260|0)[79]\d{8}(?!\d)/.test(text.replace(/[\s().-]/g, ''))
}

// The three questions a careful buyer has before paying, answered under the price.
export const BUY_TRUST = {
  delivery: (inTown: string | null, outOfTown: string | null, extra: string | null) =>
    [inTown && `${inTown} in the seller’s town`, outOfTown && `${outOfTown} to other towns${extra ? `, plus ${extra} for each extra book` : ''}`].filter(Boolean).join(', ') ||
    'Shown at checkout',
  pay: `${NETWORKS.map((n) => n.name).join(', ')}${CARD_PAYMENTS ? ' or card' : ''}, approved on your own phone.`,
  held: 'Your money is held until you confirm the book arrived. Something wrong? Report it before you confirm.',
} as const
