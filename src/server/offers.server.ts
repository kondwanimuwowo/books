import { and, desc, eq, gt, gte, inArray, ne, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Db } from '#/db/client.server'
import { books, listings, offers, profiles, sellers } from '#/db/schema'
import { MAX_COUNTERS, OFFER_HOLD_HOURS, OFFER_REPLY_HOURS, OFFERS_PER_COPY_PER_WEEK } from '#/data/listing-options'
import { formatMoney, toNgwee } from '#/lib/money'
import type { AnswerOfferInput, MakeOfferInput } from '#/schemas/offers'
import { escapeHtml } from './email.server'
import { AppError } from './errors.server'
import { notify } from './notify.server'
import { readerStandings } from './reputation.server'

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
      notify('offers', {
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
        return notify('offers', {
          to: o.sellerEmail,
          subject: `Offer not paid: ${o.title}`,
          lines: [`The buyer didn’t pay the agreed ${formatMoney(l.agreedNgwee)} for ${title} in time. The copy is back on sale.`],
        })
      }
      return l.turn === 'seller'
        ? notify('offers', {
            to: o.buyerEmail,
            subject: `No reply on ${o.title}`,
            lines: [`${escapeHtml(o.storeName)} didn’t answer your offer for ${title} in time, so it has been declined.`],
            action: { label: 'See your offers', path: '/account/offers' },
          })
        : notify('offers', {
            to: o.sellerEmail,
            subject: `No reply on ${o.title}`,
            lines: [`The buyer didn’t answer your counter-offer for ${title} in time, so it has been declined.`],
          })
    }),
  )
}

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

