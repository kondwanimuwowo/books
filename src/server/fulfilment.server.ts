import { env } from 'cloudflare:workers'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { books, orderItems, orders, payments, payouts, profiles, ratings, refunds, reviews, sellerOrders, sellers } from '#/db/schema'
import { DISPUTE_COPY, DISPUTE_REPLY_HOURS, FULFILMENT_COPY, PROOF_REQUIRED } from '#/data/fulfilment'
import { NOTIFY_COPY } from '#/data/notifications'
import { formatMoney } from '#/lib/money'
import type { DisputeResponseInput, MarkShippedInput } from '#/schemas/orders'
import type { SessionUser } from './auth'
import { ownOrder } from './checkout.server'
import { escapeHtml, sendEmail, teamInbox } from './email.server'
import { AppError, NotFoundError } from './errors.server'
import { notify } from './notify.server'
import { autoReleaseDate, releaseToSeller } from './orders.server'
import { ownsPrivate } from './private-files.server'
import { readerStandings } from './reputation.server'

type Seller = typeof sellers.$inferSelect

export async function loadBuyerOrder(db: Db, buyerId: string, number: string) {
  const order = await ownOrder(db, number, buyerId)
  const parts = await db
    .select({
      so: sellerOrders,
      seller: { storeName: sellers.storeName, slug: sellers.slug, phone: sellers.phone, town: sellers.town },
      refund: { amountNgwee: refunds.amountNgwee, status: refunds.status, reason: refunds.reason, phone: refunds.phone, updatedAt: refunds.updatedAt },
    })
    .from(sellerOrders)
    .leftJoin(sellers, eq(sellers.id, sellerOrders.sellerId))
    .leftJoin(refunds, eq(refunds.sellerOrderId, sellerOrders.id))
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
        .where(and(eq(reviews.profileId, buyerId), inArray(reviews.bookId, items.flatMap((i) => (i.item.bookId ? [i.item.bookId] : [])))))
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
      seller: p.seller
        ? {
            ...p.seller,
            // Seller contact is only shared once the buyer has paid.
            phone: order.status === 'pending_payment' ? null : p.seller.phone,
          }
        : { storeName: FULFILMENT_COPY.closedShop, slug: null, phone: null, town: null },
      items: items
        .filter((i) => i.item.sellerOrderId === p.so.id)
        .map((i) => ({ ...i.item, slug: i.book?.slug ?? null, coverUrl: i.book?.coverUrl ?? null, myReview: reviewed.find((r) => r.bookId === i.item.bookId) ?? null })),
      // The buyer's rating of this shop, if they've given one.
      myRating: given.find((g) => g.sellerOrderId === p.so.id)?.score ?? null,
      // Only the last digits of the number it went back to, in case the page is screenshotted.
      refund: p.refund ? { ...p.refund, phone: p.refund.phone ? p.refund.phone.slice(-3) : null } : null,
    })),
  }
}

export async function listBuyerOrders(db: Db, buyerId: string) {
  return db
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
    .where(eq(orders.buyerId, buyerId))
    .orderBy(desc(orders.createdAt))
    .limit(100)
}

async function buyerPart(db: Db, sellerOrderId: string, buyerId: string) {
  const [row] = await db
    .select({ id: sellerOrders.id, status: sellerOrders.status })
    .from(sellerOrders)
    .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
    .where(and(eq(sellerOrders.id, sellerOrderId), eq(orders.buyerId, buyerId)))
    .limit(1)
  if (!row) throw new NotFoundError('Order not found')
  return row
}

export async function confirmBuyerDelivery(db: Db, buyerId: string, sellerOrderId: string) {
  const part = await buyerPart(db, sellerOrderId, buyerId)
  if (part.status !== 'shipped' && part.status !== 'to_ship') throw new AppError('This parcel can’t be confirmed right now')
  if (await releaseToSeller(db, part.id)) await notifyDelivered(db, part.id, false)
  return { ok: true }
}

