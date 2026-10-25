import { sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { PLAQUE_COPY, REVIEW_GATE, TIERS, tierInfo } from '#/data/tiers'
import type { Tier } from '#/data/tiers'
import { escapeHtml, sendEmail } from './email.server'

/**
 * Distinct readers per verified author: buyers with a delivered copy of one of their books, from any shop.
 * Refunded and disputed orders never reach 'delivered'; the author buying their own book doesn't count.
 */
function readersQuery(only?: SQL) {
  return sql`
    select ba.author_id, count(distinct o.buyer_id)::int as readers
    from order_items oi
    join seller_orders so on so.id = oi.seller_order_id and so.status = 'delivered'
    join orders o on o.id = so.order_id
    join book_authors ba on ba.book_id = oi.book_id
    join authors a on a.id = ba.author_id and a.verified_seller_id is not null
    join sellers s on s.id = a.verified_seller_id
    where o.buyer_id <> s.profile_id ${only ? sql`and ${only}` : sql``}
    group by ba.author_id`
}

export async function authorReaders(db: Db, authorId: string) {
  const [row] = await db.execute<{ readers: number }>(readersQuery(sql`ba.author_id = ${authorId}`))
  return row?.readers ?? 0
}

/** Awards any plaque an author has newly earned and tells them. Plaques are never taken back. */
export async function awardPlaques(db: Db) {
  let awarded = 0
  for (const { tier, readers, books } of TIERS) {
    const rows = await db.execute<{ author_id: string; readers: number }>(sql`
      with readers as (${readersQuery()}),
      shelf as (select author_id, count(*)::int as books from book_authors group by author_id),
      reviewed as (
        select ba.author_id, count(*)::int as reviews, avg(v.score) as average
        from reviews v join book_authors ba on ba.book_id = v.book_id
        where v.hidden_at is null group by ba.author_id)
      insert into author_milestones (author_id, tier, readers)
      select r.author_id, ${tier}::author_tier, r.readers
      from readers r join shelf on shelf.author_id = r.author_id left join reviewed rv on rv.author_id = r.author_id
      where r.readers >= ${readers} and shelf.books >= ${books}
        -- Enough readers isn't enough on its own once reviews say the books disappoint.
        and (coalesce(rv.reviews, 0) < ${REVIEW_GATE.reviews} or rv.average >= ${REVIEW_GATE.average})
      on conflict do nothing
      returning author_id, readers`)
    for (const row of rows) {
      awarded++
      await announce(db, row.author_id, tier, row.readers)
    }
  }
  return awarded
}

async function announce(db: Db, authorId: string, tier: Tier, readers: number) {
  const [author] = await db.execute<{ name: string; slug: string; email: string }>(sql`
    select a.name, a.slug, p.email
    from authors a join sellers s on s.id = a.verified_seller_id join profiles p on p.id = s.profile_id
    where a.id = ${authorId}`)
  if (!author) return
  const { label } = tierInfo(tier)
  await sendEmail({
    to: author.email,
    subject: `${PLAQUE_COPY.reached(label)} on Kuwala Books`,
    lines: [escapeHtml(PLAQUE_COPY.email(author.name.split(' ')[0], label, readers))],
    action: { label: 'See your page', path: `/authors/${author.slug}` },
  })
}
