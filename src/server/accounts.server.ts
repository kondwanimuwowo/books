import { env } from 'cloudflare:workers'
import { and, eq, gt, inArray, or, sql } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { listings, orders, payments, payouts, refunds, sellerOrders, sellers, verificationRequests } from '#/db/schema'
import { DELETE_ACCOUNT_COPY } from '#/data/accounts'
import type { DeletionBlocker } from '#/data/accounts'
import type { SessionUser } from './auth'
import { sendEmail } from './email.server'
import { AppError } from './errors.server'
import { deletePrivate } from './private-files.server'
import { forgetSubscriber } from './newsletter.server'

const count = sql<number>`count(*)::int`
// A payment prompt older than this has long since failed or settled.
const PAYMENT_GRACE_MS = 24 * 60 * 60 * 1000

/**
 * What stops an account being deleted: anything still moving that involves money or a parcel. Deleting with any
 * of these open would leave a buyer without their books, or us holding money we owe someone we can't reach.
 */
export async function deletionBlockers(db: Db, profileId: string) {
  const [seller] = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.profileId, profileId)).limit(1)
  const [[payment], [parcels], [refunding], sales, sending] = await Promise.all([
    db
      .select({ n: count })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(and(eq(orders.buyerId, profileId), eq(payments.status, 'pending'), gt(payments.createdAt, new Date(Date.now() - PAYMENT_GRACE_MS)))),
    db
      .select({ n: count })
      .from(sellerOrders)
      .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
      .where(and(eq(orders.buyerId, profileId), inArray(sellerOrders.status, ['to_ship', 'shipped', 'disputed']))),
    db
      .select({ n: count })
      .from(refunds)
      .innerJoin(sellerOrders, eq(sellerOrders.id, refunds.sellerOrderId))
      .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
      .where(and(eq(orders.buyerId, profileId), inArray(refunds.status, ['processing', 'failed', 'manual']))),
    seller
      ? db
          .select({ n: count })
          .from(sellerOrders)
          .where(
            and(
              eq(sellerOrders.sellerId, seller.id),
              or(
                inArray(sellerOrders.status, ['awaiting_payment', 'to_ship', 'shipped', 'disputed']),
                and(eq(sellerOrders.status, 'delivered'), inArray(sellerOrders.payoutStatus, ['held', 'released', 'processing', 'failed'])),
              ),
            ),
          )
      : [{ n: 0 }],
    seller ? db.select({ n: count }).from(payouts).where(and(eq(payouts.sellerId, seller.id), eq(payouts.status, 'processing'))) : [{ n: 0 }],
  ])
  const found: Record<DeletionBlocker, number> = {
    payment: payment?.n ?? 0,
    parcels: parcels?.n ?? 0,
    refunds: refunding?.n ?? 0,
    sales: sales[0]?.n ?? 0,
    payouts: sending[0]?.n ?? 0,
  }
  return (Object.entries(found) as [DeletionBlocker, number][]).filter(([, n]) => n > 0).map(([kind, n]) => ({ kind, count: n }))
}

/**
 * Deletes the Supabase Auth user, which cascades to the profile and from there to the shop, listings, offers and
 * consents. Orders, payments and payouts stay with the account link cleared; reviews stay as from a former member.
 * One transaction, so it either all goes or none of it does.
 */
export async function deleteAccount(db: Db, user: SessionUser, confirmEmail: string) {
  if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) throw new AppError(DELETE_ACCOUNT_COPY.confirmMismatch)
  if ((await deletionBlockers(db, user.id)).length) throw new AppError('Finish your open orders and payouts first', 'conflict')

  const [seller] = await db.select({ id: sellers.id, photoUrl: sellers.photoUrl }).from(sellers).where(eq(sellers.profileId, user.id)).limit(1)
  const [photos, documents] = seller
    ? await Promise.all([
        db.select({ photos: listings.photos }).from(listings).where(eq(listings.sellerId, seller.id)),
        db.select({ documents: verificationRequests.documents }).from(verificationRequests).where(eq(verificationRequests.sellerId, seller.id)),
      ])
    : [[], []]

  await db.transaction(async (tx) => {
    // An unpaid order can no longer be paid once nobody owns it.
    await tx.update(orders).set({ status: 'cancelled' }).where(and(eq(orders.buyerId, user.id), eq(orders.status, 'pending_payment')))
    await tx.execute(sql`delete from auth.users where id = ${user.id}`)
  })

  // Files are best-effort after the fact: a leftover photo is harmless, a half-deleted account isn't.
  const coverKeys = [seller?.photoUrl, ...photos.flatMap((p) => p.photos)].flatMap((url) => (url?.startsWith('/covers/') ? [url.slice('/covers/'.length)] : []))
  await Promise.allSettled([
    coverKeys.length ? env.COVERS.delete(coverKeys) : null,
    deletePrivate(documents.flatMap((d) => d.documents.map((doc) => doc.key))),
    forgetSubscriber(db, user.email),
    // The account is gone, so this goes to their address directly rather than through notify().
    sendEmail({ to: user.email, subject: DELETE_ACCOUNT_COPY.emailSubject, lines: DELETE_ACCOUNT_COPY.emailLines }),
  ])
}
