import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import { and, asc, desc, eq, ilike, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { z } from 'zod'
import { SHIPPING_METHODS } from '#/data/shipping'
import { getDb } from '#/db/client.server'
import { authors, bookAuthors, books, deliveryRates, listings, orderItems, orders, payments, profiles, publishers, sellerOrders, sellers, verificationRequests, refunds } from '#/db/schema'
import { slugify } from '#/lib/utils'
import { formatMoney, toNgwee } from '#/lib/money'
import type { Operator } from '#/lib/phone'
import { optionalUserMiddleware, requireAdminMiddleware } from '#/server/auth'
import { escapeHtml, sendEmail } from '#/server/email.server'
import { deletePrivate } from '#/server/private-files.server'
import { uniqueSlug } from '#/server/catalog.server'
import { completeOrderIfSettled, loadDeliveryRates, releaseToSeller } from '#/server/orders.server'
import { payOutSeller } from '#/server/payouts.server'
import { refundParcel } from '#/server/refunds.server'

const LATE_SHIPMENT_DAYS = 3
const sellerProfile = alias(profiles, 'seller_profile')
const count = sql<number>`count(*)::int`

// Drives the admin layout and guard only; every function below re-checks with requireAdminMiddleware.
export const getAdminContext = createServerFn({ method: 'GET' })
  .middleware([optionalUserMiddleware])
  .handler(async ({ context }) => {
    const adminOrigin = env.ADMIN_ORIGIN ?? null
    const onAdminHost = !adminOrigin || new URL(getRequestUrl()).host === new URL(adminOrigin).host
    let isAdmin = false
    if (context.user) {
      const [row] = await getDb().select({ isAdmin: profiles.isAdmin }).from(profiles).where(eq(profiles.id, context.user.id)).limit(1)
      isAdmin = row?.isAdmin ?? false
    }
    return {
      onAdminHost,
      adminOrigin,
      appOrigin: env.APP_ORIGIN,
      user: context.user ? { email: context.user.email, isAdmin } : null,
    }
  })

export const getAdminOverview = createServerFn({ method: 'GET' })
  .middleware([requireAdminMiddleware])
  .handler(async () => {
    const db = getDb()
    const lateBefore = new Date(Date.now() - LATE_SHIPMENT_DAYS * 24 * 60 * 60 * 1000)
    const [[disputed], [failedPayouts], [awaitingDetails], [late], [unverified], [held]] = await Promise.all([
      db.select({ n: count }).from(sellerOrders).where(eq(sellerOrders.status, 'disputed')),
      db.select({ n: count }).from(sellerOrders).where(eq(sellerOrders.payoutStatus, 'failed')),
      db.select({ n: count }).from(sellerOrders).where(eq(sellerOrders.payoutStatus, 'released')),
      db
        .select({ n: count })
        .from(sellerOrders)
        .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
        .where(and(eq(sellerOrders.status, 'to_ship'), lt(orders.paidAt, lateBefore))),
      db
        .select({ n: count })
        .from(sellers)
        .where(and(isNull(sellers.verifiedAt), ne(sellers.kind, 'individual'))),
      db
        .select({ ngwee: sql<number>`coalesce(sum(${sellerOrders.subtotalNgwee} + ${sellerOrders.shippingNgwee}), 0)::int` })
        .from(sellerOrders)
        .where(eq(sellerOrders.payoutStatus, 'held')),
    ])
    return {
      disputed: disputed.n,
      failedPayouts: failedPayouts.n,
      awaitingPayoutDetails: awaitingDetails.n,
      lateShipments: late.n,
      unverifiedSellers: unverified.n,
      heldNgwee: held.ngwee,
    }
  })

export const listDisputes = createServerFn({ method: 'GET' })
  .middleware([requireAdminMiddleware])
  .handler(async () => {
    const db = getDb()
    const rows = await db
      .select({
        id: sellerOrders.id,
        orderNumber: orders.number,
        disputeNote: sellerOrders.disputeNote,
        disputedAt: sellerOrders.disputedAt,
        shippedAt: sellerOrders.shippedAt,
        trackingNote: sellerOrders.trackingNote,
        proofKey: sellerOrders.proofKey,
        shippingMethod: sellerOrders.shippingMethod,
        subtotalNgwee: sellerOrders.subtotalNgwee,
        shippingNgwee: sellerOrders.shippingNgwee,
        payoutNgwee: sellerOrders.payoutNgwee,
        buyerName: orders.shipName,
        buyerPhone: orders.shipPhone,
        buyerEmail: profiles.email,
        storeName: sellers.storeName,
        sellerSlug: sellers.slug,
        sellerPhone: sellers.phone,
        sellerEmail: sellerProfile.email,
        paidWith: sql<{ method: 'mobile_money' | 'card'; operator: Operator | null; phone: string | null } | null>`(
          select json_build_object('method', p.method, 'operator', p.operator, 'phone', p.phone)
          from ${payments} p where p.order_id = ${orders.id} and p.status = 'successful' limit 1
        )`,
      })
      .from(sellerOrders)
      .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
      .innerJoin(profiles, eq(profiles.id, orders.buyerId))
      .innerJoin(sellers, eq(sellers.id, sellerOrders.sellerId))
      .innerJoin(sellerProfile, eq(sellerProfile.id, sellers.profileId))
      .where(eq(sellerOrders.status, 'disputed'))
      .orderBy(asc(sellerOrders.disputedAt))

    const items = rows.length
      ? await db
          .select({ sellerOrderId: orderItems.sellerOrderId, title: orderItems.title, quantity: orderItems.quantity })
          .from(orderItems)
          .where(
            inArray(
              orderItems.sellerOrderId,
              rows.map((r) => r.id),
            ),
          )
      : []
    return rows.map((r) => ({ ...r, items: items.filter((i) => i.sellerOrderId === r.id) }))
  })

export const resolveDispute = createServerFn({ method: 'POST' })
  .middleware([requireAdminMiddleware])
  .validator(
    z.object({
      sellerOrderId: z.string().uuid(),
      outcome: z.enum(['release', 'refund']),
      note: z.string().trim().min(5, 'Add a short note on how this was resolved').max(1000),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const [part] = await db
      .select({
        orderId: sellerOrders.orderId,
        orderNumber: orders.number,
        refundNgwee: sql<number>`(${sellerOrders.subtotalNgwee} + ${sellerOrders.shippingNgwee})::int`,
        payoutNgwee: sellerOrders.payoutNgwee,
        buyerEmail: profiles.email,
        sellerEmail: sellerProfile.email,
        storeName: sellers.storeName,
      })
      .from(sellerOrders)
      .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
      .innerJoin(profiles, eq(profiles.id, orders.buyerId))
      .innerJoin(sellers, eq(sellers.id, sellerOrders.sellerId))
      .innerJoin(sellerProfile, eq(sellerProfile.id, sellers.profileId))
      .where(and(eq(sellerOrders.id, data.sellerOrderId), eq(sellerOrders.status, 'disputed')))
      .limit(1)
    if (!part) throw new Error('This dispute has already been resolved')

    const resolution = { resolvedAt: new Date(), resolutionNote: data.note }
    if (data.outcome === 'release') {
      await db.update(sellerOrders).set(resolution).where(eq(sellerOrders.id, data.sellerOrderId))
      await releaseToSeller(db, data.sellerOrderId, ['disputed'])
    } else {
      await db
        .update(sellerOrders)
        .set({ ...resolution, status: 'refunded', payoutStatus: 'refunded' })
        .where(and(eq(sellerOrders.id, data.sellerOrderId), eq(sellerOrders.status, 'disputed')))
      // Sent back to the buyer's mobile money now; card payments wait in admin's refund list.
      await refundParcel(db, data.sellerOrderId, 'dispute')
      await completeOrderIfSettled(db, part.orderId)
    }

    const orderLink = `${env.APP_ORIGIN}/orders/${part.orderNumber}`
    const refunded = data.outcome === 'refund'
    await Promise.all([
      sendEmail({
        to: part.buyerEmail,
        subject: `Update on your problem report for order ${part.orderNumber}`,
        lines: [
          refunded
            ? `We've refunded ${formatMoney(part.refundNgwee)} for the books from ${part.storeName}.`
            : `We've looked into your report about the books from ${part.storeName} and released the payment to the seller.`,
          data.note,
          orderLink,
        ],
      }),
      sendEmail({
        to: part.sellerEmail,
        subject: `Dispute on order ${part.orderNumber} resolved`,
        lines: [
          refunded
            ? 'The buyer has been refunded, so this sale will not be paid out.'
            : `The payment of ${formatMoney(part.payoutNgwee)} has been released to you.`,
          data.note,
        ],
      }),
    ])
    return { ok: true }
  })

const searchInput = z.object({ q: z.string().trim().max(100).optional() })

export const listSellers = createServerFn({ method: 'GET' })
  .middleware([requireAdminMiddleware])
  .validator(searchInput)
  .handler(async ({ data }) => {
    const like = data.q ? `%${data.q}%` : null
    return getDb()
      .select({
        id: sellers.id,
        slug: sellers.slug,
        storeName: sellers.storeName,
        kind: sellers.kind,
        town: sellers.town,
        phone: sellers.phone,
        email: profiles.email,
        verifiedAt: sellers.verifiedAt,
        createdAt: sellers.createdAt,
        hasPayoutDetails: sql<boolean>`${sellers.lencoRecipientId} is not null`,
        activeListings: sql<number>`(select count(*)::int from listings l where l.seller_id = ${sellers.id} and l.status = 'active')`,
        sales: sql<number>`(select count(*)::int from seller_orders so where so.seller_id = ${sellers.id} and so.status in ('to_ship', 'shipped', 'delivered'))`,
      })
      .from(sellers)
      .innerJoin(profiles, eq(profiles.id, sellers.profileId))
      .where(like ? or(ilike(sellers.storeName, like), ilike(sellers.slug, like), ilike(profiles.email, like)) : undefined)
      // Businesses and authors waiting for the badge come first.
      .orderBy(sql`${sellers.verifiedAt} is null and ${sellers.kind} <> 'individual' desc`, desc(sellers.createdAt))
      .limit(100)
  })

export const setSellerVerified = createServerFn({ method: 'POST' })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ sellerId: z.string().uuid(), verified: z.boolean() }))
  .handler(async ({ data }) => {
    await getDb()
      .update(sellers)
      .set({ verifiedAt: data.verified ? new Date() : null })
      .where(eq(sellers.id, data.sellerId))
    return { ok: true }
  })

