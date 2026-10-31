import { env } from 'cloudflare:workers'
import { sql } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { ALERTS_COPY, DIGEST_HOUR, DIGEST_MAX_BOOKS } from '#/data/emails'
import { formatMoney } from '#/lib/money'
import { escapeHtml } from './email.server'
import { notify } from './notify.server'

const BATCH = 50
const LUSAKA_OFFSET_HOURS = 2

/** The cheapest copy of a book on sale from anyone but the reader themselves. */
export const cheapestFor = (bookId: unknown, profileId: unknown) => sql<number | null>`(
  select min(l.price_ngwee) from listings l join sellers s on s.id = l.seller_id
  where l.book_id = ${bookId} and l.status = 'active' and s.profile_id <> ${profileId})`

function lusakaEvening(now = new Date()) {
  const local = new Date(now.getTime() + LUSAKA_OFFSET_HOURS * 3_600_000)
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - LUSAKA_OFFSET_HOURS * 3_600_000)
  return { start, open: local.getUTCHours() >= DIGEST_HOUR }
}

const link = (slug: string, title: string) => `<a href="${env.APP_ORIGIN}/books/${slug}" style="color:#722F37">${escapeHtml(title)}</a>`

/** Each evening, one email per member with alerts on: saved books that got cheaper or came back, and new listings from who they follow. */
export async function sendAlertDigests(db: Db) {
  const evening = lusakaEvening()
  if (!evening.open) return 0
  // Claimed before sending, so a slow run never emails anyone twice.
  const due = await db.execute<{ id: string; email: string; name: string; token: string }>(sql`
    update profiles set alerts_sent_at = now()
    where id in (
      select id from profiles
      where alerts_at is not null and alerts_token is not null
        and (alerts_sent_at is null or alerts_sent_at < ${evening.start.toISOString()}::timestamptz)
      limit ${BATCH})
    returning id, email, display_name as name, alerts_token as token`)
  let sent = 0
  for (const member of due) {
    try {
      if (await digestFor(db, member)) sent++
    } catch (error) {
      console.error('[cron] alert digest failed', member.id, error)
    }
  }
  return sent
}

async function digestFor(db: Db, member: { id: string; email: string; name: string; token: string }) {
  // Every saved book moves to today's price, so a rise or a sell-out resets what counts as news.
  const cheaper = await db.execute<{ title: string; slug: string; seen: number | null; price: number }>(sql`
    with cur as (
      select f.book_id, f.seen_price_ngwee as seen, ${cheapestFor(sql`f.book_id`, member.id)} as price
      from favourites f where f.profile_id = ${member.id}
    ), moved as (
      update favourites f set seen_price_ngwee = cur.price
      from cur where f.profile_id = ${member.id} and f.book_id = cur.book_id and f.seen_price_ngwee is distinct from cur.price
    )
    select b.title, b.slug, cur.seen, cur.price
    from cur join books b on b.id = cur.book_id
    where cur.price is not null and (cur.seen is null or cur.price < cur.seen)
    order by b.title
    limit ${DIGEST_MAX_BOOKS}`)

  const fresh = await db.execute<{ title: string; slug: string; price: number; via: string }>(sql`
    with mine as (select * from follows where profile_id = ${member.id}),
    found as (
      select distinct on (b.id) b.id, b.title, b.slug, l.price_ngwee as price, l.created_at,
        coalesce(a.name, fs.store_name, p.name) as via
      from listings l
      join books b on b.id = l.book_id
      join sellers s on s.id = l.seller_id
      join mine f on l.created_at > f.seen_at and (
        f.seller_id = l.seller_id
        or f.publisher_id = b.publisher_id
        or exists (select 1 from book_authors ba where ba.book_id = b.id and ba.author_id = f.author_id))
      left join authors a on a.id = f.author_id
      left join sellers fs on fs.id = f.seller_id
      left join publishers p on p.id = f.publisher_id
      where l.status = 'active' and s.profile_id <> ${member.id}
        -- Saved books are covered above.
        and not exists (select 1 from favourites fv where fv.profile_id = ${member.id} and fv.book_id = b.id)
      order by b.id, l.price_ngwee
    )
    select title, slug, price, via from found order by created_at desc limit ${DIGEST_MAX_BOOKS}`)
  await db.execute(sql`update follows set seen_at = now() where profile_id = ${member.id}`)

  const count = cheaper.length + fresh.length
  if (!count) return false
  const lines = [
    escapeHtml(ALERTS_COPY.greeting(member.name.split(' ')[0])),
    ...(cheaper.length
      ? [`<strong>${ALERTS_COPY.cheaperHeading}</strong>`, ...cheaper.map((b) => ALERTS_COPY.cheaper(link(b.slug, b.title), formatMoney(b.price), b.seen === null ? null : formatMoney(b.seen)))]
      : []),
    ...(fresh.length ? [`<strong>${ALERTS_COPY.newHeading}</strong>`, ...fresh.map((b) => ALERTS_COPY.fresh(link(b.slug, b.title), escapeHtml(b.via), formatMoney(b.price)))] : []),
  ]
  await notify('alerts', {
    to: member.email,
    subject: ALERTS_COPY.subject(count),
    lines,
    action: { label: ALERTS_COPY.action, path: '/account/saved' },
    unsubscribe: { label: ALERTS_COPY.unsubscribe, path: `/unsubscribe?list=alerts&t=${member.token}` },
  })
  return true
}
