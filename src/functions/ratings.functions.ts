import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import { orders, ratings, sellerOrders, sellers } from '#/db/schema'
import { RATING_WINDOW_DAYS, READER_TAGS, SHOP_TAGS } from '#/data/reputation'
import { requireUserMiddleware } from '#/server/auth'
import { readerStandings } from '#/server/reputation.server'

/** The buyer rates the shop, or the shop rates the buyer, once a parcel has been delivered. */
export const rateParcel = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(
    z.object({
      sellerOrderId: z.string().uuid(),
      score: z.number().int().min(1).max(5),
      tags: z.array(z.string().max(40)).max(4),
    }),
  )
  .handler(async ({ data, context }) => {
    const db = getDb()
    const [part] = await db
      .select({ status: sellerOrders.status, deliveredAt: sellerOrders.deliveredAt, buyerId: orders.buyerId, sellerProfileId: sellers.profileId })
      .from(sellerOrders)
      .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
      .innerJoin(sellers, eq(sellers.id, sellerOrders.sellerId))
      .where(eq(sellerOrders.id, data.sellerOrderId))
      .limit(1)
    const rater = part?.buyerId === context.user.id ? 'buyer' : part?.sellerProfileId === context.user.id ? 'seller' : null
    if (!part || !rater) throw new Error('Not your order')
    if (part.status !== 'delivered' || !part.deliveredAt) throw new Error('You can rate once the books have arrived')
    if (Date.now() - part.deliveredAt.getTime() > RATING_WINDOW_DAYS * 86_400_000) throw new Error('Ratings close a month after delivery')
    const allowed: readonly string[] = rater === 'buyer' ? SHOP_TAGS : READER_TAGS
    const tags = [...new Set(data.tags)].filter((t) => allowed.includes(t))
    const [saved] = await db.insert(ratings).values({ sellerOrderId: data.sellerOrderId, rater, score: data.score, tags }).onConflictDoNothing().returning({ score: ratings.score })
    if (!saved) throw new Error('You’ve already rated this')
    return { ok: true }
  })

/** The reader's own badge and standing, shown only to them. */
export const getMyStanding = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .handler(async ({ context }) => (await readerStandings(getDb(), [context.user.id])).get(context.user.id) ?? null)