export const listDeliveryRates = createServerFn({ method: 'GET' })
  .middleware([requireAdminMiddleware])
  .handler(() => loadDeliveryRates(getDb()))

export const saveDeliveryRate = createServerFn({ method: 'POST' })
  .middleware([requireAdminMiddleware])
  .validator(
    z
      .object({
        method: z.enum(SHIPPING_METHODS),
        band: z.enum(['same_town', 'other_province']),
        feeKwacha: z.number().min(0).max(5000),
        extraItemKwacha: z.number().min(0).max(1000),
        etaMinDays: z.number().int().min(0).max(60),
        etaMaxDays: z.number().int().min(0).max(60),
      })
      .refine((r) => r.etaMaxDays >= r.etaMinDays, { message: 'The latest day can’t be before the earliest' }),
  )
  .handler(async ({ data }) => {
    const [updated] = await getDb()
      .update(deliveryRates)
      .set({ feeNgwee: toNgwee(data.feeKwacha), extraItemNgwee: toNgwee(data.extraItemKwacha), etaMinDays: data.etaMinDays, etaMaxDays: data.etaMaxDays })
      .where(and(eq(deliveryRates.method, data.method), eq(deliveryRates.band, data.band)))
      .returning({ method: deliveryRates.method })
    if (!updated) throw new Error('Rate not found')
    return { ok: true }
  })

