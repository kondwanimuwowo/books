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

// Each side gets this long to answer; silence declines.
export const OFFER_REPLY_HOURS = 24
export const OFFER_HOLD_HOURS = 24
// One counter each: after the buyer's counter the seller can only accept or decline.
export const MAX_COUNTERS = 2
// Declined or withdrawn offers a buyer can make on one copy in a week, so sellers aren't worn down.
export const OFFERS_PER_COPY_PER_WEEK = 3

export const MAX_LISTING_PHOTOS = 3

// The moment after Publish: what's live, and the next thing a seller with a stack of books wants to do.
export const LISTED_COPY = {
  title: 'Your book is listed',
  line: (title: string) => `Buyers across Zambia can find ${title} now.`,
  another: 'List another book',
  view: 'See your listing',
} as const

export const PHOTOS_COPY = {
  heading: 'Photos of your copy',
  used: 'Up to three: the front, the back and any wear. Buyers trust what they can see. At least one.',
  new: 'Optional for new copies: the cover above shows the book.',
  required: 'Add at least one photo of your copy. Buyers want to see its condition.',
  thisCopy: 'This copy',
  backToCover: 'Back to the cover',
} as const

export const LISTING_RULES = 'Don’t list photocopies, or books marked as government, school, library or donated property, or not for sale.'

export const REPORT_REASONS = [
  { value: 'copy', label: 'It’s a photocopy or pirated copy' },
  { value: 'not_for_sale', label: 'It’s marked government, school, library or donated property' },
  { value: 'misdescribed', label: 'The photos or details are wrong' },
  { value: 'other', label: 'Something else' },
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]['value']

export const REPORT_COPY = {
  link: 'Report this copy',
  heading: 'What’s wrong with this copy?',
  placeholder: 'Anything that helps us check (optional)',
  thanks: 'Thanks. We’ll look at it and take it down if it breaks the rules.',
  removedSubject: (title: string) => `We took down your listing of ${title}`,
  removedLines: (title: string) => [
    `We removed your listing of ${title} after a report that it breaks the listing rules: no photocopies, and no books marked as government, school, library or donated property, or not for sale.`,
    'If you think we got it wrong, reply to this email.',
  ],
} as const
