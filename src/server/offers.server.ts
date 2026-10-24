import { eq, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Db } from '#/db/client.server'
import { books, listings, offers, profiles, sellers } from '#/db/schema'
import { formatMoney } from '#/lib/money'
import { escapeHtml, sendEmail } from './email.server'

const sellerProfiles = alias(profiles, 'seller_profiles')

/** Who to write to about an offer, and what it was for. */
export async function loadOfferParties(db: Db, ids: string[]) {
  if (!ids.length) return []
  return db
    .select({
      id: offers.id,
      amountNgwee: offers.amountNgwee,
      counterNgwee: offers.counterNgwee,
      agreedNgwee: offers.agreedNgwee,
      title: books.title,
      storeName: sellers.storeName,
      buyerEmail: profiles.email,
      sellerEmail: sellerProfiles.email,
    })
    .from(offers)
    .innerJoin(listings, eq(listings.id, offers.listingId))
    .innerJoin(books, eq(books.id, listings.bookId))
    .innerJoin(sellers, eq(sellers.id, offers.sellerId))
    .innerJoin(profiles, eq(profiles.id, offers.buyerId))
    .innerJoin(sellerProfiles, eq(sellerProfiles.id, sellers.profileId))
    .where(inArray(offers.id, ids))
}

export async function notifySoldElsewhere(db: Db, ids: string[]) {
  const rows = await loadOfferParties(db, ids)
  await Promise.all(
    rows.map((o) =>
      sendEmail({
        to: o.buyerEmail,
        subject: `${o.title} has sold`,
        lines: [`The copy of ${escapeHtml(o.title)} you made an offer on has sold to another buyer, so your offer is closed.`],
        action: { label: 'Find another copy', path: '/account/offers' },
      }),
    ),
  )
}

/** The cron closed these because whoever's turn it was ran out of time. */
export async function notifyLapsed(db: Db, lapsed: { id: string; turn: 'buyer' | 'seller'; agreedNgwee: number | null }[]) {
  const rows = new Map((await loadOfferParties(db, lapsed.map((l) => l.id))).map((r) => [r.id, r]))
  await Promise.all(
    lapsed.map((l) => {
      const o = rows.get(l.id)
      if (!o) return
      const title = escapeHtml(o.title)
      if (l.agreedNgwee !== null) {
        return sendEmail({
          to: o.sellerEmail,
          subject: `Offer not paid: ${o.title}`,
          lines: [`The buyer didn’t pay the agreed ${formatMoney(l.agreedNgwee)} for ${title} in time. The copy is back on sale.`],
        })
      }
      return l.turn === 'seller'
        ? sendEmail({
            to: o.buyerEmail,
            subject: `No reply on ${o.title}`,
            lines: [`${escapeHtml(o.storeName)} didn’t answer your offer for ${title} in time, so it has been declined.`],
            action: { label: 'See your offers', path: '/account/offers' },
          })
        : sendEmail({
            to: o.sellerEmail,
            subject: `No reply on ${o.title}`,
            lines: [`The buyer didn’t answer your counter-offer for ${title} in time, so it has been declined.`],
          })
    }),
  )
}