export const listAuthors = createServerFn({ method: 'GET' })
  .middleware([requireAdminMiddleware])
  .validator(searchInput)
  .handler(async ({ data }) => {
    return getDb()
      .select({
        id: authors.id,
        slug: authors.slug,
        name: authors.name,
        isZambian: authors.isZambian,
        books: sql<number>`(select count(*)::int from book_authors ba where ba.author_id = ${authors.id})`,
        verifiedSeller: sql<{ slug: string; storeName: string } | null>`case when ${sellers.id} is null then null
          else json_build_object('slug', ${sellers.slug}, 'storeName', ${sellers.storeName}) end`,
      })
      .from(authors)
      .leftJoin(sellers, eq(sellers.id, authors.verifiedSellerId))
      .where(data.q ? ilike(authors.name, `%${data.q}%`) : undefined)
      .orderBy(desc(authors.isZambian), asc(authors.name))
      .limit(100)
  })

export const updateAuthor = createServerFn({ method: 'POST' })
  .middleware([requireAdminMiddleware])
  .validator(
    z.object({
      authorId: z.string().uuid(),
      isZambian: z.boolean().optional(),
      // A seller's shop slug, or null to remove the verified link.
      verifiedSellerSlug: z.string().trim().max(80).nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    if (data.verifiedSellerSlug !== undefined) {
      let sellerId: string | null = null
      if (data.verifiedSellerSlug) {
        const [seller] = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.slug, data.verifiedSellerSlug)).limit(1)
        if (!seller) throw new Error(`No shop with the address "${data.verifiedSellerSlug}"`)
        sellerId = seller.id
      }
      await db.update(authors).set({ verifiedSellerId: sellerId }).where(eq(authors.id, data.authorId))
    }
    if (data.isZambian !== undefined) {
      await db.update(authors).set({ isZambian: data.isZambian }).where(eq(authors.id, data.authorId))
      // A book counts as Zambian when any of its authors is.
      await db
        .update(books)
        .set({
          isZambian: sql`exists (select 1 from ${bookAuthors} ba join ${authors} a on a.id = ba.author_id where ba.book_id = ${books}.id and a.is_zambian)`,
        })
        .where(inArray(books.id, db.select({ id: bookAuthors.bookId }).from(bookAuthors).where(eq(bookAuthors.authorId, data.authorId))))
    }
    return { ok: true }
  })

