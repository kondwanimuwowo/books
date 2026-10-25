import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

// All money columns are integer ngwee (1 ZMW = 100 ngwee).

const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
})

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())

export const sellerKind = pgEnum('seller_kind', [
  'individual',
  'bookshop',
  'author',
  'publisher',
])
export const bookSource = pgEnum('book_source', [
  'google',
  'openlibrary',
  'manual',
])
export const bookFormat = pgEnum('book_format', ['paperback', 'hardcover'])
export const bookCondition = pgEnum('book_condition', [
  'new',
  'like_new',
  'very_good',
  'good',
  'acceptable',
])
export const listingStatus = pgEnum('listing_status', [
  'active',
  'paused',
  'sold_out',
  'removed',
])
export const orderStatus = pgEnum('order_status', [
  'pending_payment',
  'paid',
  'completed',
  'cancelled',
])
export const sellerOrderStatus = pgEnum('seller_order_status', [
  'awaiting_payment',
  'to_ship',
  'shipped',
  'delivered',
  'cancelled',
  'disputed',
  'refunded',
])
// 'courier' and 'zampost' are retired; they stay in the enum for past orders.
export const shippingMethod = pgEnum('shipping_method', [
  'courier',
  'bus_parcel',
  'zampost',
  'collect',
  'yango',
  'platinum',
  'mercury',
])
export const deliveryBand = pgEnum('delivery_band', [
  'same_town',
  'same_province',
  'other_province',
])
export const offerStatus = pgEnum('offer_status', [
  'pending',
  'accepted',
  'declined',
  'expired',
  'withdrawn',
  'purchased',
])
export const offerParty = pgEnum('offer_party', ['buyer', 'seller'])
export const paymentMethod = pgEnum('payment_method', ['mobile_money', 'card'])
export const paymentStatus = pgEnum('payment_status', [
  'pending',
  'successful',
  'failed',
])
export const momoOperator = pgEnum('momo_operator', ['mtn', 'airtel', 'zamtel'])
export const payoutStatus = pgEnum('payout_status', [
  'held',
  'released',
  'processing',
  'paid',
  'failed',
  // Dispute resolved in the buyer's favour; nothing is paid to the seller.
  'refunded',
])
export const payoutMethod = pgEnum('payout_method', [
  'mobile_money',
  'bank_account',
])
export const authorTier = pgEnum('author_tier', ['copper', 'emerald', 'gold'])
export const verificationStatus = pgEnum('verification_status', [
  'pending',
  'approved',
  'rejected',
  'needs_more',
])

// id = auth.users.id (Supabase Auth). Kept in public so app queries never touch the auth schema.
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  phone: text('phone'),
  town: text('town'),
  province: text('province'),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}).enableRLS()

export const sellers = pgTable(
  'sellers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    storeName: text('store_name').notNull(),
    kind: sellerKind('kind').notNull().default('individual'),
    bio: text('bio'),
    // Portrait or logo, public in the covers bucket. Null shows a fallback.
    photoUrl: text('photo_url'),
    phone: text('phone').notNull(),
    town: text('town').notNull(),
    province: text('province').notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    payoutMethod: payoutMethod('payout_method'),
    payoutPhone: text('payout_phone'),
    payoutOperator: momoOperator('payout_operator'),
    payoutBankId: text('payout_bank_id'),
    payoutAccountNumber: text('payout_account_number'),
    payoutAccountName: text('payout_account_name'),
    lencoRecipientId: text('lenco_recipient_id'),
    // Methods this seller uses; fees come from delivery_rates and can't be raised by the seller.
    deliveryMethods: shippingMethod('delivery_methods')
      .array()
      .notNull()
      .default(sql`'{yango,platinum,mercury,bus_parcel,collect}'`),
    // Orders at or above this subtotal ship free (the seller covers it). Null: never.
    freeDeliveryOverNgwee: integer('free_delivery_over_ngwee'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('sellers_profile_id_key').on(t.profileId),
    uniqueIndex('sellers_slug_key').on(t.slug),
  ],
).enableRLS()