export async function createOffer(db: Db, userId: string, input: MakeOfferInput) {
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
    .where(eq(listings.id, input.listingId))
    .limit(1)
  if (!listing || listing.status !== 'active' || listing.quantity < 1) throw new AppError('This copy is no longer for sale')
  if (!listing.acceptsOffers) throw new AppError('This seller isn’t taking offers on this copy')
  if (listing.seller.profileId === userId) throw new AppError('This is your own listing')

  const amountNgwee = toNgwee(input.amountKwacha)
  if (amountNgwee >= listing.priceNgwee) throw new AppError(`Offer less than ${formatMoney(listing.priceNgwee)}, or add it to your bag`)

  const [recent] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(offers)
    .where(and(eq(offers.listingId, listing.id), eq(offers.buyerId, userId), gte(offers.createdAt, hoursFromNow(-7 * 24))))
  if (recent.n >= OFFERS_PER_COPY_PER_WEEK) throw new AppError('You’ve made enough offers on this copy this week', 'rate_limited')

  const tooLow = listing.floorNgwee !== null && amountNgwee < listing.floorNgwee
  const now = new Date()
  try {
    await db.insert(offers).values({
      listingId: listing.id,
      buyerId: userId,
      sellerId: listing.seller.id,
      amountNgwee,
      message: input.message || null,
      ...(tooLow ? { status: 'declined' as const, respondedAt: now, expiresAt: now } : { expiresAt: hoursFromNow(OFFER_REPLY_HOURS) }),
    })
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError('You already have an offer on this copy', 'conflict')
    throw error
  }

  if (!tooLow) {
    await notify('offers', {
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
}

type Move = 'accept' | 'decline' | 'counter'
type Party = 'buyer' | 'seller'

/** Whoever's turn it is accepts, declines or counters. One counter each; the seller's answer to the buyer's counter is final. */
export async function respondToOffer(db: Db, userId: string, input: AnswerOfferInput) {
  const { side, amountNgwee } = await db.transaction(async (tx) => {
    const [offer] = await tx.select().from(offers).where(eq(offers.id, input.offerId)).for('update')
    const [seller] = offer ? await tx.select({ profileId: sellers.profileId }).from(sellers).where(eq(sellers.id, offer.sellerId)) : []
    const side: Party | null = offer?.buyerId === userId ? 'buyer' : seller?.profileId === userId ? 'seller' : null
    if (!offer || !side || offer.status !== 'pending' || offer.expiresAt <= new Date()) throw new AppError('This offer is no longer open', 'conflict')
    if (offer.turn !== side) throw new AppError('Waiting for the other side to answer', 'conflict')
    const now = new Date()

    if (input.move === 'decline') {
      await tx.update(offers).set({ status: 'declined', respondedAt: now }).where(eq(offers.id, offer.id))
      return { side, amountNgwee: side === 'seller' ? offer.amountNgwee : (offer.counterNgwee ?? offer.amountNgwee) }
    }

    if (input.move === 'counter') {
      if (offer.counters >= MAX_COUNTERS) throw new AppError('This is the final offer. Accept or decline it')
      if (input.counterKwacha === undefined) throw new AppError('Enter your counter-offer')
      const amount = toNgwee(input.counterKwacha)
      if (side === 'seller') {
        const [listing] = await tx.select({ priceNgwee: listings.priceNgwee }).from(listings).where(eq(listings.id, offer.listingId))
        if (amount <= offer.amountNgwee || amount >= listing.priceNgwee) {
          throw new AppError(`Counter between ${formatMoney(offer.amountNgwee)} and ${formatMoney(listing.priceNgwee)}`)
        }
        await tx
          .update(offers)
          .set({ counterNgwee: amount, turn: 'buyer', counters: offer.counters + 1, respondedAt: now, expiresAt: hoursFromNow(OFFER_REPLY_HOURS) })
          .where(eq(offers.id, offer.id))
      } else {
        const ceiling = offer.counterNgwee ?? 0
        if (amount <= offer.amountNgwee || amount >= ceiling) throw new AppError(`Counter between ${formatMoney(offer.amountNgwee)} and ${formatMoney(ceiling)}`)
        await tx
          .update(offers)
          .set({ amountNgwee: amount, turn: 'seller', counters: offer.counters + 1, respondedAt: now, expiresAt: hoursFromNow(OFFER_REPLY_HOURS) })
          .where(eq(offers.id, offer.id))
      }
      return { side, amountNgwee: amount }
    }

    const agreedNgwee = side === 'seller' ? offer.amountNgwee : offer.counterNgwee
    if (agreedNgwee === null) throw new AppError('There’s no counter-offer to accept')
    // Locking the listing makes two accepts on its last copy queue up instead of both succeeding.
    const [listing] = await tx
      .select({ status: listings.status, quantity: listings.quantity })
      .from(listings)
      .where(eq(listings.id, offer.listingId))
      .for('update')
    if (!listing || listing.status !== 'active') throw new AppError('This copy isn’t on sale right now')
    if (listing.quantity - (await heldCopies(tx, offer.listingId, offer.id)) < 1) {
      throw new AppError(side === 'seller' ? 'Every copy is already held for an accepted offer' : 'The copy is held for another buyer. Try again later')
    }
    await tx
      .update(offers)
      .set({ status: 'accepted', agreedNgwee, respondedAt: now, expiresAt: hoursFromNow(OFFER_HOLD_HOURS) })
      .where(eq(offers.id, offer.id))
    return { side, amountNgwee: agreedNgwee }
  })

  const [o] = await loadOfferParties(db, [input.offerId])
  if (o) await notify('offers', moveEmail(input.move, side, amountNgwee, o))
  return { ok: true }
}

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

export async function withdrawBuyerOffer(db: Db, userId: string, offerId: string) {
  const [row] = await db
    .update(offers)
    .set({ status: 'withdrawn', respondedAt: new Date() })
    .where(and(eq(offers.id, offerId), eq(offers.buyerId, userId), inArray(offers.status, ['pending', 'accepted'])))
    .returning({ id: offers.id })
  if (!row) throw new AppError('This offer is no longer open', 'conflict')
  return { ok: true }
}

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

export async function listMyOffers(db: Db, userId: string) {
  const [seller] = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.profileId, userId)).limit(1)
  const [made, received] = await Promise.all([
    db
      .select({ ...offerColumns, storeName: sellers.storeName })
      .from(offers)
      .innerJoin(listings, eq(listings.id, offers.listingId))
      .innerJoin(books, eq(books.id, listings.bookId))
      .innerJoin(sellers, eq(sellers.id, offers.sellerId))
      .where(eq(offers.buyerId, userId))
      .orderBy(desc(offers.updatedAt))
      .limit(100),
    seller
      ? db
          .select({ ...offerColumns, buyerName: profiles.displayName, buyerId: offers.buyerId })
          .from(offers)
          .innerJoin(listings, eq(listings.id, offers.listingId))
          .innerJoin(books, eq(books.id, listings.bookId))
          .innerJoin(profiles, eq(profiles.id, offers.buyerId))
          // Offers the floor turned away never reach the seller; createOffer stamps them respondedAt = expiresAt.
          .where(and(eq(offers.sellerId, seller.id), sql`${offers.respondedAt} is distinct from ${offers.expiresAt}`))
          .orderBy(desc(offers.updatedAt))
          .limit(100)
      : [],
  ])
  const standings = await readerStandings(db, received.map((o) => o.buyerId))
  return {
    made,
    received: received.map(({ buyerId, ...o }) => ({ ...o, buyer: standings.get(buyerId) ?? null })),
    isSeller: !!seller,
  }
}
