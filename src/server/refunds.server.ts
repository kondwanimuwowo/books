import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { listings, orderItems, orders, payments, profiles, refunds, sellerOrders, sellers } from '#/db/schema'
import { FULFILMENT_COPY, MAX_REFUND_ATTEMPTS, REFUND_COPY, SHIP_REMINDER_HOUR, SHIP_REMINDER_MIN_HOURS, SHIP_WITHIN_DAYS } from '#/data/fulfilment'
import { formatMoney, ngweeToAmount } from '#/lib/money'
import { randomCode } from '#/lib/utils'
import { NOTIFY_COPY } from '#/data/notifications'
import { escapeHtml } from './email.server'
import { notify } from './notify.server'
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
    if (status === 'paid') await notifyRefund(db, refundId, 'paid')
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
    const status = transfer.status === 'successful' ? 'paid' : 'failed'
    const [moved] = await db
      .update(refunds)
      .set({ status, lencoReference: transfer.lencoReference, failureReason: transfer.reasonForFailure ?? null })
      .where(and(eq(refunds.id, r.id), eq(refunds.status, 'processing')))
      .returning({ id: refunds.id })
    if (moved && status === 'paid') await notifyRefund(db, r.id, 'paid')
  }
  const failed = await db.select({ id: refunds.id, attempts: refunds.attempts }).from(refunds).where(eq(refunds.status, 'failed')).limit(BATCH)
  for (const r of failed) {
    if (r.attempts >= MAX_REFUND_ATTEMPTS) {
      const [moved] = await db.update(refunds).set({ status: 'manual' }).where(and(eq(refunds.id, r.id), eq(refunds.status, 'failed'))).returning({ id: refunds.id })
      if (moved) await notifyRefund(db, r.id, 'manual')
    } else await sendRefund(db, r.id)
  }
  return open.length + failed.length
}

/** Tells the buyer their refund reached them, or that automatic tries failed and the team is sending it. */
export async function notifyRefund(db: Db, refundId: string, outcome: 'paid' | 'manual' | 'done') {
  const [row] = await db
    .select({ amountNgwee: refunds.amountNgwee, phone: refunds.phone, number: orders.number, email: profiles.email })
    .from(refunds)
    .innerJoin(sellerOrders, eq(sellerOrders.id, refunds.sellerOrderId))
    .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
    .innerJoin(profiles, eq(profiles.id, orders.buyerId))
    .where(eq(refunds.id, refundId))
    .limit(1)
  if (!row) return
  const copy = NOTIFY_COPY.refund
  const amount = formatMoney(row.amountNgwee)
  await notify('orders', {
    to: row.email,
    subject: copy.subject(outcome, row.number),
    lines: copy.lines(outcome, amount, REFUND_COPY.number(row.phone?.slice(-3) ?? null)),
    action: { label: copy.action, path: `/orders/${row.number}` },
  })
}

const LUSAKA_OFFSET_HOURS = 2

/** Start of today in Lusaka, as a UTC instant. */
function lusakaToday(now = new Date()) {
  const local = new Date(now.getTime() + LUSAKA_OFFSET_HOURS * 3_600_000)
  return { start: new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - LUSAKA_OFFSET_HOURS * 3_600_000), hour: local.getUTCHours() }
}

/** One reminder per parcel each morning until it's shipped, counting down to the cancellation day. */
export async function remindToShip(db: Db) {
  const today = lusakaToday()
  if (today.hour < SHIP_REMINDER_HOUR) return 0
  const due = await db.execute<{ number: string; email: string; paid_at: Date }>(sql`
    update seller_orders so set ship_reminder_at = now()
    from orders o, sellers s, profiles p
    where o.id = so.order_id and s.id = so.seller_id and p.id = s.profile_id
      and so.status = 'to_ship'
      and (so.ship_reminder_at is null or so.ship_reminder_at < ${today.start.toISOString()}::timestamptz)
      and o.paid_at < now() - make_interval(hours => ${SHIP_REMINDER_MIN_HOURS})
      and o.paid_at > now() - make_interval(days => ${SHIP_WITHIN_DAYS})
    returning o.number, p.email, o.paid_at`)
  for (const row of due) {
    const deadline = new Date(new Date(row.paid_at).getTime() + SHIP_WITHIN_DAYS * 86_400_000)
    const daysLeft = Math.max(1, Math.ceil((deadline.getTime() - Date.now()) / 86_400_000))
    const day = deadline.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Lusaka' })
    await notify('selling', { to: row.email, subject: FULFILMENT_COPY.reminderSubject(row.number, daysLeft), lines: [...FULFILMENT_COPY.reminderLines(day, daysLeft)], action: { label: 'Your sales', path: '/account/sales' } })
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

    const [who] = part.sellerId
      ? await db
          .select({ number: orders.number, buyerEmail: profiles.email, store: sellers.storeName, sellerProfileId: sellers.profileId })
          .from(orders)
          .innerJoin(profiles, eq(profiles.id, orders.buyerId))
          .innerJoin(sellers, eq(sellers.id, part.sellerId))
          .where(eq(orders.id, part.orderId))
          .limit(1)
      : []
    const [seller] = who ? await db.select({ email: profiles.email }).from(profiles).where(eq(profiles.id, who.sellerProfileId)).limit(1) : []
    if (who && refund) {
      await notify('orders', {
        to: who.buyerEmail,
        subject: FULFILMENT_COPY.cancelledBuyerSubject(who.number),
        lines: [...FULFILMENT_COPY.cancelledBuyerLines(escapeHtml(who.store), formatMoney(refund.amountNgwee), refund.automatic)],
        action: { label: 'Your order', path: `/orders/${who.number}` },
      })
    }
    if (who && seller) {
      await notify('selling', { to: seller.email, subject: FULFILMENT_COPY.cancelledSellerSubject(who.number), lines: [...FULFILMENT_COPY.cancelledSellerLines], action: { label: 'Your listings', path: '/account/listings' } })
    }
  }
  return cancelled
}
