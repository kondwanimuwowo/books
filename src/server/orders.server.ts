import { and, eq, inArray, sql } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { deliveryRates, listings, orderItems, orders, payments, payouts, profiles, sellerOrders, sellers, books } from '#/db/schema'
import { AUTO_RELEASE_DAYS, shippingOptions } from '#/data/shipping'
import type { DeliveryRate, ShippingMethod } from '#/data/shipping'
import { COMMISSION_RATE } from '#/data/listing-options'
import { formatMoney, ngweeToAmount } from '#/lib/money'
import { randomCode } from '#/lib/utils'
import { getCollectionStatus, initiateMobileMoneyTransfer, isPendingStatus } from './lenco.server'
import { sendEmail } from './email.server'

export interface CartLine {
  listingId: string
  quantity: number
}

export interface ShipTo {
  name: string
  phone: string
  address: string
  town: string
  province: string
}

export async function loadCartListings(db: Db, lines: CartLine[]) {
  const ids = [...new Set(lines.map((l) => l.listingId))]
  if (!ids.length) return []
  return db
    .select({
      id: listings.id,
      priceNgwee: listings.priceNgwee,
      quantity: listings.quantity,
      status: listings.status,
      condition: listings.condition,
      format: listings.format,
      book: { id: books.id, slug: books.slug, title: books.title, coverUrl: books.coverUrl },
      seller: {
        id: sellers.id,
        storeName: sellers.storeName,
        town: sellers.town,
        province: sellers.province,
        profileId: sellers.profileId,
        deliveryMethods: sellers.deliveryMethods,
        freeDeliveryOverNgwee: sellers.freeDeliveryOverNgwee,
      },
    })
    .from(listings)
    .innerJoin(books, eq(books.id, listings.bookId))
    .innerJoin(sellers, eq(sellers.id, listings.sellerId))
    .where(inArray(listings.id, ids))
}

export function loadDeliveryRates(db: Db): Promise<DeliveryRate[]> {
  return db
    .select({
      method: deliveryRates.method,
      band: deliveryRates.band,
      feeNgwee: deliveryRates.feeNgwee,
      extraItemNgwee: deliveryRates.extraItemNgwee,
      etaMinDays: deliveryRates.etaMinDays,
      etaMaxDays: deliveryRates.etaMaxDays,
    })
    .from(deliveryRates)
}

type CartListing = Awaited<ReturnType<typeof loadCartListings>>[number]

/** Groups cart lines by seller and prices shipping for the buyer's town. Shared by checkout preview and order creation. */
export function quoteCart(rows: CartListing[], lines: CartLine[], to: { town: string; province: string } | null, rates: DeliveryRate[]) {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const groups = new Map<string, { seller: CartListing['seller']; items: { listing: CartListing; quantity: number }[] }>()
  const problems: string[] = []

  for (const line of lines) {
    const listing = byId.get(line.listingId)
    if (!listing || listing.status !== 'active' || listing.quantity < 1) {
      problems.push(`${listing?.book.title ?? 'A book in your bag'} is no longer available`)
      continue
    }
    const quantity = Math.min(line.quantity, listing.quantity)
    if (quantity < line.quantity) problems.push(`Only ${listing.quantity} of ${listing.book.title} left`)
    const group = groups.get(listing.seller.id) ?? { seller: listing.seller, items: [] }
    group.items.push({ listing, quantity })
    groups.set(listing.seller.id, group)
  }

  return {
    problems,
    groups: [...groups.values()].map((g) => {
      const itemCount = g.items.reduce((n, i) => n + i.quantity, 0)
      const subtotalNgwee = g.items.reduce((n, i) => n + i.quantity * i.listing.priceNgwee, 0)
      const options = to ? shippingOptions(g.seller, to, rates, g.seller, { itemCount, subtotalNgwee }) : []
      if (to && !options.length) problems.push(`${g.seller.storeName} doesn’t deliver to ${to.town}`)
      return { seller: { id: g.seller.id, storeName: g.seller.storeName, town: g.seller.town, province: g.seller.province, profileId: g.seller.profileId }, items: g.items, itemCount, subtotalNgwee, options }
    }),
  }
}

