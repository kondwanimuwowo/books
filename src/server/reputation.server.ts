import { sql } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { BLIND_DAYS, TRUSTED, readerBadge } from '#/data/reputation'

export interface Rating {
  average: number
  count: number
}

export interface ReaderStanding {
  books: number
  badge: string | null
  rating: Rating | null
  trusted: boolean
}

// Blind ratings: one counts once the other side has rated the same parcel, or the window to answer has passed.
const visible = sql`(exists (select 1 from ratings o where o.seller_order_id = r.seller_order_id and o.rater <> r.rater)
  or so.delivered_at < now() - make_interval(days => ${BLIND_DAYS}))`

const idList = (ids: string[]) => sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)

/** What buyers think of each shop. */
export async function shopRatings(db: Db, sellerIds: string[]) {
  const ratings = new Map<string, Rating>()
  if (!sellerIds.length) return ratings
  const rows = await db.execute<{ seller_id: string; average: number; count: number }>(sql`
    select so.seller_id, round(avg(r.score), 1)::float as average, count(*)::int as count
    from ratings r join seller_orders so on so.id = r.seller_order_id
    where r.rater = 'buyer' and so.seller_id in (${idList(sellerIds)}) and ${visible}
    group by so.seller_id`)
  for (const row of rows) ratings.set(row.seller_id, { average: row.average, count: row.count })
  return ratings
}

/** How each buyer has been as a customer: books received, what shops say, and whether they pay for what they agree to. */
export async function readerStandings(db: Db, profileIds: string[]) {
  const standings = new Map<string, ReaderStanding>()
  const ids = [...new Set(profileIds)]
  if (!ids.length) return standings
  const rows = await db.execute<{ id: string; books: number; parcels: number; average: number | null; count: number; unpaid: number }>(sql`
    select p.id,
      (select coalesce(sum(oi.quantity), 0)::int from orders o
        join seller_orders so on so.order_id = o.id and so.status = 'delivered'
        join order_items oi on oi.seller_order_id = so.id
        where o.buyer_id = p.id) as books,
      (select count(*)::int from orders o join seller_orders so on so.order_id = o.id and so.status = 'delivered' where o.buyer_id = p.id) as parcels,
      rated.average, coalesce(rated.count, 0) as count,
      (select count(*)::int from offers f
        where f.buyer_id = p.id and f.status = 'expired' and f.agreed_ngwee is not null
          and f.expires_at <= f.updated_at and f.updated_at > now() - make_interval(days => ${TRUSTED.unpaidDays})) as unpaid
    from profiles p
    left join lateral (
      select round(avg(r.score), 1)::float as average, count(*)::int as count
      from ratings r join seller_orders so on so.id = r.seller_order_id join orders o on o.id = so.order_id
      where r.rater = 'seller' and o.buyer_id = p.id and ${visible}
    ) rated on true
    where p.id in (${idList(ids)})`)
  for (const row of rows) {
    const rating = row.count ? { average: row.average ?? 0, count: row.count } : null
    const ratedWell = row.count < TRUSTED.ratings || (row.average ?? 0) >= TRUSTED.average
    standings.set(row.id, {
      books: row.books,
      badge: readerBadge(row.books)?.label ?? null,
      rating,
      trusted: row.parcels >= TRUSTED.orders && row.unpaid === 0 && ratedWell,
    })
  }
  return standings
}