export const listPublishers = createServerFn({ method: 'GET' })
  .middleware([requireAdminMiddleware])
  .validator(searchInput)
  .handler(async ({ data }) => {
    return getDb()
      .select({
        id: publishers.id,
        slug: publishers.slug,
        name: publishers.name,
        bio: publishers.bio,
        website: publishers.website,
        isZambian: publishers.isZambian,
        books: sql<number>`(select count(*)::int from ${books} b where b.publisher_id = ${publishers}.id)`,
        verifiedSeller: sql<{ slug: string; storeName: string } | null>`case when ${sellers.id} is null then null
          else json_build_object('slug', ${sellers.slug}, 'storeName', ${sellers.storeName}) end`,
      })
      .from(publishers)
      .leftJoin(sellers, eq(sellers.id, publishers.verifiedSellerId))
      .where(data.q ? ilike(publishers.name, `%${data.q}%`) : undefined)
      .orderBy(desc(publishers.isZambian), asc(publishers.name))
      .limit(100)
  })

async function sellerIdForSlug(db: ReturnType<typeof getDb>, slug: string | null) {
  if (!slug) return null
  const [seller] = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.slug, slug)).limit(1)
  if (!seller) throw new Error(`No shop with the address "${slug}"`)
  return seller.id
}

export const updatePublisher = createServerFn({ method: 'POST' })
  .middleware([requireAdminMiddleware])
  .validator(
    z.object({
      publisherId: z.string().uuid(),
      details: z
        .object({
          name: z.string().trim().min(1, 'Add a name').max(200),
          bio: z.string().trim().max(4000),
          website: z.union([z.literal(''), z.string().trim().url('Use a full address, e.g. https://example.com').max(300)]),
        })
        .optional(),
      isZambian: z.boolean().optional(),
      // A seller's shop slug, or null to remove the verified link.
      verifiedSellerSlug: z.string().trim().max(80).nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    if (data.details) {
      const { name, bio, website } = data.details
      const slug = slugify(name)
      const [taken] = await db
        .select({ id: publishers.id })
        .from(publishers)
        .where(and(eq(publishers.slug, slug), ne(publishers.id, data.publisherId)))
        .limit(1)
      if (taken) throw new Error(`"${name}" is already a publisher. Merge the two instead`)
      await db.update(publishers).set({ name, slug, bio: bio || null, website: website || null }).where(eq(publishers.id, data.publisherId))
      // Books show the publisher's name as printed; keep it in step with the corrected name.
      await db.update(books).set({ publisher: name }).where(eq(books.publisherId, data.publisherId))
    }
    if (data.isZambian !== undefined) await db.update(publishers).set({ isZambian: data.isZambian }).where(eq(publishers.id, data.publisherId))
    if (data.verifiedSellerSlug !== undefined) {
      await db.update(publishers).set({ verifiedSellerId: await sellerIdForSlug(db, data.verifiedSellerSlug) }).where(eq(publishers.id, data.publisherId))
    }
    return { ok: true }
  })

/** Folds a duplicate (e.g. "Penguin" into "Penguin Books"): its books move over and the duplicate is deleted. */
export const mergePublishers = createServerFn({ method: 'POST' })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ fromId: z.string().uuid(), intoSlug: z.string().trim().min(1).max(120) }))
  .handler(async ({ data }) => {
    return getDb().transaction(async (tx) => {
      const [into] = await tx.select({ id: publishers.id, name: publishers.name }).from(publishers).where(eq(publishers.slug, data.intoSlug)).limit(1)
      if (!into) throw new Error(`No publisher with the address "${data.intoSlug}"`)
      if (into.id === data.fromId) throw new Error('That’s the same publisher')
      await tx.update(books).set({ publisherId: into.id, publisher: into.name }).where(eq(books.publisherId, data.fromId))
      await tx.delete(publishers).where(eq(publishers.id, data.fromId))
      return { ok: true }
    })
  })