// An author's proof of identity, reviewed by an admin. Documents live in the private bucket and are deleted once decided.
export const verificationRequests = pgTable(
  'verification_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => authors.id, {
      onDelete: 'set null',
    }),
    legalName: text('legal_name').notNull(),
    documents: jsonb('documents')
      .$type<{ type: 'id' | 'selfie' | 'extra'; key: string }[]>()
      .notNull()
      .default([]),
    status: verificationStatus('status').notNull().default('pending'),
    // Shown to the author when more is needed or the request is turned down.
    note: text('note'),
    reviewerId: uuid('reviewer_id').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('verification_requests_seller_idx').on(t.sellerId),
    index('verification_requests_status_idx').on(t.status),
  ],
).enableRLS()

// The platform price list, edited in admin. A missing row means the method isn't offered for that band.
export const deliveryRates = pgTable(
  'delivery_rates',
  {
    method: shippingMethod('method').notNull(),
    band: deliveryBand('band').notNull(),
    feeNgwee: integer('fee_ngwee').notNull(),
    extraItemNgwee: integer('extra_item_ngwee').notNull().default(0),
    etaMinDays: integer('eta_min_days').notNull(),
    etaMaxDays: integer('eta_max_days').notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.method, t.band] })],
).enableRLS()

export const authors = pgTable(
  'authors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    bio: text('bio'),
    photoUrl: text('photo_url'),
    // The author's own website and social profiles, edited once verified.
    links: jsonb('links').$type<AuthorLinks>().notNull().default({}),
    isZambian: boolean('is_zambian').notNull().default(false),
    // Set when a seller of kind 'author' has been verified as this author.
    verifiedSellerId: uuid('verified_seller_id').references(() => sellers.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('authors_slug_key').on(t.slug)],
).enableRLS()

export interface AuthorLinks {
  website?: string
  facebook?: string
  instagram?: string
  x?: string
  tiktok?: string
}

// Plaques, kept once earned: the date an author first reached each tier.
export const authorMilestones = pgTable(
  'author_milestones',
  {
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.id, { onDelete: 'cascade' }),
    tier: authorTier('tier').notNull(),
    // Distinct readers at the moment the tier was reached.
    readers: integer('readers').notNull(),
    reachedAt: timestamp('reached_at', { withTimezone: true }).notNull().defaultNow(),
    // When the author first saw it on their account, for the one-time celebration.
    seenAt: timestamp('seen_at', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.authorId, t.tier] })],
).enableRLS()

export interface DraftBook {
  title: string
  year: number | null
  publisher: string | null
  isbn: string | null
}

export interface DraftContact {
  email?: string
  emailSource?: string
  phone?: string
  phoneSource?: string
}

/**
 * An author page Kuwala researched before the author joined. Admin-only: the sources, contact details and
 * invite never reach the public page. Publishing creates (or fills) the authors row; the author then claims it.
 */
export const authorDrafts = pgTable(
  'author_drafts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Set once published.
    authorId: uuid('author_id').references(() => authors.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isZambian: boolean('is_zambian').notNull().default(true),
    bio: text('bio').notNull().default(''),
    links: jsonb('links').$type<AuthorLinks>().notNull().default({}),
    books: jsonb('books').$type<DraftBook[]>().notNull().default([]),
    sources: jsonb('sources').$type<{ url: string; title: string }[]>().notNull().default([]),
    contact: jsonb('contact').$type<DraftContact>().notNull().default({}),
    invite: jsonb('invite').$type<{ subject: string; body: string; whatsapp: string }>(),
    // Only the hash is kept; the link in the invite carries the token.
    inviteTokenHash: text('invite_token_hash'),
    invitedAt: timestamp('invited_at', { withTimezone: true }),
    optedOutAt: timestamp('opted_out_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('author_drafts_author_key').on(t.authorId), uniqueIndex('author_drafts_token_key').on(t.inviteTokenHash)],
).enableRLS()

export const publishers = pgTable(
  'publishers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    bio: text('bio'),
    website: text('website'),
    isZambian: boolean('is_zambian').notNull().default(false),
    // Set when a seller of kind 'publisher' has been verified as this publisher.
    verifiedSellerId: uuid('verified_seller_id').references(() => sellers.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('publishers_slug_key').on(t.slug)],
).enableRLS()

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('categories_slug_key').on(t.slug)],
).enableRLS()

