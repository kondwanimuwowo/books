import { env } from 'cloudflare:workers'
import { and, eq } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { CARD_PAYMENTS } from '#/data/payments'
import { orders, payments, profiles } from '#/db/schema'
import { ngweeToAmount } from '#/lib/money'
import { randomCode } from '#/lib/utils'
import type { MobileMoneyInput, PlaceOrderInput, QuoteBagInput } from '#/schemas/orders'
import type { SessionUser } from './auth'
import { AppError, NotFoundError } from './errors.server'
import { initiateMobileMoneyCollection } from './lenco.server'
import { createOrder, loadCartListings, loadDeliveryRates, quoteCart, settlePayment } from './orders.server'

export async function quoteBagFor(db: Db, buyerId: string | null, input: QuoteBagInput) {
  const [rows, rates] = await Promise.all([loadCartListings(db, input.lines, buyerId), input.to ? loadDeliveryRates(db) : []])
  const quote = quoteCart(rows, input.lines, input.to, rates, buyerId)
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
}

export async function placeBuyerOrder(db: Db, buyerId: string, input: PlaceOrderInput) {
  // An address only matters if something is being delivered; pickups need just a name and number.
  const allPickup = Object.values(input.methods).length > 0 && Object.values(input.methods).every((m) => m === 'collect')
  if (!allPickup && input.shipTo.address.length < 3) throw new AppError('Add your address or a landmark')
  const shipTo = { ...input.shipTo, address: input.shipTo.address || 'Pickup from seller' }
  const order = await createOrder(db, buyerId, input.lines, shipTo, input.methods)
  await db
    .update(profiles)
    .set({ phone: input.shipTo.phone, town: input.shipTo.town, province: input.shipTo.province })
    .where(eq(profiles.id, buyerId))
  return { number: order.number }
}

/** The buyer's own order by number; anyone else's reads as missing. */
export async function ownOrder(db: Db, number: string, buyerId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.number, number), eq(orders.buyerId, buyerId)))
    .limit(1)
  if (!order) throw new NotFoundError('Order not found')
  return order
}

function newReference(orderNumber: string) {
  return `${orderNumber}-${randomCode(6)}`
}

export async function startMobileMoney(db: Db, user: SessionUser, input: MobileMoneyInput) {
  const order = await ownOrder(db, input.number, user.id)
  if (order.status !== 'pending_payment') throw new AppError('This order has already been paid', 'conflict')
  const reference = newReference(order.number)
  await db.insert(payments).values({ orderId: order.id, reference, method: 'mobile_money', operator: input.operator, phone: input.phone, amountNgwee: order.totalNgwee })
  try {
    const collection = await initiateMobileMoneyCollection({
      amount: ngweeToAmount(order.totalNgwee),
      phone: input.phone,
      operator: input.operator,
      reference,
      email: user.email,
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
}

// Cards go through Lenco's inline widget (direct card API needs PCI DSS); we only issue the reference.
export async function startCard(db: Db, user: SessionUser, number: string) {
  if (!CARD_PAYMENTS) throw new AppError('Card payments are paused. Pay with mobile money.', 'forbidden')
  const order = await ownOrder(db, number, user.id)
  if (order.status !== 'pending_payment') throw new AppError('This order has already been paid', 'conflict')
  const reference = newReference(order.number)
  await db.insert(payments).values({ orderId: order.id, reference, method: 'card', amountNgwee: order.totalNgwee })
  const [first, ...rest] = order.shipName.split(' ')
  return {
    reference,
    amount: Number(ngweeToAmount(order.totalNgwee)),
    email: user.email,
    firstName: first,
    lastName: rest.join(' ') || first,
    phone: order.shipPhone,
    publicKey: env.LENCO_PUBLIC_KEY,
    sandbox: env.LENCO_SANDBOX === 'true',
  }
}

export async function checkBuyerPayment(db: Db, buyerId: string, reference: string) {
  const [row] = await db
    .select({ id: payments.id })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(eq(payments.reference, reference), eq(orders.buyerId, buyerId)))
    .limit(1)
  if (!row) throw new NotFoundError('Payment not found')
  return settlePayment(db, reference)
}

export async function loadCheckoutDefaults(db: Db, buyerId: string) {
  const [profile] = await db
    .select({ name: profiles.displayName, phone: profiles.phone, town: profiles.town, province: profiles.province })
    .from(profiles)
    .where(eq(profiles.id, buyerId))
    .limit(1)
  return profile ?? { name: '', phone: null, town: null, province: null }
}