export const listRecentOrders = createServerFn({ method: 'GET' })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ unpaid: z.boolean().optional() }))
  .handler(async ({ data }) => {
    const db = getDb()
    const rows = await db
      .select({
        id: orders.id,
        number: orders.number,
        status: orders.status,
        totalNgwee: orders.totalNgwee,
        createdAt: orders.createdAt,
        buyerName: orders.shipName,
        shipTown: orders.shipTown,
        buyerEmail: profiles.email,
      })
      .from(orders)
      .innerJoin(profiles, eq(profiles.id, orders.buyerId))
      .where(data.unpaid ? eq(orders.status, 'pending_payment') : ne(orders.status, 'pending_payment'))
      .orderBy(desc(orders.createdAt))
      .limit(50)

    const parts = rows.length
      ? await db
          .select({
            id: sellerOrders.id,
            orderId: sellerOrders.orderId,
            storeName: sellers.storeName,
            status: sellerOrders.status,
            payoutStatus: sellerOrders.payoutStatus,
            payoutNgwee: sellerOrders.payoutNgwee,
          })
          .from(sellerOrders)
          .innerJoin(sellers, eq(sellers.id, sellerOrders.sellerId))
          .where(
            inArray(
              sellerOrders.orderId,
              rows.map((r) => r.id),
            ),
          )
      : []
    return rows.map((r) => ({ ...r, parts: parts.filter((p) => p.orderId === r.id) }))
  })

export const retryPayout = createServerFn({ method: 'POST' })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ sellerOrderId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const db = getDb()
    const [row] = await db
      .update(sellerOrders)
      .set({ payoutStatus: 'released', payoutId: null })
      .where(and(eq(sellerOrders.id, data.sellerOrderId), inArray(sellerOrders.payoutStatus, ['failed', 'released'])))
      .returning({ sellerId: sellerOrders.sellerId })
    if (!row) throw new Error('This payout is not waiting or failed')
    // Admin retries are free, like a weekly payout, and take the seller's whole balance with them.
    const result = await payOutSeller(db, row.sellerId, 'weekly')
    if (result?.status === 'failed') throw new Error('Lenco refused the transfer again. Check the seller’s number.')
    return { ok: true }
  })

