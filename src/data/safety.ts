// Copy that keeps payments and conversations on Kuwala, where escrow covers them.
// Phone numbers are only shared once an order is paid (see getOrder and getMySales).
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
