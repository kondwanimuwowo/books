import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { payouts, sellerOrders, sellers } from '#/db/schema'
import { INSTANT_MIN_NGWEE, MAX_WAIT_DAYS, WEEKLY_MIN_NGWEE, instantFee, isPayoutWindow } from '#/data/payouts'
import { ngweeToAmount } from '#/lib/money'
import { randomCode } from '#/lib/utils'
import { getTransferStatus, initiateMobileMoneyTransfer } from './lenco.server'
import { AppError } from './errors.server'

// Delivered parcels wait as 'released' (the seller's balance) until a payout claims them.
const WAITING = ['released', 'failed'] as const

/** What a seller has ready to pay out, and when the oldest of it was delivered. */
export async function sellerBalance(db: Db, sellerId: string) {
  const [row] = await db
    .select({
      readyNgwee: sql<number>`coalesce(sum(${sellerOrders.payoutNgwee}), 0)::int`,
      oldest: sql<Date | null>`min(${sellerOrders.deliveredAt})`,
    })
    .from(sellerOrders)
    .where(and(eq(sellerOrders.sellerId, sellerId), inArray(sellerOrders.payoutStatus, WAITING), isNull(sellerOrders.payoutId)))
  return { readyNgwee: row?.readyNgwee ?? 0, oldest: row?.oldest ? new Date(row.oldest) : null }
}

/**
 * Pays a seller's whole balance in one transfer. Weekly payouts are free; instant ones take Lenco's fee.
 * Parcels are claimed before the transfer, so two payouts can never pay the same parcel.
 */
export async function payOutSeller(db: Db, sellerId: string, kind: 'weekly' | 'instant') {
  const [seller] = await db.select().from(sellers).where(eq(sellers.id, sellerId)).limit(1)
  if (!seller?.lencoRecipientId || seller.payoutMethod !== 'mobile_money') throw new AppError('Add your mobile money number first')

  const reference = `po-${sellerId.slice(0, 8)}-${randomCode(6)}`
  const [payout] = await db.insert(payouts).values({ sellerId, kind, amountNgwee: 0, reference, status: 'processing' }).returning({ id: payouts.id })
  const claimed = await db
    .update(sellerOrders)
    .set({ payoutStatus: 'processing', payoutId: payout.id })
    .where(and(eq(sellerOrders.sellerId, sellerId), inArray(sellerOrders.payoutStatus, WAITING), isNull(sellerOrders.payoutId)))
    .returning({ payoutNgwee: sellerOrders.payoutNgwee })
  const total = claimed.reduce((n, p) => n + p.payoutNgwee, 0)
  const fee = kind === 'instant' ? instantFee(total) : 0
  if (!claimed.length || (kind === 'instant' && total < INSTANT_MIN_NGWEE)) {
    await giveBack(db, payout.id)
    await db.delete(payouts).where(eq(payouts.id, payout.id))
    return null
  }

  await db.update(payouts).set({ amountNgwee: total - fee, feeNgwee: fee }).where(eq(payouts.id, payout.id))
  try {
    const transfer = await initiateMobileMoneyTransfer({
      recipientId: seller.lencoRecipientId,
      amount: ngweeToAmount(total - fee),
      reference,
      narration: kind === 'instant' ? 'Kuwala Books instant payout' : 'Kuwala Books weekly payout',
    })
    const status = transfer.status === 'successful' ? 'paid' : transfer.status === 'failed' ? 'failed' : 'processing'
    await settle(db, payout.id, status, transfer.lencoReference, transfer.reasonForFailure ?? null)
    return { status, amountNgwee: total - fee, feeNgwee: fee }
  } catch (error) {
    console.error('Payout failed', sellerId, error)
    await settle(db, payout.id, 'failed', null, String(error))
    return { status: 'failed' as const, amountNgwee: total - fee, feeNgwee: fee }
  }
}

/** Parcels from a failed or abandoned payout go back into the balance for the next one. */
async function giveBack(db: Db, payoutId: string) {
  await db.update(sellerOrders).set({ payoutStatus: 'released', payoutId: null }).where(eq(sellerOrders.payoutId, payoutId))
}

async function settle(db: Db, payoutId: string, status: 'paid' | 'failed' | 'processing', lencoReference: string | null, failureReason: string | null) {
  await db.update(payouts).set({ status, lencoReference, failureReason }).where(eq(payouts.id, payoutId))
  if (status === 'paid') await db.update(sellerOrders).set({ payoutStatus: 'paid' }).where(eq(sellerOrders.payoutId, payoutId))
  if (status === 'failed') await giveBack(db, payoutId)
}

/** Lenco can accept a transfer as pending; payout references never reach the webhook handler. */
export async function reconcilePayout(db: Db, payout: { id: string; reference: string; sellerOrderId: string | null }) {
  const transfer = await getTransferStatus(payout.reference)
  if (transfer.status === 'pending') return
  const status = transfer.status === 'successful' ? 'paid' : 'failed'
  // Payouts from before weekly payouts point at a single parcel instead.
  if (payout.sellerOrderId) {
    await db.update(sellerOrders).set({ payoutId: payout.id }).where(and(eq(sellerOrders.id, payout.sellerOrderId), eq(sellerOrders.payoutStatus, 'processing')))
  }
  await settle(db, payout.id, status, transfer.lencoReference, transfer.reasonForFailure ?? null)
}

const BATCH = 50

/** On payout day, every seller with enough waiting (or anything waiting a month) gets one free transfer. */
export async function weeklyPayouts(db: Db) {
  if (!isPayoutWindow()) return 0
  const due = await db.execute<{ seller_id: string }>(sql`
    select so.seller_id from seller_orders so join sellers s on s.id = so.seller_id
    where so.payout_status in ('released', 'failed') and so.payout_id is null
      and s.lenco_recipient_id is not null and s.payout_method = 'mobile_money'
      -- Once per payout day, and not again straight after a failure.
      and not exists (select 1 from payouts p where p.seller_id = so.seller_id and p.kind = 'weekly' and p.status <> 'failed' and p.created_at > now() - interval '6 days')
      and not exists (select 1 from payouts p where p.seller_id = so.seller_id and p.status = 'failed' and p.created_at > now() - interval '6 hours')
    group by so.seller_id
    having sum(so.payout_ngwee) >= ${WEEKLY_MIN_NGWEE} or min(so.delivered_at) < now() - make_interval(days => ${MAX_WAIT_DAYS})
    limit ${BATCH}`)
  let paid = 0
  for (const { seller_id } of due) {
    try {
      if (await payOutSeller(db, seller_id, 'weekly')) paid++
    } catch (error) {
      console.error('[cron] weekly payout failed', seller_id, error)
    }
  }
  return paid
}