export const listVerifications = createServerFn({ method: 'GET' })
  .middleware([requireAdminMiddleware])
  .handler(async () => {
    return getDb()
      .select({
        id: verificationRequests.id,
        legalName: verificationRequests.legalName,
        documents: verificationRequests.documents,
        status: verificationRequests.status,
        createdAt: verificationRequests.createdAt,
        seller: {
          slug: sellers.slug,
          storeName: sellers.storeName,
          photoUrl: sellers.photoUrl,
          bio: sellers.bio,
          town: sellers.town,
          // The name the mobile money network has on file: SIM registration is NRC-backed.
          payoutAccountName: sellers.payoutAccountName,
        },
        author: sql<{ slug: string; name: string; books: number } | null>`case when ${authors.id} is null then null
          else json_build_object('slug', ${authors.slug}, 'name', ${authors.name},
            'books', (select count(*)::int from book_authors ba where ba.author_id = ${authors.id})) end`,
        listings: sql<number>`(select count(*)::int from listings l where l.seller_id = ${sellers.id} and l.status = 'active')`,
        // They signed up with the address we found on the author's own site and invited: they control it.
        invitedEmail: sql<boolean>`exists (select 1 from author_drafts d join profiles p on p.id = ${sellers.profileId}
          where d.author_id = ${verificationRequests.authorId} and lower(d.contact->>'email') = lower(p.email))`,
      })
      .from(verificationRequests)
      .innerJoin(sellers, eq(sellers.id, verificationRequests.sellerId))
      .leftJoin(authors, eq(authors.id, verificationRequests.authorId))
      .where(eq(verificationRequests.status, 'pending'))
      .orderBy(asc(verificationRequests.createdAt))
  })

export const decideVerification = createServerFn({ method: 'POST' })
  .middleware([requireAdminMiddleware])
  .validator(
    z.object({
      requestId: z.string().uuid(),
      decision: z.enum(['approved', 'rejected', 'needs_more']),
      note: z.string().trim().max(600).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const db = getDb()
    const [request] = await db
      .select({ request: verificationRequests, seller: sellers, email: profiles.email })
      .from(verificationRequests)
      .innerJoin(sellers, eq(sellers.id, verificationRequests.sellerId))
      .innerJoin(profiles, eq(profiles.id, sellers.profileId))
      .where(and(eq(verificationRequests.id, data.requestId), eq(verificationRequests.status, 'pending')))
      .limit(1)
    if (!request) throw new Error('Already decided')
    if (data.decision !== 'approved' && !data.note) throw new Error('Tell them why, so they can put it right')
    const { seller } = request

    let authorSlug: string | null = null
    if (data.decision === 'approved') {
      const [listed] = await db.select({ id: listings.id }).from(listings).where(eq(listings.sellerId, seller.id)).limit(1)
      if (!listed) throw new Error('They need to list a book first')
      if (request.request.authorId) {
        // Their own words and face fill the page where the catalogue had nothing.
        const [page] = await db
          .update(authors)
          .set({ verifiedSellerId: seller.id, bio: sql`coalesce(${authors.bio}, ${seller.bio})`, photoUrl: sql`coalesce(${authors.photoUrl}, ${seller.photoUrl})` })
          .where(and(eq(authors.id, request.request.authorId), or(isNull(authors.verifiedSellerId), eq(authors.verifiedSellerId, seller.id))))
          .returning({ slug: authors.slug })
        if (!page) throw new Error('That author page is verified to another shop now')
        authorSlug = page.slug
      } else {
        const [page] = await db
          .insert(authors)
          .values({ slug: await uniqueSlug(db, authors, slugify(seller.storeName)), name: seller.storeName, bio: seller.bio, photoUrl: seller.photoUrl, verifiedSellerId: seller.id })
          .returning({ slug: authors.slug })
        authorSlug = page.slug
      }
      await db.update(sellers).set({ verifiedAt: new Date() }).where(eq(sellers.id, seller.id))
    }

    // Documents are only kept while someone needs to look at them.
    await deletePrivate(request.request.documents.map((d) => d.key))
    await db
      .update(verificationRequests)
      .set({ status: data.decision, note: data.note || null, documents: [], reviewerId: context.user.id, decidedAt: new Date() })
      .where(eq(verificationRequests.id, data.requestId))

    const first = request.request.legalName.split(' ')[0]
    await sendEmail(
      data.decision === 'approved'
        ? {
            to: request.email,
            subject: 'You’re a verified author on Kuwala Books',
            lines: [`Congratulations ${escapeHtml(first)}. Your author page now carries the verified mark, and you can edit it and your books.`],
            action: { label: 'See your page', path: `/authors/${authorSlug}` },
          }
        : {
            to: request.email,
            subject: data.decision === 'needs_more' ? 'We need a little more to verify you' : 'About your author verification',
            lines: [escapeHtml(data.note ?? ''), 'Your shop stays open while this is sorted.'],
            action: { label: data.decision === 'needs_more' ? 'Send it again' : 'Your shop', path: '/account/shop' },
          },
    )
    return { ok: true }
  })

/** True while a book has an order or offer in flight: deleting it then would break that sale. */
const bookInUse = (bookId: SQL) => sql<boolean>`exists (select 1 from order_items oi join seller_orders so on so.id = oi.seller_order_id
    where oi.book_id = ${bookId} and so.status in ('awaiting_payment', 'to_ship', 'shipped', 'disputed'))
  or exists (select 1 from offers o join listings l on l.id = o.listing_id where l.book_id = ${bookId} and o.status in ('pending', 'accepted'))`

export const listBooks = createServerFn({ method: 'GET' })
  .middleware([requireAdminMiddleware])
  .validator(searchInput)
  .handler(async ({ data }) => {
    const like = data.q ? `%${data.q}%` : null
    return getDb()
      .select({
        id: books.id,
        slug: books.slug,
        title: books.title,
        coverUrl: books.coverUrl,
        isbn13: books.isbn13,
        authors: sql<string | null>`(select string_agg(a.name, ', ' order by ba.position) from book_authors ba join authors a on a.id = ba.author_id where ba.book_id = ${books.id})`,
        listings: sql<number>`(select count(*)::int from listings l where l.book_id = ${books.id} and l.status = 'active')`,
        sold: sql<number>`(select count(*)::int from order_items oi where oi.book_id = ${books.id})`,
        busy: bookInUse(sql`${books.id}`),
        createdAt: books.createdAt,
      })
      .from(books)
      .where(like ? or(ilike(books.title, like), ilike(books.searchText, like), eq(books.isbn13, data.q ?? '')) : undefined)
      .orderBy(desc(books.createdAt))
      .limit(100)
  })

/**
 * Removes a book with its listings, offers and author links. Past orders keep their title and price.
 * Its cover goes too, unless another book shares the image.
 */
export const deleteBook = createServerFn({ method: 'POST' })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ bookId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const db = getDb()
    const [busy] = await db.execute<{ busy: boolean }>(sql`select ${bookInUse(sql`${data.bookId}::uuid`)} as busy`)
    if (busy?.busy) throw new Error('It has an order or offer in progress. Wait until that’s settled.')
    const [deleted] = await db.delete(books).where(eq(books.id, data.bookId)).returning({ coverUrl: books.coverUrl })
    if (!deleted) throw new Error('Already deleted')
    const key = deleted.coverUrl?.startsWith('/covers/') ? deleted.coverUrl.slice('/covers/'.length) : null
    if (key) {
      const [shared] = await db.select({ id: books.id }).from(books).where(eq(books.coverUrl, deleted.coverUrl as string)).limit(1)
      if (!shared) await env.COVERS.delete(key)
    }
    return { ok: true }
  })

