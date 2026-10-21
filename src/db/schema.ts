import { sql } from 'drizzle-orm'
import {
  boolean,
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
])
export const shippingMethod = pgEnum('shipping_method', [
  'courier',
  'bus_parcel',
  'zampost',
  'collect',
])
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
])
export const payoutMethod = pgEnum('payout_method', [
  'mobile_money',
  'bank_account',
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('sellers_profile_id_key').on(t.profileId),
    uniqueIndex('sellers_slug_key').on(t.slug),
  ],
).enableRLS()

export const authors = pgTable(
  'authors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    bio: text('bio'),
    photoUrl: text('photo_url'),
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
    coverUrl: text('cover_url'),
    publisher: text('publisher'),
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
  },
  (t) => [index('order_items_seller_order_idx').on(t.sellerOrderId)],
).enableRLS()

// Each attempt to pay gets its own reference, so a failed prompt can be retried.
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
