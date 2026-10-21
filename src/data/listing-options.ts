export const CONDITIONS = [
  { value: 'new', label: 'New', note: 'Unread, as it left the printer' },
  { value: 'like_new', label: 'Like new', note: 'Read once, no marks' },
  { value: 'very_good', label: 'Very good', note: 'Light wear, clean pages' },
  { value: 'good', label: 'Good', note: 'Visible wear, some notes or highlighting' },
  { value: 'acceptable', label: 'Acceptable', note: 'Heavy wear, all pages present' },
] as const

export type Condition = (typeof CONDITIONS)[number]['value']

export const FORMATS = [
  { value: 'paperback', label: 'Paperback' },
  { value: 'hardcover', label: 'Hardcover' },
] as const

export type Format = (typeof FORMATS)[number]['value']

export function conditionLabel(value: string) {
  return CONDITIONS.find((c) => c.value === value)?.label ?? value
}

export function formatLabel(value: string) {
  return FORMATS.find((f) => f.value === value)?.label ?? value
}

export const SELLER_KINDS = [
  { value: 'individual', label: 'Reader', note: 'Selling books I own' },
  { value: 'author', label: 'Author', note: 'Selling my own titles' },
  { value: 'bookshop', label: 'Bookshop', note: 'A shop with stock' },
  { value: 'publisher', label: 'Publisher', note: 'Publishing house' },
] as const

export type SellerKind = (typeof SELLER_KINDS)[number]['value']

export const COMMISSION_RATE = 0.1