/** Both sides hear a parcel is delivered: the buyer confirmed it, or (`auto`) the window to report a problem passed. */
export async function notifyDelivered(db: Db, sellerOrderId: string, auto: boolean) {
  const [part] = await db
    .select({ number: orders.number, buyerEmail: profiles.email, store: sellers.storeName, sellerProfileId: sellers.profileId, payoutNgwee: sellerOrders.payoutNgwee })
    .from(sellerOrders)
    .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
    .innerJoin(profiles, eq(profiles.id, orders.buyerId))
    .innerJoin(sellers, eq(sellers.id, sellerOrders.sellerId))
    .where(eq(sellerOrders.id, sellerOrderId))
    .limit(1)
  if (!part) return
  const [seller] = await db.select({ email: profiles.email }).from(profiles).where(eq(profiles.id, part.sellerProfileId)).limit(1)
  const buyerCopy = NOTIFY_COPY.deliveredBuyer
  const sellerCopy = NOTIFY_COPY.deliveredSeller
  await Promise.all([
    notify('orders', {
      to: part.buyerEmail,
      subject: buyerCopy.subject(part.number),
      lines: buyerCopy.lines(escapeHtml(part.store), auto),
      action: { label: buyerCopy.action, path: `/orders/${part.number}` },
    }),
    seller &&
      notify('selling', {
        to: seller.email,
        subject: sellerCopy.subject(part.number),
        lines: sellerCopy.lines(formatMoney(part.payoutNgwee), auto),
        action: { label: sellerCopy.action, path: '/account/sales' },
      }),
  ])
}

export async function reportBuyerProblem(db: Db, user: SessionUser, sellerOrderId: string, note: string) {
  const part = await buyerPart(db, sellerOrderId, user.id)
  if (part.status !== 'shipped' && part.status !== 'to_ship') throw new AppError('This parcel can’t be disputed right now')
  await db.update(sellerOrders).set({ status: 'disputed', autoReleaseAt: null, disputeNote: note, disputedAt: new Date() }).where(eq(sellerOrders.id, part.id))
  await sendEmail({
    to: teamInbox(),
    subject: 'A buyer reported a problem with an order',
    lines: [`Buyer ${escapeHtml(user.email)} reported a problem:`, escapeHtml(note), `Resolve it at ${env.APP_ORIGIN}/admin`],
  })
  // The seller hears straight away and has a window to give their side.
  const [seller] = await db
    .select({ email: profiles.email, number: orders.number })
    .from(sellerOrders)
    .innerJoin(sellers, eq(sellers.id, sellerOrders.sellerId))
    .innerJoin(profiles, eq(profiles.id, sellers.profileId))
    .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
    .where(eq(sellerOrders.id, part.id))
    .limit(1)
  if (seller) {
    await notify('selling', {
      to: seller.email,
      subject: DISPUTE_COPY.sellerSubject(seller.number),
      lines: DISPUTE_COPY.sellerLines(note, DISPUTE_REPLY_HOURS).map(escapeHtml),
      action: { label: 'Reply', path: '/account/sales' },
    })
  }
  return { ok: true }
}

/** The seller's side of a problem report: what happened, with a photo as proof. Can be updated until admin decides. */
export async function answerDispute(db: Db, seller: Seller, input: DisputeResponseInput) {
  if (input.proofKey && !(await ownsPrivate(input.proofKey, seller.profileId))) throw new AppError('The photo didn’t upload. Add it again.')
  // Sellers can edit their side until admin decides; the buyer and the team hear about the first one only.
  const [before] = await db
    .select({ respondedAt: sellerOrders.sellerRespondedAt, number: orders.number, buyerEmail: profiles.email })
    .from(sellerOrders)
    .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
    .innerJoin(profiles, eq(profiles.id, orders.buyerId))
    .where(and(eq(sellerOrders.id, input.sellerOrderId), eq(sellerOrders.sellerId, seller.id)))
    .limit(1)
  const [row] = await db
    .update(sellerOrders)
    .set({ sellerResponse: input.note, sellerResponseKey: input.proofKey ?? null, sellerRespondedAt: new Date() })
    .where(and(eq(sellerOrders.id, input.sellerOrderId), eq(sellerOrders.sellerId, seller.id), eq(sellerOrders.status, 'disputed')))
    .returning({ id: sellerOrders.id })
  if (!row) throw new AppError('This problem has already been decided', 'conflict')
  if (before && !before.respondedAt) {
    const copy = NOTIFY_COPY.disputeAnswered
    const team = NOTIFY_COPY.teamDisputeAnswered(before.number, escapeHtml(seller.storeName))
    await Promise.all([
      notify('orders', { to: before.buyerEmail, subject: copy.subject(before.number), lines: copy.lines(), action: { label: copy.action, path: `/orders/${before.number}` } }),
      sendEmail({ to: teamInbox(), subject: team.subject, lines: team.lines }),
    ])
  }
  return { ok: true }
}

