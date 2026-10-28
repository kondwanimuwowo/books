import { and, eq, ne, sql } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { authors, bookAuthors, books, listingReports, listings, orderItems, orders, profiles, ratings, reviews, sellerOrders, sellers } from '#/db/schema'
import { REPORT_REASONS } from '#/data/listing-options'
import { RATING_WINDOW_DAYS, READER_TAGS, SHOP_TAGS } from '#/data/reputation'
import type { RateParcelInput, ReportListingInput, WriteReviewInput } from '#/schemas/feedback'
import { NOTIFY_COPY } from '#/data/notifications'
import { escapeHtml, sendEmail, teamInbox } from './email.server'
import { AppError } from './errors.server'
import { notify } from './notify.server'

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
  const [saved] = await db
    .insert(reviews)
    .values({ bookId: input.bookId, profileId, sellerOrderId: received.sellerOrderId, ...values })
    .onConflictDoUpdate({ target: [reviews.bookId, reviews.profileId], set: values })
    // xmax is 0 for a freshly inserted row: only a first review notifies, not an edit.
    .returning({ isNew: sql<boolean>`(xmax = 0)` })
  const [book] = await db.select({ slug: books.slug, title: books.title }).from(books).where(eq(books.id, input.bookId)).limit(1)
  if (saved?.isNew) await notifyAuthorsOfReview(db, input.bookId, profileId, book, values)
  return { slug: book.slug, title: book.title }
}

/** Verified authors of the book hear about each new review; reviews are public, so the score and words can go too. */
async function notifyAuthorsOfReview(db: Db, bookId: string, reviewerId: string, book: { slug: string; title: string }, review: { score: number; body: string | null }) {
  const writers = await db
    .select({ email: profiles.email })
    .from(bookAuthors)
    .innerJoin(authors, eq(authors.id, bookAuthors.authorId))
    .innerJoin(sellers, eq(sellers.id, authors.verifiedSellerId))
    .innerJoin(profiles, eq(profiles.id, sellers.profileId))
    .where(and(eq(bookAuthors.bookId, bookId), ne(profiles.id, reviewerId)))
  const copy = NOTIFY_COPY.reviewed
  const body = review.body ? escapeHtml(review.body.length > 280 ? `${review.body.slice(0, 277)}…` : review.body) : null
  await Promise.all(
    writers.map((w) =>
      notify('account', {
        to: w.email,
        subject: copy.subject(book.title),
        lines: copy.lines(escapeHtml(book.title), review.score, body),
        action: { label: copy.action, path: `/books/${book.slug}` },
      }),
    ),
  )
}

/** The buyer rates the shop, or the shop rates the buyer, once a parcel has been delivered. */
export async function rateSellerOrder(db: Db, profileId: string, input: RateParcelInput) {
  const [part] = await db
    .select({
      status: sellerOrders.status,
      deliveredAt: sellerOrders.deliveredAt,
      buyerId: orders.buyerId,
      sellerProfileId: sellers.profileId,
      number: orders.number,
      store: sellers.storeName,
    })
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
  // A buyer who has deleted their account can't hear about it.
  if (part.buyerId) await notifyRated(db, input.sellerOrderId, rater, input.score, { ...part, buyerId: part.buyerId })
  return { ok: true }
}

/**
 * The other side hears they've been rated. Ratings are blind, so the score is only sent once they've rated too;
 * until then the email invites them to rate back.
 */
async function notifyRated(
  db: Db,
  sellerOrderId: string,
  rater: 'buyer' | 'seller',
  score: number,
  part: { buyerId: string; sellerProfileId: string; number: string; store: string },
) {
  const ratedId = rater === 'buyer' ? part.sellerProfileId : part.buyerId
  const [rated] = await db.select({ email: profiles.email }).from(profiles).where(eq(profiles.id, ratedId)).limit(1)
  if (!rated) return
  const [theirs] = await db
    .select({ score: ratings.score })
    .from(ratings)
    .where(and(eq(ratings.sellerOrderId, sellerOrderId), eq(ratings.rater, rater === 'buyer' ? 'seller' : 'buyer')))
    .limit(1)
  const copy = NOTIFY_COPY.rated
  const who = rater === 'buyer' ? 'Your buyer' : escapeHtml(part.store)
  const ratePath = rater === 'buyer' ? '/account/sales' : `/orders/${part.number}`
  await notify(rater === 'buyer' ? 'selling' : 'orders', {
    to: rated.email,
    subject: copy.subject,
    lines: theirs ? copy.shown(who, score, part.number) : copy.hidden(who, part.number),
    action: theirs ? { label: copy.seeAction, path: ratePath } : { label: copy.rateAction, path: ratePath },
  })
}

/** A reader flags a copy. One report per person per listing; reporting again just updates it. */
export async function fileListingReport(db: Db, reporterId: string, input: ReportListingInput) {
  const values = { reason: input.reason as (typeof REPORT_REASONS)[number]['value'], note: input.note || null, status: 'open' as const }
  const [saved] = await db
    .insert(listingReports)
    .values({ listingId: input.listingId, reporterId, ...values })
    .onConflictDoUpdate({ target: [listingReports.listingId, listingReports.reporterId], set: values })
    .returning({ isNew: sql<boolean>`(xmax = 0)` })
  if (saved?.isNew) {
    const [listing] = await db.select({ title: books.title }).from(listings).innerJoin(books, eq(books.id, listings.bookId)).where(eq(listings.id, input.listingId)).limit(1)
    const reason = REPORT_REASONS.find((r) => r.value === values.reason)?.label ?? values.reason
    if (listing) {
      const team = NOTIFY_COPY.teamReport
      await sendEmail({
        to: teamInbox(),
        subject: team.subject(listing.title),
        lines: [...team.lines(escapeHtml(listing.title), reason), ...(values.note ? [escapeHtml(values.note)] : [])],
      })
    }
  }
  return { ok: true }
}
