// Ratings, reader badges and the trusted-reader mark. Thresholds live here so they can be tuned.

export const RATING_WINDOW_DAYS = 30
/** A rating stays hidden until the other side rates too, or this long after delivery. */
export const BLIND_DAYS = 14

export const withinRatingWindow = (deliveredAt: Date | string) => Date.now() - new Date(deliveredAt).getTime() < RATING_WINDOW_DAYS * 86_400_000

export const SHOP_TAGS = ['As described', 'Well packed', 'Quick to send', 'Easy to reach'] as const
export const READER_TAGS = ['Paid promptly', 'Easy to reach', 'Smooth handover'] as const

export const SCORE_LABELS = ['', 'Poor', 'Below par', 'Fine', 'Good', 'Excellent'] as const

export const READER_BADGES = [
  { key: 'page_turner', label: 'Page turner', books: 5 },
  { key: 'bookworm', label: 'Bookworm', books: 20 },
  { key: 'patron', label: 'Kuwala patron', books: 50 },
] as const

export type ReaderBadge = (typeof READER_BADGES)[number]

export function readerBadge(books: number): ReaderBadge | null {
  return [...READER_BADGES].reverse().find((b) => books >= b.books) ?? null
}

export const TRUSTED = {
  orders: 3,
  /** Only judged once there are this many ratings. */
  ratings: 3,
  average: 4.5,
  /** Accepted offers left unpaid in this window cost the mark. */
  unpaidDays: 90,
} as const

export const REPUTATION_COPY = {
  rateShop: (store: string) => `How was ${store}?`,
  rateReader: 'How was this buyer?',
  thanks: 'Thanks. It counts once they’ve rated too, or in two weeks.',
  trusted: 'Trusted reader',
  noRatings: 'No ratings yet',
} as const
