import type { SellerKind } from './listing-options'

export interface KindCopy {
  label: string
  line: string
  /** Step 2 heading and the line under it. */
  setupTitle: string
  setupLine: string
  nameLabel: string
  nameHint: string
  bioLabel: string
  bioPlaceholder: string
  photoLabel: string
  /** Authors must add a photo; everyone else falls back to their initial. */
  photoRequired: boolean
  photoShape: 'cover' | 'square'
  doneTitle: string
}

export const KIND_COPY: Record<SellerKind, KindCopy> = {
  individual: {
    label: 'Reader',
    line: 'Here to sell books I own.',
    setupTitle: 'Set up your stall',
    setupLine: 'Like a stall at Kamwala, but the whole country can browse it.',
    nameLabel: 'Stall name',
    nameHint: 'Your name works. So does “Mwila’s Shelf”.',
    bioLabel: 'A line about you (optional)',
    bioPlaceholder: 'Mostly novels and old school books, all in good shape.',
    photoLabel: 'Add a photo',
    photoRequired: false,
    photoShape: 'square',
    doneTitle: 'Your stall is open',
  },
  author: {
    label: 'Author',
    line: 'Selling my own titles.',
    setupTitle: 'Your author page',
    setupLine: 'Readers buy from people. Show them who wrote the book.',
    nameLabel: 'Name on your books',
    nameHint: 'Your pen name, if you write under one.',
    bioLabel: 'About you',
    bioPlaceholder: 'Where you are from, what you write, and why.',
    photoLabel: 'Add your photo',
    photoRequired: true,
    photoShape: 'cover',
    doneTitle: 'Your author page is ready',
  },
  bookshop: {
    label: 'Bookshop',
    line: 'A shop with books on the shelves.',
    setupTitle: 'Your shop',
    setupLine: 'Bring the shelves online. Buyers anywhere in Zambia can order.',
    nameLabel: 'Shop name',
    nameHint: 'As it is on the signboard.',
    bioLabel: 'About the shop (optional)',
    bioPlaceholder: 'Where you are, what you stock, opening hours.',
    photoLabel: 'Add your logo',
    photoRequired: false,
    photoShape: 'square',
    doneTitle: 'Your shop is open',
  },
  publisher: {
    label: 'Publisher',
    line: 'Publishing and selling our list.',
    setupTitle: 'Your imprint',
    setupLine: 'Sell your list direct, from new releases to the backlist.',
    nameLabel: 'Publisher name',
    nameHint: 'As printed on your books.',
    bioLabel: 'About the house (optional)',
    bioPlaceholder: 'What you publish and since when.',
    photoLabel: 'Add your logo',
    photoRequired: false,
    photoShape: 'square',
    doneTitle: 'Your imprint is open',
  },
}

export const KIND_ORDER: SellerKind[] = ['individual', 'author', 'bookshop', 'publisher']

export const ONBOARDING = {
  roleTitle: 'Which one are you?',
  roleLine: 'You can change this later.',
  verifyTitle: 'Get verified',
  verifyLine: 'The verified mark tells readers the books are really yours. You can sell while we check.',
  verifySkip: 'I’ll do this later',
  shareLine: 'Send it to your WhatsApp groups. The first buyers usually come from people you know.',
  firstBook: 'List your first book',
  inReview: 'Verification in review. We usually reply within two working days.',
} as const

/** Shown on the account page beside the name. */
export const VERIFICATION_LABELS = {
  pending: 'In review',
  approved: 'Verified',
  rejected: 'Not verified',
  needs_more: 'Needs more',
} as const
