import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { SHIPPING_METHODS } from '#/data/shipping'
import { getDb } from '#/db/client.server'
import { books, orderItems, orders, payments, profiles, ratings, reviews, sellerOrders, sellers } from '#/db/schema'
import { readerStandings } from '#/server/reputation.server'
import { PROVINCES } from '#/data/zambia'
import { normalizeLocalPhone } from '#/lib/phone'
import { ngweeToAmount } from '#/lib/money'
import { randomCode } from '#/lib/utils'
import { optionalUserMiddleware, requireSellerMiddleware, requireUserMiddleware } from '#/server/auth'
import { initiateMobileMoneyCollection } from '#/server/lenco.server'
import { autoReleaseDate, createOrder, loadCartListings, loadDeliveryRates, quoteCart, releaseToSeller, settlePayment } from '#/server/orders.server'
import { sendEmail } from '#/server/email.server'

const linesSchema = z
  .array(z.object({ listingId: z.string().uuid(), quantity: z.number().int().min(1).max(50) }))
  .max(50)

const placeSchema = z.object({ town: z.string().trim().min(2).max(60), province: z.enum(PROVINCES) })

export const quoteBag = createServerFn({ method: 'POST' })
  .middleware([optionalUserMiddleware])
  .validator(z.object({ lines: linesSchema, to: placeSchema.nullable() }))
  .handler(async ({ data, context }) => {
    const db = getDb()
    const [rows, rates] = await Promise.all([loadCartListings(db, data.lines, context.user?.id ?? null), data.to ? loadDeliveryRates(db) : []])
    const quote = quoteCart(rows, data.lines, data.to, rates, context.user?.id ?? null)
    return {
      problems: quote.problems,
      dropped: quote.dropped,
      groups: quote.groups.map((g) => ({
        seller: { id: g.seller.id, storeName: g.seller.storeName, town: g.seller.town, province: g.seller.province },
        itemCount: g.itemCount,
        subtotalNgwee: g.subtotalNgwee,
        options: g.options,
        items: g.items.map((i) => ({
          listingId: i.listing.id,
          quantity: i.quantity,
          available: i.available,
          priceNgwee: i.listing.priceNgwee,
          lineNgwee: i.lineNgwee,
          offerNgwee: i.offerNgwee,
          condition: i.listing.condition,
          format: i.listing.format,
          book: i.listing.book,
        })),
      })),
    }
  })

export const placeOrder = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(
    z.object({
      lines: linesSchema.min(1),
      shipTo: placeSchema.extend({
        name: z.string().trim().min(2).max(80),
        phone: z.string().transform((v, ctx) => normalizeLocalPhone(v) ?? (ctx.addIssue({ code: 'custom', message: 'Enter a Zambian mobile number' }), z.NEVER)),
        address: z.string().trim().min(3).max(300),
      }),
      methods: z.record(z.string(), z.enum(SHIPPING_METHODS)),
    }),
  )
  .handler(async ({ data, context }) => {
    const db = getDb()
    const order = await createOrder(db, context.user.id, data.lines, data.shipTo, data.methods)
    await db
      .update(profiles)
      .set({ phone: data.shipTo.phone, town: data.shipTo.town, province: data.shipTo.province })
      .where(eq(profiles.id, context.user.id))
    return { number: order.number }
  })

async function ownOrder(number: string, buyerId: string) {
  const [order] = await getDb()
    .select()
    .from(orders)
    .where(and(eq(orders.number, number), eq(orders.buyerId, buyerId)))
    .limit(1)
  if (!order) throw notFound()
  return order
}

export const getOrder = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .validator(z.object({ number: z.string().max(20) }))
  .handler(async ({ data, context }) => {
    const db = getDb()
    const order = await ownOrder(data.number, context.user.id)
    const parts = await db
      .select({ so: sellerOrders, seller: { storeName: sellers.storeName, slug: sellers.slug, phone: sellers.phone, town: sellers.town } })
      .from(sellerOrders)
      .innerJoin(sellers, eq(sellers.id, sellerOrders.sellerId))
      .where(eq(sellerOrders.orderId, order.id))
    const items = parts.length
      ? await db
          .select({ item: orderItems, book: { slug: books.slug, coverUrl: books.coverUrl } })
          .from(orderItems)
          .leftJoin(books, eq(books.id, orderItems.bookId))
          .where(inArray(orderItems.sellerOrderId, parts.map((p) => p.so.id)))
      : []
    const reviewed = items.length
      ? await db
          .select({ bookId: reviews.bookId, score: reviews.score, body: reviews.body })
          .from(reviews)
          .where(and(eq(reviews.profileId, context.user.id), inArray(reviews.bookId, items.flatMap((i) => (i.item.bookId ? [i.item.bookId] : [])))))
      : []
    const given = parts.length
      ? await db
          .select({ sellerOrderId: ratings.sellerOrderId, score: ratings.score })
          .from(ratings)
          .where(and(inArray(ratings.sellerOrderId, parts.map((p) => p.so.id)), eq(ratings.rater, 'buyer')))
      : []
    const [lastPayment] = await db
      .select({ reference: payments.reference, status: payments.status, method: payments.method, failureReason: payments.failureReason })
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .orderBy(desc(payments.createdAt))
      .limit(1)
    return {
      order,
      lastPayment: lastPayment ?? null,
      parts: parts.map((p) => ({
        ...p.so,
        seller: {
          ...p.seller,
          // Seller contact is only shared once the buyer has paid.
          phone: order.status === 'pending_payment' ? null : p.seller.phone,
        },
        items: items
          .filter((i) => i.item.sellerOrderId === p.so.id)
          .map((i) => ({ ...i.item, slug: i.book?.slug ?? null, coverUrl: i.book?.coverUrl ?? null, myReview: reviewed.find((r) => r.bookId === i.item.bookId) ?? null })),
        // The buyer's rating of this shop, if they've given one.
        myRating: given.find((g) => g.sellerOrderId === p.so.id)?.score ?? null,
      })),
    }
  })

