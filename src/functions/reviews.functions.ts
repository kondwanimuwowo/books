import { createServerFn } from '@tanstack/react-start'
import { desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import { books, profiles, reviews } from '#/db/schema'
import { requireAdminMiddleware, requireUserMiddleware } from '#/server/auth'
import { writeBookReview } from '#/server/feedback.server'
import { writeReviewSchema } from '#/schemas/feedback'

/** Only readers who received the book can review it; writing again replaces their review. */
export const writeReview = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(writeReviewSchema)
  .handler(({ data, context }) => writeBookReview(getDb(), context.user.id, data))

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
      .leftJoin(profiles, eq(profiles.id, reviews.profileId))
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
