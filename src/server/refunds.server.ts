import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { listings, orderItems, orders, payments, profiles, refunds, sellerOrders, sellers } from '#/db/schema'
import { FULFILMENT_COPY, MAX_REFUND_ATTEMPTS, SHIP_REMINDER_DAYS, SHIP_WITHIN_DAYS } from '#/data/fulfilment'
import { formatMoney, ngweeToAmount } from '#/lib/money'
import { randomCode } from '#/lib/utils'
import { sendEmail } from './email.server'
import { createMobileMoneyRecipient, getTransferStatus, initiateMobileMoneyTransfer } from './lenco.server'
import { completeOrderIfSettled } from './orders.server'

const BATCH = 50
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000)

/**
 * Records the refund for a parcel and, if the buyer paid by mobile money, sends it straight back.
 * Card payments are left for admin to refund in the Lenco dashboard. One refund per parcel.
 */
export async function refundParcel(db: Db, sellerOrderId: string, reason: 'not_shipped' | 'dispute') {
  const [part] = await db
    .select({ amountNgwee: sql<number>`(${sellerOrders.subtotalNgwee} + ${sellerOrders.shippingNgwee})::int`, orderId: sellerOrders.orderId })
    .from(sellerOrders)
    .where(eq(sellerOrders.id, sellerOrderId))
    .limit(1)
  if (!part) return null
  const [payment] = await db
    .select({ method: payments.method, phone: payments.phone, operator: payments.operator })
    .from(payments)
    .where(and(eq(payments.orderId, part.orderId), eq(payments.status, 'successful')))
    .orderBy(desc(payments.createdAt))
    .limit(1)
  const automatic = payment?.method === 'mobile_money' && !!payment.phone && !!payment.operator
  const [refund] = await db
    .insert(refunds)
    .values({
      sellerOrderId,
      amountNgwee: part.amountNgwee,
      reason,
      status: automatic ? 'processing' : 'manual',
      reference: `rf-${sellerOrderId.slice(0, 8)}-${randomCode(6)}`,
      phone: automatic ? payment.phone : null,
      operator: automatic ? payment.operator : null,
    })
    .onConflictDoNothing()
    .returning({ id: refunds.id })
  if (refund && automatic) await sendRefund(db, refund.id)
  return { amountNgwee: part.amountNgwee, automatic }
}

/** One attempt at sending a refund to the payer's mobile money. Each attempt has its own reference. */
export async function sendRefund(db: Db, refundId: string) {
  const [refund] = await db.select().from(refunds).where(eq(refunds.id, refundId)).limit(1)
  if (!refund?.phone || !refund.operator) return
  const reference = refund.attempts ? `rf-${refund.sellerOrderId.slice(0, 8)}-${randomCode(6)}` : refund.reference
  await db
    .update(refunds)
    .set({ status: 'processing', reference, attempts: refund.attempts + 1 })
    .where(eq(refunds.id, refundId))
  try {
    const recipient = await createMobileMoneyRecipient(refund.phone, refund.operator)
    const transfer = await initiateMobileMoneyTransfer({ recipientId: recipient.id, amount: ngweeToAmount(refund.amountNgwee), reference, narration: 'Kuwala Books refund' })
    const status = transfer.status === 'successful' ? 'paid' : transfer.status === 'failed' ? 'failed' : 'processing'
    await db.update(refunds).set({ status, lencoReference: transfer.lencoReference, failureReason: transfer.reasonForFailure ?? null }).where(eq(refunds.id, refundId))
  } catch (error) {
    console.error('Refund failed', refundId, error)
    await db.update(refunds).set({ status: 'failed', failureReason: String(error) }).where(eq(refunds.id, refundId))
  }
}

/** Checks transfers Lenco accepted as pending, and retries failed refunds a few times before handing them to admin. */
export async function settleRefunds(db: Db) {
  const open = await db
    .select({ id: refunds.id, reference: refunds.reference })
    .from(refunds)
    .where(and(eq(refunds.status, 'processing'), lt(refunds.updatedAt, new Date(Date.now() - 5 * 60_000))))
    .limit(BATCH)
  for (const r of open) {
    const transfer = await getTransferStatus(r.reference).catch(() => null)
    if (!transfer || transfer.status === 'pending') continue
    await db
      .update(refunds)
      .set({ status: transfer.status === 'successful' ? 'paid' : 'failed', lencoReference: transfer.lencoReference, failureReason: transfer.reasonForFailure ?? null })
      .where(eq(refunds.id, r.id))
  }
  const failed = await db.select({ id: refunds.id, attempts: refunds.attempts }).from(refunds).where(eq(refunds.status, 'failed')).limit(BATCH)
  for (const r of failed) {
    if (r.attempts >= MAX_REFUND_ATTEMPTS) await db.update(refunds).set({ status: 'manual' }).where(eq(refunds.id, r.id))
    else await sendRefund(db, r.id)
  }
  return open.length + failed.length
}