export const getMyOrders = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .handler(async ({ context }) => {
    return getDb()
      .select({
        number: orders.number,
        status: orders.status,
        totalNgwee: orders.totalNgwee,
        createdAt: orders.createdAt,
        // Up to three covers so an order is recognisable by its books, not its number.
        books: sql<{ title: string; coverUrl: string | null }[]>`(
          select coalesce(json_agg(x), '[]') from (
            select oi.title, b.cover_url as "coverUrl"
            from ${orderItems} oi
            join ${sellerOrders} so on so.id = oi.seller_order_id
            left join ${books} b on b.id = oi.book_id
            where so.order_id = ${orders}.id
            order by oi.id limit 3
          ) x
        )`,
        itemCount: sql<number>`(select coalesce(sum(oi.quantity), 0)::int from ${orderItems} oi join ${sellerOrders} so on so.id = oi.seller_order_id where so.order_id = ${orders}.id)`,
      })
      .from(orders)
      .where(eq(orders.buyerId, context.user.id))
      .orderBy(desc(orders.createdAt))
      .limit(100)
  })

function newReference(orderNumber: string) {
  return `${orderNumber}-${randomCode(6)}`
}

export const startMobileMoneyPayment = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(
    z.object({
      number: z.string().max(20),
      phone: z.string().transform((v, ctx) => normalizeLocalPhone(v) ?? (ctx.addIssue({ code: 'custom', message: 'Enter a Zambian mobile number' }), z.NEVER)),
      operator: z.enum(['mtn', 'airtel', 'zamtel']),
    }),
  )
  .handler(async ({ data, context }) => {
    const order = await ownOrder(data.number, context.user.id)
    if (order.status !== 'pending_payment') throw new Error('This order has already been paid')
    const db = getDb()
    const reference = newReference(order.number)
    await db.insert(payments).values({ orderId: order.id, reference, method: 'mobile_money', operator: data.operator, phone: data.phone, amountNgwee: order.totalNgwee })
    try {
      const collection = await initiateMobileMoneyCollection({
        amount: ngweeToAmount(order.totalNgwee),
        phone: data.phone,
        operator: data.operator,
        reference,
        email: context.user.email,
      })
      await db.update(payments).set({ lencoReference: collection.lencoReference }).where(eq(payments.reference, reference))
      if (collection.status === 'failed') {
        await db.update(payments).set({ status: 'failed', failureReason: collection.reasonForFailure }).where(eq(payments.reference, reference))
        return { reference, status: 'failed' as const, reason: collection.reasonForFailure }
      }
      return { reference, status: 'pending' as const, reason: null }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Could not reach the payment provider'
      await db.update(payments).set({ status: 'failed', failureReason: reason }).where(eq(payments.reference, reference))
      return { reference, status: 'failed' as const, reason }
    }
  })

// Cards go through Lenco's inline widget (direct card API needs PCI DSS); we only issue the reference.
export const startCardPayment = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(z.object({ number: z.string().max(20) }))
  .handler(async ({ data, context }) => {
    const order = await ownOrder(data.number, context.user.id)
    if (order.status !== 'pending_payment') throw new Error('This order has already been paid')
    const reference = newReference(order.number)
    await getDb().insert(payments).values({ orderId: order.id, reference, method: 'card', amountNgwee: order.totalNgwee })
    const [first, ...rest] = order.shipName.split(' ')
    return {
      reference,
      amount: Number(ngweeToAmount(order.totalNgwee)),
      email: context.user.email,
      firstName: first,
      lastName: rest.join(' ') || first,
      phone: order.shipPhone,
      publicKey: env.LENCO_PUBLIC_KEY,
      sandbox: env.LENCO_SANDBOX === 'true',
    }
  })

export const checkPayment = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(z.object({ reference: z.string().max(60) }))
  .handler(async ({ data, context }) => {
    const db = getDb()
    const [row] = await db
      .select({ id: payments.id })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(and(eq(payments.reference, data.reference), eq(orders.buyerId, context.user.id)))
      .limit(1)
    if (!row) throw notFound()
    return settlePayment(db, data.reference)
  })