export const books = pgTable(
  'books',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    isbn13: text('isbn13'),
    isbn10: text('isbn10'),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    description: text('description'),
    // One or two sentences condensed from the description, shown beside the price.
    summary: text('summary'),
    coverUrl: text('cover_url'),
    // Set once the cron has copied the best cover it could find into R2 (or found none).
    coverCheckedAt: timestamp('cover_checked_at', { withTimezone: true }),
    // Display name as printed on the book; publisherId links it to the publisher's page.
    publisher: text('publisher'),
    publisherId: uuid('publisher_id').references(() => publishers.id, {
      onDelete: 'set null',
    }),
    publishedYear: integer('published_year'),
    pageCount: integer('page_count'),
    // ISO 639 code, or a local-language code such as 'bem', 'nya', 'toi', 'loz', 'kqn', 'lun', 'lue'.
    language: text('language').notNull().default('en'),
    categoryId: uuid('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
    // Denormalised from authors.is_zambian so shelves and ranking stay cheap.
    isZambian: boolean('is_zambian').notNull().default(false),
    source: bookSource('source').notNull(),
    // Title, subtitle, author names and ISBNs, maintained by the app on write.
    searchText: text('search_text').notNull().default(''),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(search_text, ''))`,
    ),
    createdBy: uuid('created_by').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('books_slug_key').on(t.slug),
    uniqueIndex('books_isbn13_key').on(t.isbn13),
    index('books_category_idx').on(t.categoryId),
    index('books_publisher_idx').on(t.publisherId),
    index('books_search_idx').using('gin', t.searchVector),
  ],
).enableRLS()

export const bookAuthors = pgTable(
  'book_authors',
  {
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => authors.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.bookId, t.authorId] }),
    index('book_authors_author_idx').on(t.authorId),
  ],
).enableRLS()

export const listings = pgTable(
  'listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'cascade' }),
    format: bookFormat('format').notNull().default('paperback'),
    condition: bookCondition('condition').notNull(),
    priceNgwee: integer('price_ngwee').notNull(),
    quantity: integer('quantity').notNull().default(1),
    notes: text('notes'),
    status: listingStatus('status').notNull().default('active'),
    acceptsOffers: boolean('accepts_offers').notNull().default(false),
    // Offers below this are declined automatically. Never shown to buyers.
    offerFloorNgwee: integer('offer_floor_ngwee'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('listings_book_idx').on(t.bookId, t.status),
    index('listings_seller_idx').on(t.sellerId),
  ],
).enableRLS()

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: text('number').notNull(),
    buyerId: uuid('buyer_id')
      .notNull()
      .references(() => profiles.id),
    status: orderStatus('status').notNull().default('pending_payment'),
    subtotalNgwee: integer('subtotal_ngwee').notNull(),
    shippingNgwee: integer('shipping_ngwee').notNull(),
    totalNgwee: integer('total_ngwee').notNull(),
    shipName: text('ship_name').notNull(),
    shipPhone: text('ship_phone').notNull(),
    shipAddress: text('ship_address').notNull(),
    shipTown: text('ship_town').notNull(),
    shipProvince: text('ship_province').notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('orders_number_key').on(t.number),
    index('orders_buyer_idx').on(t.buyerId),
  ],
).enableRLS()

// One per seller in an order: each seller ships, gets paid and is held in escrow separately.
export const sellerOrders = pgTable(
  'seller_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id),
    status: sellerOrderStatus('status').notNull().default('awaiting_payment'),
    shippingMethod: shippingMethod('shipping_method').notNull(),
    subtotalNgwee: integer('subtotal_ngwee').notNull(),
    shippingNgwee: integer('shipping_ngwee').notNull(),
    commissionNgwee: integer('commission_ngwee').notNull(),
    payoutNgwee: integer('payout_ngwee').notNull(),
    trackingNote: text('tracking_note'),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    // Escrow auto-releases at this time if the buyer has not confirmed or disputed.
    autoReleaseAt: timestamp('auto_release_at', { withTimezone: true }),
    disputeNote: text('dispute_note'),
    disputedAt: timestamp('disputed_at', { withTimezone: true }),
    // Set by an admin when a dispute is closed, either way.
    resolutionNote: text('resolution_note'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    payoutStatus: payoutStatus('payout_status').notNull().default('held'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('seller_orders_order_idx').on(t.orderId),
    index('seller_orders_seller_idx').on(t.sellerId, t.status),
  ],
).enableRLS()

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sellerOrderId: uuid('seller_order_id')
      .notNull()
      .references(() => sellerOrders.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id').references(() => listings.id, {
      onDelete: 'set null',
    }),
    bookId: uuid('book_id').references(() => books.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    condition: bookCondition('condition').notNull(),
    format: bookFormat('format').notNull(),
    unitPriceNgwee: integer('unit_price_ngwee').notNull(),
    quantity: integer('quantity').notNull(),
    // Set when this copy was bought at an accepted offer's price.
    offerId: uuid('offer_id').references(() => offers.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [index('order_items_seller_order_idx').on(t.sellerOrderId)],
).enableRLS()

// One copy, haggled over. Pending: `turn` has until expiresAt to accept, decline or counter
// (one counter each, so counters runs 0..2 and the seller's answer after the buyer's counter is final).
// Accepted: the copy is held for the buyer at agreedNgwee until expiresAt.
export const offers = pgTable(
  'offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    buyerId: uuid('buyer_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id, { onDelete: 'cascade' }),
    // The buyer's latest offer and the seller's latest counter.
    amountNgwee: integer('amount_ngwee').notNull(),
    counterNgwee: integer('counter_ngwee'),
    agreedNgwee: integer('agreed_ngwee'),
    message: text('message'),
    status: offerStatus('status').notNull().default('pending'),
    turn: offerParty('turn').notNull().default('seller'),
    counters: integer('counters').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('offers_open_key')
      .on(t.listingId, t.buyerId)
      .where(sql`status in ('pending', 'accepted')`),
    index('offers_seller_idx').on(t.sellerId, t.status),
    index('offers_buyer_idx').on(t.buyerId, t.status),
    index('offers_expiry_idx').on(t.status, t.expiresAt),
  ],
).enableRLS()

// Each attempt to pay gets its own reference, so a failed prompt can be retried.
// One rating each way per parcel, given after delivery: the buyer rates the shop, the shop rates the buyer.
// Blind: neither counts until both have rated or the window to answer has passed.
export const ratings = pgTable(
  'ratings',
  {
    sellerOrderId: uuid('seller_order_id')
      .notNull()
      .references(() => sellerOrders.id, { onDelete: 'cascade' }),
    // Who gave it.
    rater: offerParty('rater').notNull(),
    score: integer('score').notNull(),
    tags: text('tags').array().notNull().default(sql`'{}'`),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.sellerOrderId, t.rater] }), check('ratings_score_range', sql`${t.score} between 1 and 5`)],
).enableRLS()

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    reference: text('reference').notNull(),
    method: paymentMethod('method').notNull(),
    operator: momoOperator('operator'),
    phone: text('phone'),
    amountNgwee: integer('amount_ngwee').notNull(),
    status: paymentStatus('status').notNull().default('pending'),
    lencoReference: text('lenco_reference'),
    failureReason: text('failure_reason'),
    raw: jsonb('raw'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('payments_reference_key').on(t.reference),
    index('payments_order_idx').on(t.orderId),
  ],
).enableRLS()

export const payouts = pgTable(
  'payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sellerOrderId: uuid('seller_order_id')
      .notNull()
      .references(() => sellerOrders.id),
    sellerId: uuid('seller_id')
      .notNull()
      .references(() => sellers.id),
    amountNgwee: integer('amount_ngwee').notNull(),
    reference: text('reference').notNull(),
    status: payoutStatus('status').notNull().default('processing'),
    lencoReference: text('lenco_reference'),
    failureReason: text('failure_reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('payouts_reference_key').on(t.reference),
    index('payouts_seller_order_idx').on(t.sellerOrderId),
  ],
).enableRLS()

// The weekly Zambia Top 20, frozen each Monday so ranks can be compared week to week.
// Only books with enough distinct buyers are stored; the public chart needs a full set.
export const chartEntries = pgTable(
  'chart_entries',
  {
    week: date('week').notNull(),
    rank: integer('rank').notNull(),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    buyers: integer('buyers').notNull(),
    score: numeric('score', { precision: 8, scale: 3 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.week, t.rank] }),
    uniqueIndex('chart_entries_week_book_key').on(t.week, t.bookId),
  ],
).enableRLS()

export const fxRates = pgTable(
  'fx_rates',
  {
    day: date('day').notNull(),
    zmwPerUsd: numeric('zmw_per_usd', { precision: 12, scale: 4 }).notNull(),
    source: text('source').notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.day] })],
).enableRLS()

// Every call to Claude: daily limits per person, and what AI costs to run.
export const aiRequests = pgTable(
  'ai_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Null for the platform's own jobs (cron).
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    kind: text('kind').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    ok: boolean('ok').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('ai_requests_user_kind_idx').on(t.userId, t.kind, t.createdAt)],
).enableRLS()
