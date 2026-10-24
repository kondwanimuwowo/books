import { and, eq, gt, inArray, isNotNull, lt, lte, or, sql } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { listings, offers, payments, payouts, sellerOrders, sellers } from '#/db/schema'
import { getTransferStatus } from './lenco.server'
import { attemptPayout, releaseToSeller, settlePayment } from './orders.server'
import { notifyLapsed } from './offers.server'

// Runs from the Worker's cron trigger (see src/server.ts and wrangler.jsonc).
const BATCH = 50
const MAX_PAYOUT_ATTEMPTS = 3

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000)

async function each<T>(rows: T[], label: string, run: (row: T) => Promise<unknown>) {
  let done = 0
  for (const row of rows) {
    try {
      await run(row)
      done++
    } catch (error) {
      console.error(`[cron] ${label} item failed`, row, error)
    }
  }
  return done
}

// The buyer neither confirmed delivery nor reported a problem before autoReleaseAt.
async function releaseOverdue(db: Db) {
  const due = await db
    .select({ id: sellerOrders.id })
    .from(sellerOrders)
    .where(and(eq(sellerOrders.status, 'shipped'), lte(sellerOrders.autoReleaseAt, new Date())))
    .limit(BATCH)
  return each(due, 'releaseOverdue', (row) => releaseToSeller(db, row.id))
}

// Safety net for when the buyer leaves the payment page and the webhook never arrives.
async function settleStalePayments(db: Db) {
  const stale = await db
    .select({ reference: payments.reference })
    .from(payments)
    .where(and(eq(payments.status, 'pending'), lt(payments.createdAt, minutesAgo(10)), gt(payments.createdAt, minutesAgo(2 * 24 * 60))))
    .limit(BATCH)
  return each(stale, 'settleStalePayments', (row) => settlePayment(db, row.reference))
}

// Lenco can accept a transfer as pending; payout references never reach the webhook handler.
async function reconcilePayouts(db: Db) {
  const open = await db
    .select({ id: payouts.id, reference: payouts.reference, sellerOrderId: payouts.sellerOrderId })
    .from(payouts)
    .where(and(eq(payouts.status, 'processing'), lt(payouts.createdAt, minutesAgo(5))))
    .limit(BATCH)
  return each(open, 'reconcilePayouts', async (row) => {
    const transfer = await getTransferStatus(row.reference)
    if (transfer.status === 'pending') return
    const status = transfer.status === 'successful' ? 'paid' : 'failed'
    await db
      .update(payouts)
      .set({ status, lencoReference: transfer.lencoReference, failureReason: transfer.reasonForFailure ?? null })
      .where(eq(payouts.id, row.id))
    await db
      .update(sellerOrders)
      .set({ payoutStatus: status })
      .where(and(eq(sellerOrders.id, row.sellerOrderId), eq(sellerOrders.payoutStatus, 'processing')))
  })
}

// Released money waits for the seller's payout details; failed transfers get a few more tries.
async function retryPayouts(db: Db) {
  const attempts = sql<number>`(select count(*)::int from ${payouts} p where p.seller_order_id = ${sellerOrders.id})`
  const rows = await db
    .select({ id: sellerOrders.id, payoutStatus: sellerOrders.payoutStatus })
    .from(sellerOrders)
    .innerJoin(sellers, eq(sellers.id, sellerOrders.sellerId))
    .where(
      and(
        isNotNull(sellers.lencoRecipientId),
        eq(sellers.payoutMethod, 'mobile_money'),
        or(eq(sellerOrders.payoutStatus, 'released'), and(eq(sellerOrders.payoutStatus, 'failed'), lt(attempts, MAX_PAYOUT_ATTEMPTS))),
      ),
    )
    .limit(BATCH)
  return each(rows, 'retryPayouts', async (row) => {
    if (row.payoutStatus === 'failed') {
      await db.update(sellerOrders).set({ payoutStatus: 'released' }).where(and(eq(sellerOrders.id, row.id), eq(sellerOrders.payoutStatus, 'failed')))
    }
    await attemptPayout(db, row.id)
  })
}

// Silence declines an offer, unpaid holds go back on sale, and offers on copies taken down close.
async function expireOffers(db: Db) {
  const now = new Date()
  const rows = await db
    .update(offers)
    .set({ status: 'expired' })
    .where(
      and(
        inArray(offers.status, ['pending', 'accepted']),
        or(lte(offers.expiresAt, now), sql`exists (select 1 from ${listings} l where l.id = ${offers.listingId} and l.status <> 'active')`),
      ),
    )
    .returning({ id: offers.id, turn: offers.turn, agreedNgwee: offers.agreedNgwee, expiresAt: offers.expiresAt })
  await notifyLapsed(
    db,
    rows.filter((r) => r.expiresAt <= now),
  )
  return rows.length
}

const JOBS = { releaseOverdue, settleStalePayments, reconcilePayouts, retryPayouts, expireOffers }

export async function runScheduledJobs(db: Db) {
  for (const [name, job] of Object.entries(JOBS)) {
    try {
      const handled = await job(db)
      if (handled) console.log(`[cron] ${name}: ${handled}`)
    } catch (error) {
      console.error(`[cron] ${name} failed`, error)
    }
  }
}