async function buyerPart(sellerOrderId: string, buyerId: string) {
  const [row] = await getDb()
    .select({ id: sellerOrders.id, status: sellerOrders.status })
    .from(sellerOrders)
    .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
    .where(and(eq(sellerOrders.id, sellerOrderId), eq(orders.buyerId, buyerId)))
    .limit(1)
  if (!row) throw notFound()
  return row
}

export const confirmDelivered = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(z.object({ sellerOrderId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const part = await buyerPart(data.sellerOrderId, context.user.id)
    if (part.status !== 'shipped' && part.status !== 'to_ship') throw new Error('This parcel can’t be confirmed right now')
    await releaseToSeller(getDb(), part.id)
    return { ok: true }
  })

export const reportProblem = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(z.object({ sellerOrderId: z.string().uuid(), note: z.string().trim().min(10).max(1000) }))
  .handler(async ({ data, context }) => {
    const part = await buyerPart(data.sellerOrderId, context.user.id)
    if (part.status !== 'shipped' && part.status !== 'to_ship') throw new Error('This parcel can’t be disputed right now')
    await getDb()
      .update(sellerOrders)
      .set({ status: 'disputed', autoReleaseAt: null, disputeNote: data.note, disputedAt: new Date() })
      .where(eq(sellerOrders.id, part.id))
    await sendEmail({
      to: env.EMAIL_FROM.match(/<(.+)>/)?.[1] ?? env.EMAIL_FROM,
      subject: 'A buyer reported a problem with an order',
      lines: [`Buyer ${context.user.email} reported a problem:`, data.note, `Resolve it at ${env.APP_ORIGIN}/admin`],
    })
    return { ok: true }
  })

export const getMySales = createServerFn({ method: 'GET' })
  .middleware([requireSellerMiddleware])
  .handler(async ({ context }) => {
    const db = getDb()
    const parts = await db
      .select({
        so: sellerOrders,
        order: {
          buyerId: orders.buyerId,
          number: orders.number,
          createdAt: orders.createdAt,
          shipName: orders.shipName,
          shipPhone: orders.shipPhone,
          shipAddress: orders.shipAddress,
          shipTown: orders.shipTown,
          shipProvince: orders.shipProvince,
        },
      })
      .from(sellerOrders)
      .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
      .where(and(eq(sellerOrders.sellerId, context.seller.id), inArray(sellerOrders.status, ['to_ship', 'shipped', 'delivered', 'disputed'])))
      .orderBy(desc(orders.createdAt))
      .limit(200)
    const ids = parts.map((p) => p.so.id)
    const [items, given, standings] = await Promise.all([
      ids.length ? db.select().from(orderItems).where(inArray(orderItems.sellerOrderId, ids)) : [],
      ids.length ? db.select({ sellerOrderId: ratings.sellerOrderId, score: ratings.score }).from(ratings).where(and(inArray(ratings.sellerOrderId, ids), eq(ratings.rater, 'seller'))) : [],
      readerStandings(db, parts.map((p) => p.order.buyerId)),
    ])
    return parts.map(({ so, order: { buyerId, ...order } }) => ({
      ...so,
      order,
      items: items.filter((i) => i.sellerOrderId === so.id),
      myRating: given.find((g) => g.sellerOrderId === so.id)?.score ?? null,
      buyer: standings.get(buyerId) ?? null,
    }))
  })

export const markShipped = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(z.object({ sellerOrderId: z.string().uuid(), trackingNote: z.string().trim().min(3).max(300) }))
  .handler(async ({ data, context }) => {
    const db = getDb()
    const [part] = await db
      .update(sellerOrders)
      .set({ status: 'shipped', shippedAt: new Date(), trackingNote: data.trackingNote, autoReleaseAt: autoReleaseDate() })
      .where(and(eq(sellerOrders.id, data.sellerOrderId), eq(sellerOrders.sellerId, context.seller.id), eq(sellerOrders.status, 'to_ship')))
      .returning({ orderId: sellerOrders.orderId })
    if (!part) throw new Error('This order isn’t waiting to be shipped')
    const [buyer] = await db
      .select({ email: profiles.email, number: orders.number })
      .from(orders)
      .innerJoin(profiles, eq(profiles.id, orders.buyerId))
      .where(eq(orders.id, part.orderId))
    await sendEmail({
      to: buyer.email,
      subject: `${context.seller.storeName} has shipped part of ${buyer.number}`,
      lines: [`Delivery details from the seller: ${data.trackingNote}`, 'When the books arrive, confirm delivery so the seller gets paid.'],
      action: { label: 'Track your order', path: `/orders/${buyer.number}` },
    })
    return { ok: true }
  })

export const getCheckoutDefaults = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .handler(async ({ context }) => {
    const [profile] = await getDb()
      .select({ name: profiles.displayName, phone: profiles.phone, town: profiles.town, province: profiles.province })
      .from(profiles)
      .where(eq(profiles.id, context.user.id))
      .limit(1)
    return profile ?? { name: '', phone: null, town: null, province: null }
  })
