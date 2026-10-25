import { and, eq, gt, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { authors, bookAuthors, books, listings, offers, payments, payouts, sellerOrders } from '#/db/schema'
import { findCoverUrls, googleCoverUrl, googleVolumeId } from './book-sources.server'
import { mirrorCover } from './covers.server'
import { summariseDescription } from './ai.server'
import { releaseToSeller, settlePayment } from './orders.server'
import { reconcilePayout, weeklyPayouts } from './payouts.server'
import { cancelUnshipped, remindToShip, settleRefunds } from './refunds.server'
import { notifyLapsed } from './offers.server'
import { snapshotChart } from './chart.server'
import { awardPlaques } from './tiers.server'
import { remindToRate } from './reminders.server'

// Runs from the Worker's cron trigger (see src/server.ts and wrangler.jsonc).
const BATCH = 50

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
  return each(open, 'reconcilePayouts', (row) => reconcilePayout(db, row))
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

// Each book can take several fetches (Google's retries plus the image), so batches stay small.
const COVER_BATCH = 3

// Copies each book's best cover into R2: Google's 800px image where it has one, else the cover we saved.
async function mirrorCovers(db: Db) {
  // Random order, so books waiting on Google don't hold up the rest.
  const due = await db
    .select({
      id: books.id,
      isbn13: books.isbn13,
      title: books.title,
      coverUrl: books.coverUrl,
      author: sql<string | null>`(select a.name from ${bookAuthors} ba join ${authors} a on a.id = ba.author_id where ba.book_id = ${books}.id order by ba.position limit 1)`,
    })
    .from(books)
    .where(isNull(books.coverCheckedAt))
    .orderBy(sql`random()`)
    .limit(COVER_BATCH)
  return each(due, 'mirrorCovers', async (book) => {
    const saved = book.coverUrl
    let urls: string[] = []
    if (!saved?.startsWith('/covers/')) {
      const volumeId = googleVolumeId(saved)
      const found = volumeId ? [googleCoverUrl(volumeId)] : await findCoverUrls(book)
      if (!found) return
      urls = [...new Set([...found, ...(saved ? [saved] : [])])]
    }
    let mirrored: string | null = null
    for (const url of urls) {
      mirrored = await mirrorCover(url, book.id)
      if (mirrored) break
    }
    // Skips the write if a seller added a photo meanwhile; the next run picks the book up again.
    await db
      .update(books)
      .set({ coverUrl: mirrored ?? saved, coverCheckedAt: new Date() })
      .where(and(eq(books.id, book.id), saved ? eq(books.coverUrl, saved) : isNull(books.coverUrl)))
  })
}

const SUMMARY_BATCH = 5

// The one-line summary beside the price, condensed by Claude from the description we already hold.
async function summariseBooks(db: Db) {
  const due = await db
    .select({ id: books.id, description: books.description })
    .from(books)
    .where(and(isNull(books.summary), isNotNull(books.description)))
    .orderBy(sql`random()`)
    .limit(SUMMARY_BATCH)
  return each(due, 'summariseBooks', async (book) => {
    const summary = book.description ? await summariseDescription(db, book.description) : null
    if (summary) await db.update(books).set({ summary }).where(and(eq(books.id, book.id), isNull(books.summary)))
  })
}

const JOBS = { remindToShip, cancelUnshipped, settleRefunds, releaseOverdue, settleStalePayments, reconcilePayouts, weeklyPayouts, expireOffers, snapshotChart, mirrorCovers, summariseBooks, awardPlaques, remindToRate }

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
