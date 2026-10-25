import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import { books, orderItems, orders, profiles, reviews, sellerOrders } from '#/db/schema'
import { REVIEW_COPY, REVIEW_LIMITS } from '#/data/reputation'
import { containsLink, containsPhoneNumber } from '#/data/safety'
import { requireAdminMiddleware, requireUserMiddleware } from '#/server/auth'

const reviewBody = z
  .string()
  .trim()
  .max(REVIEW_LIMITS.body)
  .refine((b) => !containsPhoneNumber(b) && !containsLink(b), REVIEW_COPY.noContact)

/** Only readers who received the book can review it; writing again replaces their review. */
export const writeReview = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(z.object({ bookId: z.string().uuid(), score: z.number().int().min(1).max(5), body: reviewBody }))
  .handler(async ({ data, context }) => {
    const db = getDb()
    const [received] = await db
      .select({ sellerOrderId: sellerOrders.id })
      .from(orderItems)
      .innerJoin(sellerOrders, eq(sellerOrders.id, orderItems.sellerOrderId))
      .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
      .where(and(eq(orderItems.bookId, data.bookId), eq(orders.buyerId, context.user.id), eq(sellerOrders.status, 'delivered')))
      .limit(1)
    if (!received) throw new Error('You can review a book once you’ve received it')
    const values = { score: data.score, body: data.body || null }
    await db
      .insert(reviews)
      .values({ bookId: data.bookId, profileId: context.user.id, sellerOrderId: received.sellerOrderId, ...values })
      .onConflictDoUpdate({ target: [reviews.bookId, reviews.profileId], set: values })
    const [book] = await db.select({ slug: books.slug, title: books.title }).from(books).where(eq(books.id, data.bookId)).limit(1)
    return { slug: book.slug, title: book.title }
  })

export const listReviews = createServerFn({ method: 'GET' })
  .middleware([requireAdminMiddleware])
  .handler(async () => {
    return getDb()
      .select({
        id: reviews.id,
        score: reviews.score,
        body: reviews.body,
        hidden: sql<boolean>`${reviews.hiddenAt} is not null`,
        createdAt: reviews.createdAt,
        reviewer: profiles.displayName,
        book: { slug: books.slug, title: books.title },
      })
      .from(reviews)
      .innerJoin(profiles, eq(profiles.id, reviews.profileId))
      .innerJoin(books, eq(books.id, reviews.bookId))
      .orderBy(desc(reviews.createdAt))
      .limit(200)
  })

export const setReviewHidden = createServerFn({ method: 'POST' })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ id: z.string().uuid(), hidden: z.boolean() }))
  .handler(async ({ data }) => {
    await getDb()
      .update(reviews)
      .set({ hiddenAt: data.hidden ? new Date() : null })
      .where(eq(reviews.id, data.id))
    return { ok: true }
  })
