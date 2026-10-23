import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import { books, categories, listings, profiles, sellerOrders, sellers } from '#/db/schema'
import { PROVINCES } from '#/data/zambia'
import { normalizeLocalPhone } from '#/lib/phone'
import { toNgwee } from '#/lib/money'
import { randomCode, slugify } from '#/lib/utils'
import { requireSellerMiddleware, requireUserMiddleware } from '#/server/auth'
import { lookupIsbn, searchExternal } from '#/server/book-sources.server'
import { findCatalogueMatches, findOrCreateBook } from '#/server/catalog.server'
import { attemptPayout } from '#/server/orders.server'
import { createMobileMoneyRecipient, resolveMobileMoney } from '#/server/lenco.server'
import { toIsbn13 } from '#/lib/isbn'
import { ownedCoverUrl } from '#/server/covers.server'

const phoneSchema = z.string().transform((value, ctx) => {
  const local = normalizeLocalPhone(value)
  if (!local) {
    ctx.addIssue({ code: 'custom', message: 'Enter a Zambian mobile number, e.g. 0971234567' })
    return z.NEVER
  }
  return local
})

export const getMySeller = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .handler(async ({ context }) => {
    const db = getDb()
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, context.user.id)).limit(1)
    const [seller] = await db.select().from(sellers).where(eq(sellers.profileId, context.user.id)).limit(1)
    return {
      profile: profile ? { displayName: profile.displayName, phone: profile.phone, town: profile.town, province: profile.province } : null,
      seller: seller
        ? {
            slug: seller.slug,
            storeName: seller.storeName,
            kind: seller.kind,
            bio: seller.bio,
            phone: seller.phone,
            town: seller.town,
            province: seller.province,
            verified: seller.verifiedAt !== null,
            payoutMethod: seller.payoutMethod,
            payoutPhone: seller.payoutPhone,
            payoutOperator: seller.payoutOperator,
            payoutAccountName: seller.payoutAccountName,
            deliveryMethods: seller.deliveryMethods,
            freeDeliveryOverNgwee: seller.freeDeliveryOverNgwee,
          }
        : null,
    }
  })

export const saveSellerProfile = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(
    z.object({
      storeName: z.string().trim().min(2).max(60),
      kind: z.enum(['individual', 'author', 'bookshop', 'publisher']),
      bio: z.string().trim().max(600).optional(),
      phone: phoneSchema,
      town: z.string().trim().min(2).max(60),
      province: z.enum(PROVINCES),
    }),
  )
  .handler(async ({ data, context }) => {
    const db = getDb()
    const [existing] = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.profileId, context.user.id)).limit(1)
    const values = { storeName: data.storeName, kind: data.kind, bio: data.bio || null, phone: data.phone, town: data.town, province: data.province }
    if (existing) {
      await db.update(sellers).set(values).where(eq(sellers.id, existing.id))
    } else {
      const base = slugify(data.storeName) || 'shop'
      const [taken] = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.slug, base)).limit(1)
      await db.insert(sellers).values({ ...values, profileId: context.user.id, slug: taken ? `${base}-${randomCode(4)}` : base })
    }
    await db.update(profiles).set({ phone: data.phone, town: data.town, province: data.province }).where(eq(profiles.id, context.user.id))
    return { ok: true }
  })

export const saveDeliverySettings = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(
    z.object({
      methods: z.array(z.enum(['courier', 'bus_parcel', 'zampost', 'collect'])).min(1, 'Choose at least one way to send books'),
      freeOverKwacha: z.number().min(0).max(100000).nullable(),
    }),
  )
  .handler(async ({ data, context }) => {
    await getDb()
      .update(sellers)
      .set({
        deliveryMethods: [...new Set(data.methods)],
        freeDeliveryOverNgwee: data.freeOverKwacha === null ? null : toNgwee(data.freeOverKwacha),
      })
      .where(eq(sellers.id, context.seller.id))
    return { ok: true }
  })

export const findBookForSale = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .validator(z.object({ query: z.string().trim().min(2).max(200) }))
  .handler(async ({ data }) => {
    const db = getDb()
    const catalogue = await findCatalogueMatches(db, data.query)
    const known = new Set(catalogue.map((b) => b.isbn13).filter(Boolean))
    let external = toIsbn13(data.query) ? (catalogue.length ? [] : [await lookupIsbn(data.query)].filter((b) => b !== null)) : await searchExternal(data.query)
    external = external.filter((b) => !b.isbn13 || !known.has(b.isbn13))
    return { catalogue, external }
  })

const candidateSchema = z.object({
  isbn13: z.string().nullable(),
  isbn10: z.string().nullable(),
  title: z.string().trim().min(1).max(300),
  subtitle: z.string().max(300).nullable(),
  authors: z.array(z.string().trim().min(1).max(120)).max(10),
  description: z.string().max(8000).nullable(),
  coverUrl: z.string().url().nullable(),
  publisher: z.string().max(200).nullable(),
  publishedYear: z.number().int().min(1450).max(2100).nullable(),
  pageCount: z.number().int().min(1).max(10000).nullable(),
  language: z.string().max(8),
})

