import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, gt, gte, inArray, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import type { Db } from '#/db/client.server'
import { books, listings, offers, profiles, sellers } from '#/db/schema'
import { MAX_COUNTERS, OFFER_HOLD_HOURS, OFFER_REPLY_HOURS, OFFERS_PER_COPY_PER_WEEK } from '#/data/listing-options'
import { formatMoney, toNgwee } from '#/lib/money'
import { requireUserMiddleware } from '#/server/auth'
import { escapeHtml, sendEmail } from '#/server/email.server'
import { loadOfferParties } from '#/server/offers.server'

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
          `Accept, decline or counter within ${OFFER_REPLY_HOURS} hours, or it’s declined for you.`,
        ],
        action: { label: 'Answer the offer', path: '/account/offers' },
      })
    }
    return { status: tooLow ? ('declined' as const) : ('pending' as const) }
  })

type Move = 'accept' | 'decline' | 'counter'
type Party = 'buyer' | 'seller'

/** Whoever's turn it is accepts, declines or counters. One counter each; the seller's answer to the buyer's counter is final. */
export const answerOffer = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(
    z.object({
      offerId: z.string().uuid(),
      move: z.enum(['accept', 'decline', 'counter']),
      counterKwacha: z.number().min(5).max(100000).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const db = getDb()
    const { side, amountNgwee } = await db.transaction(async (tx) => {
      const [offer] = await tx.select().from(offers).where(eq(offers.id, data.offerId)).for('update')
      const [seller] = offer ? await tx.select({ profileId: sellers.profileId }).from(sellers).where(eq(sellers.id, offer.sellerId)) : []
      const side: Party | null = offer?.buyerId === context.user.id ? 'buyer' : seller?.profileId === context.user.id ? 'seller' : null
      if (!offer || !side || offer.status !== 'pending' || offer.expiresAt <= new Date()) throw new Error('This offer is no longer open')
      if (offer.turn !== side) throw new Error('Waiting for the other side to answer')
      const now = new Date()

      if (data.move === 'decline') {
        await tx.update(offers).set({ status: 'declined', respondedAt: now }).where(eq(offers.id, offer.id))
        return { side, amountNgwee: side === 'seller' ? offer.amountNgwee : (offer.counterNgwee ?? offer.amountNgwee) }
      }

      if (data.move === 'counter') {
        if (offer.counters >= MAX_COUNTERS) throw new Error('This is the final offer. Accept or decline it')
        if (data.counterKwacha === undefined) throw new Error('Enter your counter-offer')
        const amount = toNgwee(data.counterKwacha)
        if (side === 'seller') {
          const [listing] = await tx.select({ priceNgwee: listings.priceNgwee }).from(listings).where(eq(listings.id, offer.listingId))
          if (amount <= offer.amountNgwee || amount >= listing.priceNgwee) {
            throw new Error(`Counter between ${formatMoney(offer.amountNgwee)} and ${formatMoney(listing.priceNgwee)}`)
          }
          await tx
            .update(offers)
            .set({ counterNgwee: amount, turn: 'buyer', counters: offer.counters + 1, respondedAt: now, expiresAt: hoursFromNow(OFFER_REPLY_HOURS) })
            .where(eq(offers.id, offer.id))
        } else {
          const ceiling = offer.counterNgwee ?? 0
          if (amount <= offer.amountNgwee || amount >= ceiling) throw new Error(`Counter between ${formatMoney(offer.amountNgwee)} and ${formatMoney(ceiling)}`)
          await tx
            .update(offers)
            .set({ amountNgwee: amount, turn: 'seller', counters: offer.counters + 1, respondedAt: now, expiresAt: hoursFromNow(OFFER_REPLY_HOURS) })
            .where(eq(offers.id, offer.id))
        }
        return { side, amountNgwee: amount }
      }

      const agreedNgwee = side === 'seller' ? offer.amountNgwee : offer.counterNgwee
      if (agreedNgwee === null) throw new Error('There’s no counter-offer to accept')
      // Locking the listing makes two accepts on its last copy queue up instead of both succeeding.
      const [listing] = await tx
        .select({ status: listings.status, quantity: listings.quantity })
        .from(listings)
        .where(eq(listings.id, offer.listingId))
        .for('update')
      if (!listing || listing.status !== 'active') throw new Error('This copy isn’t on sale right now')
      if (listing.quantity - (await heldCopies(tx, offer.listingId, offer.id)) < 1) {
        throw new Error(side === 'seller' ? 'Every copy is already held for an accepted offer' : 'The copy is held for another buyer. Try again later')
      }
      await tx
        .update(offers)
        .set({ status: 'accepted', agreedNgwee, respondedAt: now, expiresAt: hoursFromNow(OFFER_HOLD_HOURS) })
        .where(eq(offers.id, offer.id))
      return { side, amountNgwee: agreedNgwee }
    })

    const [o] = await loadOfferParties(db, [data.offerId])
    if (o) await sendEmail(moveEmail(data.move, side, amountNgwee, o))
    return { ok: true }
  })

function moveEmail(move: Move, by: Party, amountNgwee: number, o: Awaited<ReturnType<typeof loadOfferParties>>[number]) {
  const price = formatMoney(amountNgwee)
  const title = escapeHtml(o.title)
  const store = escapeHtml(o.storeName)
  const answer = { label: 'Answer the offer', path: '/account/offers' }
  if (by === 'seller') {
    if (move === 'accept') {
      return {
        to: o.buyerEmail,
        subject: `Offer accepted: ${o.title}`,
        lines: [`${store} accepted your offer of ${price} for ${title}.`, `The copy is held for you for ${OFFER_HOLD_HOURS} hours. Pay before then to keep it.`],
        action: { label: 'Buy it now', path: '/account/offers' },
      }
    }
    if (move === 'counter') {
      return {
        to: o.buyerEmail,
        subject: `Counter-offer: ${o.title}`,
        lines: [
          `${store} came back with ${price} for ${title}. You offered ${formatMoney(o.amountNgwee)}.`,
          `Accept, decline or make one last counter within ${OFFER_REPLY_HOURS} hours.`,
        ],
        action: answer,
      }
    }
    return {
      to: o.buyerEmail,
      subject: `Offer declined: ${o.title}`,
      lines: [`${store} declined your offer of ${price} for ${title}.`],
      action: { label: 'See your offers', path: '/account/offers' },
    }
  }
  if (move === 'accept') {
    return {
      to: o.sellerEmail,
      subject: `Counter-offer accepted: ${o.title}`,
      lines: [`The buyer accepted your counter of ${price} for ${title}.`, `The copy is held for them for ${OFFER_HOLD_HOURS} hours while they pay.`],
    }
  }
  if (move === 'counter') {
    return {
      to: o.sellerEmail,
      subject: `Final offer: ${o.title}`,
      lines: [`The buyer came back with ${price} for ${title}. This is their final offer: accept or decline within ${OFFER_REPLY_HOURS} hours.`],
      action: answer,
    }
  }
  return { to: o.sellerEmail, subject: `Counter-offer declined: ${o.title}`, lines: [`The buyer declined your counter of ${price} for ${title}.`] }
}

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
  counterNgwee: offers.counterNgwee,
  agreedNgwee: offers.agreedNgwee,
  turn: offers.turn,
  counters: offers.counters,
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
        .orderBy(desc(offers.updatedAt))
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
            .orderBy(desc(offers.updatedAt))
            .limit(100)
        : [],
    ])
    return { made, received, isSeller: !!seller }
  })
