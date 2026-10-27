import { sql } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { REMINDER_AFTER_DAYS, REMINDER_UNTIL_DAYS, REVIEW_COPY } from '#/data/reputation'
import { escapeHtml } from './email.server'
import { notify } from './notify.server'

const BATCH = 50

/** One nudge per parcel, a few days after delivery: the buyer to rate the shop and review the books, the shop to rate the buyer. */
export async function remindToRate(db: Db) {
  const due = await db.execute<{
    id: string
    number: string
    store: string
    buyer_email: string
    seller_email: string
    buyer_done: boolean
    seller_rated: boolean
  }>(sql`
    update seller_orders so set rating_reminder_at = now()
    from orders o, sellers s, profiles bp, profiles sp
    where o.id = so.order_id and s.id = so.seller_id and bp.id = o.buyer_id and sp.id = s.profile_id
      and so.id in (
        select id from seller_orders
        where status = 'delivered' and rating_reminder_at is null
          and delivered_at between now() - make_interval(days => ${REMINDER_UNTIL_DAYS}) and now() - make_interval(days => ${REMINDER_AFTER_DAYS})
        limit ${BATCH})
    returning so.id, o.number, s.store_name as store, bp.email as buyer_email, sp.email as seller_email,
      exists (select 1 from ratings r where r.seller_order_id = so.id and r.rater = 'buyer')
        and not exists (select 1 from order_items oi where oi.seller_order_id = so.id and oi.book_id is not null
          and not exists (select 1 from reviews v where v.book_id = oi.book_id and v.profile_id = o.buyer_id)) as buyer_done,
      exists (select 1 from ratings r where r.seller_order_id = so.id and r.rater = 'seller') as seller_rated`)
  for (const part of due) {
    if (!part.buyer_done) {
      await notify('orders', {
        to: part.buyer_email,
        subject: REVIEW_COPY.reminderSubject,
        lines: [escapeHtml(REVIEW_COPY.reminderBuyer(part.store))],
        action: { label: 'Rate and review', path: `/orders/${part.number}` },
      })
    }
    if (!part.seller_rated) {
      await notify('selling', {
        to: part.seller_email,
        subject: `Rate the buyer for order ${part.number}`,
        lines: [REVIEW_COPY.reminderSeller],
        action: { label: 'Rate the buyer', path: '/account/sales' },
      })
    }
  }
  return due.length
}