export const createListing = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(
    z.object({
      book: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('existing'), bookId: z.string().uuid() }),
        z.object({ kind: z.literal('external'), source: z.enum(['google', 'openlibrary']), candidate: candidateSchema }),
        z.object({ kind: z.literal('manual'), candidate: candidateSchema }),
      ]),
      categorySlug: z.string().max(80).optional(),
      zambianAuthor: z.boolean(),
      format: z.enum(['paperback', 'hardcover']),
      condition: z.enum(['new', 'like_new', 'very_good', 'good', 'acceptable']),
      priceKwacha: z.number().min(5).max(100000),
      quantity: z.number().int().min(1).max(10000),
      notes: z.string().trim().max(500).optional(),
      // A photo the seller uploaded through uploadCover.
      coverKey: z.string().max(64).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const db = getDb()
    let bookId: string
    let slug: string
    const uploadedCover = data.coverKey ? await ownedCoverUrl(data.coverKey, context.user.id) : null
    if (data.coverKey && !uploadedCover) throw new Error('That photo didn’t upload. Add it again.')

    if (data.book.kind === 'existing') {
      const [book] = await db.select({ id: books.id, slug: books.slug }).from(books).where(eq(books.id, data.book.bookId)).limit(1)
      if (!book) throw new Error('Book not found')
      ;({ id: bookId, slug } = book)
    } else {
      const [category] = data.categorySlug ? await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, data.categorySlug)).limit(1) : []
      const candidate = data.book.candidate
      const isbn13 = candidate.isbn13 ? toIsbn13(candidate.isbn13) : null
      if (candidate.isbn13 && !isbn13) throw new Error('That ISBN doesn’t look right')
      const book = await findOrCreateBook(db, {
        candidate: { ...candidate, isbn13, source: data.book.kind === 'manual' ? 'manual' : data.book.source },
        categoryId: category?.id ?? null,
        markZambian: data.zambianAuthor,
        createdBy: context.user.id,
      })
      ;({ id: bookId, slug } = book)
    }

    // Fills a missing cover only; replacing an existing one is for the book's verified author.
    if (uploadedCover) {
      await db.update(books).set({ coverUrl: uploadedCover }).where(and(eq(books.id, bookId), isNull(books.coverUrl)))
    }

    await db.insert(listings).values({
      bookId,
      sellerId: context.seller.id,
      format: data.format,
      condition: data.condition,
      priceNgwee: toNgwee(data.priceKwacha),
      quantity: data.quantity,
      notes: data.notes || null,
    })
    return { slug }
  })

export const getPriceGuide = createServerFn({ method: 'GET' })
  .validator(z.object({ bookId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const [row] = await getDb()
      .select({
        newMin: sql<number | null>`min(${listings.priceNgwee}) filter (where ${listings.condition} = 'new')`,
        usedMin: sql<number | null>`min(${listings.priceNgwee}) filter (where ${listings.condition} <> 'new')`,
        count: sql<number>`count(*)::int`,
      })
      .from(listings)
      .where(and(eq(listings.bookId, data.bookId), eq(listings.status, 'active')))
    return row
  })

export const getMyListings = createServerFn({ method: 'GET' })
  .middleware([requireSellerMiddleware])
  .handler(async ({ context }) => {
    return getDb()
      .select({
        id: listings.id,
        format: listings.format,
        condition: listings.condition,
        priceNgwee: listings.priceNgwee,
        quantity: listings.quantity,
        status: listings.status,
        createdAt: listings.createdAt,
        book: { slug: books.slug, title: books.title, coverUrl: books.coverUrl },
      })
      .from(listings)
      .innerJoin(books, eq(books.id, listings.bookId))
      .where(and(eq(listings.sellerId, context.seller.id), inArray(listings.status, ['active', 'paused', 'sold_out'])))
      .orderBy(desc(listings.createdAt))
  })

export const updateListing = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(
    z.object({
      id: z.string().uuid(),
      priceKwacha: z.number().min(5).max(100000),
      quantity: z.number().int().min(0).max(10000),
      status: z.enum(['active', 'paused', 'removed']),
    }),
  )
  .handler(async ({ data, context }) => {
    const status = data.status === 'active' && data.quantity === 0 ? 'sold_out' : data.status
    const [updated] = await getDb()
      .update(listings)
      .set({ priceNgwee: toNgwee(data.priceKwacha), quantity: data.quantity, status })
      .where(and(eq(listings.id, data.id), eq(listings.sellerId, context.seller.id)))
      .returning({ id: listings.id })
    if (!updated) throw new Error('Listing not found')
    return { ok: true }
  })

export const savePayoutDetails = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(z.object({ phone: phoneSchema, operator: z.enum(['mtn', 'airtel', 'zamtel']) }))
  .handler(async ({ data, context }) => {
    const resolved = await resolveMobileMoney(data.phone, data.operator).catch(() => null)
    if (!resolved) throw new Error('We couldn’t find a mobile money account on that number')
    const recipient = await createMobileMoneyRecipient(data.phone, data.operator)
    const db = getDb()
    await db
      .update(sellers)
      .set({
        payoutMethod: 'mobile_money',
        payoutPhone: data.phone,
        payoutOperator: data.operator,
        payoutAccountName: resolved.accountName,
        lencoRecipientId: recipient.id,
      })
      .where(eq(sellers.id, context.seller.id))

    // Anything that was waiting on payout details (or failed before) can go now.
    const waiting = await db
      .select({ id: sellerOrders.id })
      .from(sellerOrders)
      .where(and(eq(sellerOrders.sellerId, context.seller.id), inArray(sellerOrders.payoutStatus, ['released', 'failed'])))
    for (const row of waiting) {
      await db.update(sellerOrders).set({ payoutStatus: 'released' }).where(eq(sellerOrders.id, row.id))
      await attemptPayout(db, row.id)
    }
    return { accountName: resolved.accountName }
  })