export async function listSales(db: Db, sellerId: string) {
  const parts = await db
    .select({
      so: sellerOrders,
      order: {
        buyerId: orders.buyerId,
        number: orders.number,
        paidAt: orders.paidAt,
        createdAt: orders.createdAt,
        shipName: orders.shipName,
        shipPhone: orders.shipPhone,
        shipAddress: orders.shipAddress,
        shipTown: orders.shipTown,
        shipProvince: orders.shipProvince,
      },
      paidOutAt: payouts.updatedAt,
    })
    .from(sellerOrders)
    .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
    .leftJoin(payouts, eq(payouts.id, sellerOrders.payoutId))
    .where(and(eq(sellerOrders.sellerId, sellerId), inArray(sellerOrders.status, ['to_ship', 'shipped', 'delivered', 'disputed'])))
    .orderBy(desc(orders.createdAt))
    .limit(200)
  const ids = parts.map((p) => p.so.id)
  const [items, given, standings] = await Promise.all([
    ids.length ? db.select().from(orderItems).where(inArray(orderItems.sellerOrderId, ids)) : [],
    ids.length ? db.select({ sellerOrderId: ratings.sellerOrderId, score: ratings.score }).from(ratings).where(and(inArray(ratings.sellerOrderId, ids), eq(ratings.rater, 'seller'))) : [],
    readerStandings(db, parts.flatMap((p) => (p.order.buyerId ? [p.order.buyerId] : []))),
  ])
  return parts.map(({ so, paidOutAt, order: { buyerId, ...order } }) => ({
    ...so,
    paidOutAt: so.payoutStatus === 'paid' ? paidOutAt : null,
    order,
    items: items.filter((i) => i.sellerOrderId === so.id),
    myRating: given.find((g) => g.sellerOrderId === so.id)?.score ?? null,
    buyer: buyerId ? (standings.get(buyerId) ?? null) : null,
  }))
}

export async function shipSellerOrder(db: Db, seller: Seller, input: MarkShippedInput) {
  const [current] = await db.select({ method: sellerOrders.shippingMethod }).from(sellerOrders).where(eq(sellerOrders.id, input.sellerOrderId)).limit(1)
  // Couriers that give a receipt: its photo is what settles a "never arrived" claim.
  if (current && PROOF_REQUIRED.includes(current.method) && !input.proofKey) throw new AppError(FULFILMENT_COPY.proofRequired)
  if (input.proofKey && !(await ownsPrivate(input.proofKey, seller.profileId))) throw new AppError('The receipt photo didn’t upload. Add it again.')
  const [part] = await db
    .update(sellerOrders)
    .set({ status: 'shipped', shippedAt: new Date(), trackingNote: input.trackingNote, proofKey: input.proofKey ?? null, autoReleaseAt: autoReleaseDate(current?.method) })
    .where(and(eq(sellerOrders.id, input.sellerOrderId), eq(sellerOrders.sellerId, seller.id), eq(sellerOrders.status, 'to_ship')))
    .returning({ orderId: sellerOrders.orderId })
  if (!part) throw new AppError('This order isn’t waiting to be shipped')
  const [buyer] = await db
    .select({ email: profiles.email, number: orders.number })
    .from(orders)
    .innerJoin(profiles, eq(profiles.id, orders.buyerId))
    .where(eq(orders.id, part.orderId))
  await notify('orders', {
    to: buyer.email,
    subject: `${seller.storeName} has shipped part of ${buyer.number}`,
    lines: [`Delivery details from the seller: ${escapeHtml(input.trackingNote)}`, 'When the books arrive, confirm delivery so the seller gets paid.'],
    action: { label: 'Track your order', path: `/orders/${buyer.number}` },
  })
  return { ok: true }
}