/** Reminds sellers of paid parcels still not shipped after a few days. */
export async function remindToShip(db: Db) {
  const due = await db.execute<{ number: string; email: string; paid_at: Date }>(sql`
    update seller_orders so set ship_reminder_at = now()
    from orders o, sellers s, profiles p
    where o.id = so.order_id and s.id = so.seller_id and p.id = s.profile_id
      and so.status = 'to_ship' and so.ship_reminder_at is null
      and o.paid_at < now() - make_interval(days => ${SHIP_REMINDER_DAYS})
    returning o.number, p.email, o.paid_at`)
  for (const row of due) {
    const day = new Date(new Date(row.paid_at).getTime() + SHIP_WITHIN_DAYS * 86_400_000).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    await sendEmail({ to: row.email, subject: FULFILMENT_COPY.reminderSubject(row.number), lines: [...FULFILMENT_COPY.reminderLines(day)], action: { label: 'Your sales', path: '/account/sales' } })
  }
  return due.length
}

/** Paid parcels not shipped in time are cancelled and refunded in full; the listing is paused in case the seller is out of copies. */
export async function cancelUnshipped(db: Db) {
  const due = await db
    .select({ id: sellerOrders.id })
    .from(sellerOrders)
    .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
    .where(and(eq(sellerOrders.status, 'to_ship'), lt(orders.paidAt, daysAgo(SHIP_WITHIN_DAYS))))
    .limit(BATCH)
  let cancelled = 0
  for (const { id } of due) {
    const [part] = await db
      .update(sellerOrders)
      .set({ status: 'refunded', payoutStatus: 'refunded', resolvedAt: new Date(), resolutionNote: `Not shipped within ${SHIP_WITHIN_DAYS} days` })
      .where(and(eq(sellerOrders.id, id), eq(sellerOrders.status, 'to_ship')))
      .returning({ orderId: sellerOrders.orderId, sellerId: sellerOrders.sellerId })
    if (!part) continue
    cancelled++
    const items = await db.select({ listingId: orderItems.listingId }).from(orderItems).where(eq(orderItems.sellerOrderId, id))
    const listingIds = items.flatMap((i) => (i.listingId ? [i.listingId] : []))
    if (listingIds.length) await db.update(listings).set({ status: 'paused' }).where(and(inArray(listings.id, listingIds), eq(listings.status, 'active')))
    const refund = await refundParcel(db, id, 'not_shipped')
    await completeOrderIfSettled(db, part.orderId)

    const [who] = await db
      .select({ number: orders.number, buyerEmail: profiles.email, store: sellers.storeName, sellerProfileId: sellers.profileId })
      .from(orders)
      .innerJoin(profiles, eq(profiles.id, orders.buyerId))
      .innerJoin(sellers, eq(sellers.id, part.sellerId))
      .where(eq(orders.id, part.orderId))
      .limit(1)
    const [seller] = who ? await db.select({ email: profiles.email }).from(profiles).where(eq(profiles.id, who.sellerProfileId)).limit(1) : []
    if (who && refund) {
      await sendEmail({
        to: who.buyerEmail,
        subject: FULFILMENT_COPY.cancelledBuyerSubject(who.number),
        lines: [...FULFILMENT_COPY.cancelledBuyerLines(who.store, formatMoney(refund.amountNgwee), refund.automatic)],
        action: { label: 'Your order', path: `/orders/${who.number}` },
      })
    }
    if (who && seller) {
      await sendEmail({ to: seller.email, subject: FULFILMENT_COPY.cancelledSellerSubject(who.number), lines: [...FULFILMENT_COPY.cancelledSellerLines], action: { label: 'Your listings', path: '/account/listings' } })
    }
  }
  return cancelled
}
