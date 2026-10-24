import { and, asc, eq, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Db } from '#/db/client.server'
import { authors, bookAuthors, books, chartEntries, orderItems, orders, sellerOrders, sellers } from '#/db/schema'
import { CHART_MIN_BUYERS, CHART_OLDEST_WEIGHT, CHART_SIZE, CHART_WINDOW_DAYS, chartWeek, shiftWeek, weekStartsAt } from '#/data/chart'
import { cardColumns, offersSubquery } from './catalog.server'

/**
 * Freezes this week's chart from the 30 days before Monday. Each reader counts once per book,
 * weighted toward recent buys; unpaid, cancelled, refunded and disputed parcels don't count,
 * and neither do sellers or the book's own verified author buying it.
 */
export async function snapshotChart(db: Db) {
  const week = chartWeek()
  const [done] = await db.select({ week: chartEntries.week }).from(chartEntries).where(eq(chartEntries.week, week)).limit(1)
  if (done) return 0

  const until = weekStartsAt(week)
  const since = new Date(until.getTime() - CHART_WINDOW_DAYS * 86_400_000)
  const windowSeconds = CHART_WINDOW_DAYS * 86_400
  const rows = await db.execute<{ book_id: string; buyers: number; score: string }>(sql`
    with sales as (
      select oi.book_id, o.buyer_id, max(o.paid_at) as last_paid
      from ${orderItems} oi
      join ${sellerOrders} so on so.id = oi.seller_order_id
      join ${orders} o on o.id = so.order_id
      join ${sellers} s on s.id = so.seller_id
      join ${books} b on b.id = oi.book_id
      where b.is_zambian
        and o.paid_at >= ${since} and o.paid_at < ${until}
        and so.status in ('to_ship', 'shipped', 'delivered')
        and o.buyer_id <> s.profile_id
        and not exists (
          select 1 from ${bookAuthors} ba
          join ${authors} a on a.id = ba.author_id
          join ${sellers} vs on vs.id = a.verified_seller_id
          where ba.book_id = oi.book_id and vs.profile_id = o.buyer_id
        )
      group by oi.book_id, o.buyer_id
    )
    select book_id, count(*)::int as buyers,
      sum(1 - ${1 - CHART_OLDEST_WEIGHT} * extract(epoch from (${until}::timestamptz - last_paid)) / ${windowSeconds})::numeric(8, 3) as score
    from sales
    group by book_id
    having count(*) >= ${CHART_MIN_BUYERS}
    order by score desc, buyers desc, max(last_paid) desc
    limit ${CHART_SIZE}
  `)
  if (!rows.length) return 0
  await db
    .insert(chartEntries)
    .values(rows.map((r, i) => ({ week, rank: i + 1, bookId: r.book_id, buyers: r.buyers, score: r.score })))
    .onConflictDoNothing()
  return rows.length
}

/** This week's chart with last week's ranks, or how far it is from having a full Top 20. */
export async function loadChart(db: Db) {
  const week = chartWeek()
  const lastWeek = alias(chartEntries, 'last_week')
  const offers = offersSubquery(db)
  const entries = await db
    .select({ rank: chartEntries.rank, buyers: chartEntries.buyers, lastRank: lastWeek.rank, book: cardColumns(offers) })
    .from(chartEntries)
    .innerJoin(books, eq(books.id, chartEntries.bookId))
    .leftJoin(offers, eq(offers.bookId, books.id))
    .leftJoin(lastWeek, and(eq(lastWeek.bookId, chartEntries.bookId), eq(lastWeek.week, shiftWeek(week, -1))))
    .where(eq(chartEntries.week, week))
    .orderBy(asc(chartEntries.rank))
  // A partial list is never published as a chart.
  return entries.length === CHART_SIZE ? { week, entries, qualifying: entries.length } : { week, entries: [], qualifying: entries.length }
}