export async function createOrder(db: Db, buyerId: string, lines: CartLine[], shipTo: ShipTo, methods: Record<string, ShippingMethod>) {
  const [rows, rates] = await Promise.all([loadCartListings(db, lines), loadDeliveryRates(db)])
  const quote = quoteCart(rows, lines, shipTo, rates)
  if (quote.problems.length) throw new Error(quote.problems.join('. '))
  if (!quote.groups.length) throw new Error('Your bag is empty')
  if (quote.groups.some((g) => g.seller.profileId === buyerId)) throw new Error('You can’t buy your own listing')

  const priced = quote.groups.map((g) => {
    const option = g.options.find((o) => o.method === methods[g.seller.id])
    if (!option) throw new Error(`Choose a delivery option for ${g.seller.storeName}`)
    const commissionNgwee = Math.round(g.subtotalNgwee * COMMISSION_RATE)
    return { ...g, option, commissionNgwee, payoutNgwee: g.subtotalNgwee - commissionNgwee + option.totalNgwee }
  })
  const subtotalNgwee = priced.reduce((n, g) => n + g.subtotalNgwee, 0)
  const shippingNgwee = priced.reduce((n, g) => n + g.option.totalNgwee, 0)

  return db.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        number: `KB-${randomCode(6, '23456789ABCDEFGHJKLMNPQRSTUVWXYZ')}`,
        buyerId,
        subtotalNgwee,
        shippingNgwee,
        totalNgwee: subtotalNgwee + shippingNgwee,
        shipName: shipTo.name,
        shipPhone: shipTo.phone,
        shipAddress: shipTo.address,
        shipTown: shipTo.town,
        shipProvince: shipTo.province,
      })
      .returning({ id: orders.id, number: orders.number })

    for (const g of priced) {
      const [sellerOrder] = await tx
        .insert(sellerOrders)
        .values({
          orderId: order.id,
          sellerId: g.seller.id,
          shippingMethod: g.option.method,
          subtotalNgwee: g.subtotalNgwee,
          shippingNgwee: g.option.totalNgwee,
          commissionNgwee: g.commissionNgwee,
          payoutNgwee: g.payoutNgwee,
        })
        .returning({ id: sellerOrders.id })
      await tx.insert(orderItems).values(
        g.items.map((i) => ({
          sellerOrderId: sellerOrder.id,
          listingId: i.listing.id,
          bookId: i.listing.book.id,
          title: i.listing.book.title,
          condition: i.listing.condition,
          format: i.listing.format,
          unitPriceNgwee: i.listing.priceNgwee,
          quantity: i.quantity,
        })),
      )
    }
    return order
  })
}

export type SettleResult = { status: 'pending' | 'successful' | 'failed'; reason?: string | null }

/**
 * The single place a payment becomes "paid". Called by the payment page poll and the Lenco webhook;
 * it always asks Lenco for the status itself and is safe to run more than once.
 */
export async function settlePayment(db: Db, reference: string): Promise<SettleResult> {
  const [payment] = await db.select().from(payments).where(eq(payments.reference, reference)).limit(1)
  if (!payment) throw new Error('Payment not found')
  if (payment.status !== 'pending') return { status: payment.status, reason: payment.failureReason }

  const collection = await getCollectionStatus(reference)
  if (isPendingStatus(collection.status)) return { status: 'pending' }

  if (collection.status !== 'successful') {
    await db
      .update(payments)
      .set({ status: 'failed', failureReason: collection.reasonForFailure, lencoReference: collection.lencoReference, raw: collection })
      .where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')))
    return { status: 'failed', reason: collection.reasonForFailure }
  }

  if (Number(collection.amount) * 100 < payment.amountNgwee || collection.currency !== 'ZMW') {
    console.error('Lenco amount/currency mismatch', reference, collection.amount, collection.currency)
    await db.update(payments).set({ status: 'failed', failureReason: 'Amount mismatch', raw: collection }).where(eq(payments.id, payment.id))
    return { status: 'failed', reason: 'Payment amount did not match the order' }
  }

  const newlyPaid = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(payments)
      .set({ status: 'successful', lencoReference: collection.lencoReference, raw: collection })
      .where(and(eq(payments.id, payment.id), eq(payments.status, 'pending')))
      .returning({ id: payments.id })
    if (!claimed) return false

    const [order] = await tx
      .update(orders)
      .set({ status: 'paid', paidAt: new Date() })
      .where(and(eq(orders.id, payment.orderId), eq(orders.status, 'pending_payment')))
      .returning({ id: orders.id })
    if (!order) return false

    await tx.update(sellerOrders).set({ status: 'to_ship' }).where(eq(sellerOrders.orderId, order.id))
    const items = await tx
      .select({ listingId: orderItems.listingId, quantity: orderItems.quantity })
      .from(orderItems)
      .innerJoin(sellerOrders, eq(sellerOrders.id, orderItems.sellerOrderId))
      .where(eq(sellerOrders.orderId, order.id))
    for (const item of items) {
      if (!item.listingId) continue
      await tx
        .update(listings)
        .set({
          quantity: sql`greatest(${listings.quantity} - ${item.quantity}, 0)`,
          status: sql`case when ${listings.quantity} - ${item.quantity} <= 0 then 'sold_out'::listing_status else ${listings.status} end`,
        })
        .where(eq(listings.id, item.listingId))
    }
    return true
  })

  if (newlyPaid) await sendPaidEmails(db, payment.orderId)
  return { status: 'successful' }
}

