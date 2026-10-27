import { and, eq } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { books, listingReports, orderItems, orders, ratings, reviews, sellerOrders, sellers } from '#/db/schema'
import { REPORT_REASONS } from '#/data/listing-options'
import { RATING_WINDOW_DAYS, READER_TAGS, SHOP_TAGS } from '#/data/reputation'
import type { RateParcelInput, ReportListingInput, WriteReviewInput } from '#/schemas/feedback'
import { AppError } from './errors.server'

/** Only readers who received the book can review it; writing again replaces their review. */
export async function writeBookReview(db: Db, profileId: string, input: WriteReviewInput) {
  const [received] = await db
    .select({ sellerOrderId: sellerOrders.id })
    .from(orderItems)
    .innerJoin(sellerOrders, eq(sellerOrders.id, orderItems.sellerOrderId))
    .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
    .where(and(eq(orderItems.bookId, input.bookId), eq(orders.buyerId, profileId), eq(sellerOrders.status, 'delivered')))
    .limit(1)
  if (!received) throw new AppError('You can review a book once you’ve received it')
  const values = { score: input.score, body: input.body || null }
  await db
    .insert(reviews)
    .values({ bookId: input.bookId, profileId, sellerOrderId: received.sellerOrderId, ...values })
    .onConflictDoUpdate({ target: [reviews.bookId, reviews.profileId], set: values })
  const [book] = await db.select({ slug: books.slug, title: books.title }).from(books).where(eq(books.id, input.bookId)).limit(1)
  return { slug: book.slug, title: book.title }
}

/** The buyer rates the shop, or the shop rates the buyer, once a parcel has been delivered. */
export async function rateSellerOrder(db: Db, profileId: string, input: RateParcelInput) {
  const [part] = await db
    .select({ status: sellerOrders.status, deliveredAt: sellerOrders.deliveredAt, buyerId: orders.buyerId, sellerProfileId: sellers.profileId })
    .from(sellerOrders)
    .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
    .innerJoin(sellers, eq(sellers.id, sellerOrders.sellerId))
    .where(eq(sellerOrders.id, input.sellerOrderId))
    .limit(1)
  const rater = part?.buyerId === profileId ? 'buyer' : part?.sellerProfileId === profileId ? 'seller' : null
  if (!part || !rater) throw new AppError('Not your order', 'forbidden')
  if (part.status !== 'delivered' || !part.deliveredAt) throw new AppError('You can rate once the books have arrived')
  if (Date.now() - part.deliveredAt.getTime() > RATING_WINDOW_DAYS * 86_400_000) throw new AppError('Ratings close a month after delivery')
  const allowed: readonly string[] = rater === 'buyer' ? SHOP_TAGS : READER_TAGS
  const tags = [...new Set(input.tags)].filter((t) => allowed.includes(t))
  const [saved] = await db.insert(ratings).values({ sellerOrderId: input.sellerOrderId, rater, score: input.score, tags }).onConflictDoNothing().returning({ score: ratings.score })
  if (!saved) throw new AppError('You’ve already rated this', 'conflict')
  return { ok: true }
}

/** A reader flags a copy. One report per person per listing; reporting again just updates it. */
export async function fileListingReport(db: Db, reporterId: string, input: ReportListingInput) {
  const values = { reason: input.reason as (typeof REPORT_REASONS)[number]['value'], note: input.note || null, status: 'open' as const }
  await db
    .insert(listingReports)
    .values({ listingId: input.listingId, reporterId, ...values })
    .onConflictDoUpdate({ target: [listingReports.listingId, listingReports.reporterId], set: values })
  return { ok: true }
}
