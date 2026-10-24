import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, gt, gte, inArray, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import type { Db } from '#/db/client.server'
import { books, listings, offers, profiles, sellers } from '#/db/schema'
import { OFFER_HOLD_HOURS, OFFER_REPLY_HOURS, OFFERS_PER_COPY_PER_WEEK } from '#/data/listing-options'
import { formatMoney, toNgwee } from '#/lib/money'
import { requireSellerMiddleware, requireUserMiddleware } from '#/server/auth'
import { escapeHtml, sendEmail } from '#/server/email.server'

const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000)

function isUniqueViolation(error: unknown) {
  const code = (e: unknown) => (typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined)
  return code(error) === '23505' || code((error as { cause?: unknown } | null)?.cause) === '23505'
}

/** Copies already promised to other buyers through accepted offers that haven't lapsed. */
async function heldCopies(db: Pick<Db, 'select'>, listingId: string, exceptOfferId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(offers)
    .where(and(eq(offers.listingId, listingId), eq(offers.status, 'accepted'), gt(offers.expiresAt, new Date()), ne(offers.id, exceptOfferId)))
  return row.n
}

export const makeOffer = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(
    z.object({
      listingId: z.string().uuid(),
      amountKwacha: z.number().min(5).max(100000),
      message: z.string().trim().max(300).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const db = getDb()
    const [listing] = await db
      .select({
        id: listings.id,
        status: listings.status,
        quantity: listings.quantity,
        priceNgwee: listings.priceNgwee,
        acceptsOffers: listings.acceptsOffers,
        floorNgwee: listings.offerFloorNgwee,
        title: books.title,
        seller: { id: sellers.id, profileId: sellers.profileId, storeName: sellers.storeName, email: profiles.email },
      })
      .from(listings)
      .innerJoin(books, eq(books.id, listings.bookId))
      .innerJoin(sellers, eq(sellers.id, listings.sellerId))
      .innerJoin(profiles, eq(profiles.id, sellers.profileId))
      .where(eq(listings.id, data.listingId))
      .limit(1)
    if (!listing || listing.status !== 'active' || listing.quantity < 1) throw new Error('This copy is no longer for sale')
    if (!listing.acceptsOffers) throw new Error('This seller isn’t taking offers on this copy')
    if (listing.seller.profileId === context.user.id) throw new Error('This is your own listing')

    const amountNgwee = toNgwee(data.amountKwacha)
    if (amountNgwee >= listing.priceNgwee) throw new Error(`Offer less than ${formatMoney(listing.priceNgwee)}, or add it to your bag`)

    const [recent] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(offers)
      .where(and(eq(offers.listingId, listing.id), eq(offers.buyerId, context.user.id), gte(offers.createdAt, hoursFromNow(-7 * 24))))
    if (recent.n >= OFFERS_PER_COPY_PER_WEEK) throw new Error('You’ve made enough offers on this copy this week')

    const tooLow = listing.floorNgwee !== null && amountNgwee < listing.floorNgwee
    const now = new Date()
    try {
      await db.insert(offers).values({
        listingId: listing.id,
        buyerId: context.user.id,
        sellerId: listing.seller.id,
        amountNgwee,
        message: data.message || null,
        ...(tooLow ? { status: 'declined' as const, respondedAt: now, expiresAt: now } : { expiresAt: hoursFromNow(OFFER_REPLY_HOURS) }),
      })
    } catch (error) {
      if (isUniqueViolation(error)) throw new Error('You already have an offer on this copy')
      throw error
    }

    if (!tooLow) {
      await sendEmail({
        to: listing.seller.email,
        subject: `Offer of ${formatMoney(amountNgwee)} for ${listing.title}`,
        lines: [
          `A buyer has offered ${formatMoney(amountNgwee)} for ${escapeHtml(listing.title)}, which you listed at ${formatMoney(listing.priceNgwee)}.`,
          `Accept or decline within ${OFFER_REPLY_HOURS} hours, or the offer lapses.`,
        ],
        action: { label: 'Answer the offer', path: '/account/offers' },
      })
    }
    return { status: tooLow ? ('declined' as const) : ('pending' as const) }
  })

export const respondToOffer = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(z.object({ offerId: z.string().uuid(), accept: z.boolean() }))
  .handler(async ({ data, context }) => {
    const db = getDb()
    const result = await db.transaction(async (tx) => {
      const [offer] = await tx
        .select({ id: offers.id, listingId: offers.listingId, buyerId: offers.buyerId, status: offers.status, expiresAt: offers.expiresAt })
        .from(offers)
        .where(and(eq(offers.id, data.offerId), eq(offers.sellerId, context.seller.id)))
        .limit(1)
      if (!offer || offer.status !== 'pending' || offer.expiresAt <= new Date()) throw new Error('This offer is no longer open')

      if (!data.accept) {
        await tx.update(offers).set({ status: 'declined', respondedAt: new Date() }).where(eq(offers.id, offer.id))
        return offer
      }

      // Locking the listing makes two accepts on its last copy queue up instead of both succeeding.
      const [listing] = await tx
        .select({ status: listings.status, quantity: listings.quantity })
        .from(listings)
        .where(eq(listings.id, offer.listingId))
        .for('update')
      if (!listing || listing.status !== 'active') throw new Error('This listing isn’t live. Resume it first')
      if (listing.quantity - (await heldCopies(tx, offer.listingId, offer.id)) < 1) throw new Error('Every copy is already held for an accepted offer')

      await tx.update(offers).set({ status: 'accepted', respondedAt: new Date(), expiresAt: hoursFromNow(OFFER_HOLD_HOURS) }).where(eq(offers.id, offer.id))
      return offer
    })

    const [row] = await db
      .select({ email: profiles.email, title: books.title, amountNgwee: offers.amountNgwee })
      .from(offers)
      .innerJoin(profiles, eq(profiles.id, offers.buyerId))
      .innerJoin(listings, eq(listings.id, offers.listingId))
      .innerJoin(books, eq(books.id, listings.bookId))
      .where(eq(offers.id, result.id))
    await sendEmail(
      data.accept
        ? {
            to: row.email,
            subject: `Offer accepted: ${row.title}`,
            lines: [
              `${escapeHtml(context.seller.storeName)} accepted your offer of ${formatMoney(row.amountNgwee)} for ${escapeHtml(row.title)}.`,
              `The copy is held for you for ${OFFER_HOLD_HOURS} hours. Pay before then to keep it.`,
            ],
            action: { label: 'Buy it now', path: '/account/offers' },
          }
        : {
            to: row.email,
            subject: `Offer declined: ${row.title}`,
            lines: [`${escapeHtml(context.seller.storeName)} declined your offer of ${formatMoney(row.amountNgwee)} for ${escapeHtml(row.title)}.`],
            action: { label: 'See the book', path: '/account/offers' },
          },
    )
    return { ok: true }
  })

export const withdrawOffer = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(z.object({ offerId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const [row] = await getDb()
      .update(offers)
      .set({ status: 'withdrawn', respondedAt: new Date() })
      .where(and(eq(offers.id, data.offerId), eq(offers.buyerId, context.user.id), inArray(offers.status, ['pending', 'accepted'])))
      .returning({ id: offers.id })
    if (!row) throw new Error('This offer is no longer open')
    return { ok: true }
  })

const offerColumns = {
  id: offers.id,
  listingId: offers.listingId,
  amountNgwee: offers.amountNgwee,
  message: offers.message,
  // The cron catches up every 15 minutes; until then an overdue offer still reads as lapsed.
  status: sql<(typeof offers.status.enumValues)[number]>`case when ${offers.status} in ('pending', 'accepted') and ${offers.expiresAt} <= now() then 'expired' else ${offers.status} end`,
  expiresAt: offers.expiresAt,
  createdAt: offers.createdAt,
  priceNgwee: listings.priceNgwee,
  condition: listings.condition,
  book: { slug: books.slug, title: books.title, coverUrl: books.coverUrl },
}

export const getMyOffers = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .handler(async ({ context }) => {
    const db = getDb()
    const [seller] = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.profileId, context.user.id)).limit(1)
    const [made, received] = await Promise.all([
      db
        .select({ ...offerColumns, storeName: sellers.storeName })
        .from(offers)
        .innerJoin(listings, eq(listings.id, offers.listingId))
        .innerJoin(books, eq(books.id, listings.bookId))
        .innerJoin(sellers, eq(sellers.id, offers.sellerId))
        .where(eq(offers.buyerId, context.user.id))
        .orderBy(desc(offers.createdAt))
        .limit(100),
      seller
        ? db
            .select({ ...offerColumns, buyerName: profiles.displayName })
            .from(offers)
            .innerJoin(listings, eq(listings.id, offers.listingId))
            .innerJoin(books, eq(books.id, listings.bookId))
            .innerJoin(profiles, eq(profiles.id, offers.buyerId))
            // Offers the floor turned away never reach the seller; makeOffer stamps them respondedAt = expiresAt.
            .where(and(eq(offers.sellerId, seller.id), sql`${offers.respondedAt} is distinct from ${offers.expiresAt}`))
            .orderBy(desc(offers.createdAt))
            .limit(100)
        : [],
    ])
    return { made, received, isSeller: !!seller }
  })