async function sendPaidEmails(db: Db, orderId: string) {
  const [order] = await db
    .select({ number: orders.number, totalNgwee: orders.totalNgwee, email: profiles.email, name: profiles.displayName })
    .from(orders)
    .innerJoin(profiles, eq(profiles.id, orders.buyerId))
    .where(eq(orders.id, orderId))
  const sellerRows = await db
    .select({ email: profiles.email, storeName: sellers.storeName, payoutNgwee: sellerOrders.payoutNgwee })
    .from(sellerOrders)
    .innerJoin(sellers, eq(sellers.id, sellerOrders.sellerId))
    .innerJoin(profiles, eq(profiles.id, sellers.profileId))
    .where(eq(sellerOrders.orderId, orderId))

  await Promise.all([
    sendEmail({
      to: order.email,
      subject: `Order ${order.number} confirmed`,
      lines: [
        `Hi ${order.name},`,
        `We have received your payment of ${formatMoney(order.totalNgwee)} for order ${order.number}.`,
        'Your money is held safely until you confirm the books have arrived. Each seller will ship their part and update you here.',
      ],
      action: { label: 'View your order', path: `/orders/${order.number}` },
    }),
    ...sellerRows.map((s) =>
      sendEmail({
        to: s.email,
        subject: `New order ${order.number}`,
        lines: [
          `Good news, ${s.storeName}: a buyer has paid for books from your shop.`,
          `Please ship within 3 days. You will receive ${formatMoney(s.payoutNgwee)} once the buyer confirms delivery.`,
        ],
        action: { label: 'See what to ship', path: '/account/sales' },
      }),
    ),
  ])
}

type SellerOrderStatus = (typeof sellerOrders.status.enumValues)[number]

/**
 * Escrow release: the seller's share becomes payable. Sends it straight away when payouts are configured.
 * Buyers confirm from shipped/to_ship; an admin closing a dispute in the seller's favour releases from disputed.
 */
export async function releaseToSeller(db: Db, sellerOrderId: string, from: SellerOrderStatus[] = ['shipped', 'to_ship']) {
  const [row] = await db
    .update(sellerOrders)
    .set({ status: 'delivered', deliveredAt: new Date(), payoutStatus: 'released' })
    .where(and(eq(sellerOrders.id, sellerOrderId), inArray(sellerOrders.status, from)))
    .returning({ orderId: sellerOrders.orderId })
  if (!row) return false

  await completeOrderIfSettled(db, row.orderId)
  await attemptPayout(db, sellerOrderId)
  return true
}

// An order is complete once none of its sellers' parts can still change hands.
export async function completeOrderIfSettled(db: Db, orderId: string) {
  const open = await db
    .select({ id: sellerOrders.id })
    .from(sellerOrders)
    .where(and(eq(sellerOrders.orderId, orderId), inArray(sellerOrders.status, ['awaiting_payment', 'to_ship', 'shipped', 'disputed'])))
    .limit(1)
  if (!open.length) await db.update(orders).set({ status: 'completed' }).where(eq(orders.id, orderId))
}

export async function attemptPayout(db: Db, sellerOrderId: string) {
  const [row] = await db
    .select({ so: sellerOrders, seller: sellers })
    .from(sellerOrders)
    .innerJoin(sellers, eq(sellers.id, sellerOrders.sellerId))
    .where(eq(sellerOrders.id, sellerOrderId))
  if (!row || row.so.payoutStatus !== 'released') return
  // Without a payout destination the money stays "released" until the seller adds one.
  if (!row.seller.lencoRecipientId || row.seller.payoutMethod !== 'mobile_money') return

  // One reference per attempt, so a failed payout can be retried.
  const reference = `po-${sellerOrderId.slice(0, 8)}-${randomCode(6)}`
  const [claimed] = await db
    .update(sellerOrders)
    .set({ payoutStatus: 'processing' })
    .where(and(eq(sellerOrders.id, sellerOrderId), eq(sellerOrders.payoutStatus, 'released')))
    .returning({ id: sellerOrders.id })
  if (!claimed) return

  await db.insert(payouts).values({ sellerOrderId, sellerId: row.seller.id, amountNgwee: row.so.payoutNgwee, reference, status: 'processing' })
  try {
    const transfer = await initiateMobileMoneyTransfer({
      recipientId: row.seller.lencoRecipientId,
      amount: ngweeToAmount(row.so.payoutNgwee),
      reference,
      narration: 'Kuwala Books sale',
    })
    const status = transfer.status === 'successful' ? 'paid' : transfer.status === 'failed' ? 'failed' : 'processing'
    await db.update(payouts).set({ status, lencoReference: transfer.lencoReference, failureReason: transfer.reasonForFailure ?? null }).where(eq(payouts.reference, reference))
    await db.update(sellerOrders).set({ payoutStatus: status }).where(eq(sellerOrders.id, sellerOrderId))
  } catch (error) {
    console.error('Payout failed', sellerOrderId, error)
    await db.update(payouts).set({ status: 'failed', failureReason: String(error) }).where(eq(payouts.reference, reference))
    await db.update(sellerOrders).set({ payoutStatus: 'failed' }).where(eq(sellerOrders.id, sellerOrderId))
  }
}

export function autoReleaseDate() {
  return new Date(Date.now() + AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1000)
}