export const listRefunds = createServerFn({ method: 'GET' })
  .middleware([requireAdminMiddleware])
  .handler(async () => {
    return getDb()
      .select({
        id: refunds.id,
        amountNgwee: refunds.amountNgwee,
        reason: refunds.reason,
        status: refunds.status,
        phone: refunds.phone,
        failureReason: refunds.failureReason,
        attempts: refunds.attempts,
        createdAt: refunds.createdAt,
        orderNumber: orders.number,
        buyerEmail: profiles.email,
        storeName: sellers.storeName,
      })
      .from(refunds)
      .innerJoin(sellerOrders, eq(sellerOrders.id, refunds.sellerOrderId))
      .innerJoin(orders, eq(orders.id, sellerOrders.orderId))
      .innerJoin(profiles, eq(profiles.id, orders.buyerId))
      .innerJoin(sellers, eq(sellers.id, sellerOrders.sellerId))
      // What needs a person first: card refunds to send by hand, then anything still moving.
      .orderBy(sql`${refunds.status} = 'manual' desc`, sql`${refunds.status} in ('processing', 'failed') desc`, desc(refunds.createdAt))
      .limit(100)
  })

/** After refunding a card payment in the Lenco dashboard, admin records it here. */
export const markRefundDone = createServerFn({ method: 'POST' })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const [row] = await getDb()
      .update(refunds)
      .set({ status: 'done_manually' })
      .where(and(eq(refunds.id, data.id), inArray(refunds.status, ['manual', 'failed'])))
      .returning({ id: refunds.id })
    if (!row) throw new Error('This refund isn’t waiting on you')
    return { ok: true }
  })
