import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { books, categories, listings, sellers } from '#/db/schema'
import { PHOTOS_COPY } from '#/data/listing-options'
import { toIsbn13 } from '#/lib/isbn'
import { toNgwee } from '#/lib/money'
import type { CreateListingInput, SchoolDetailsInput, UpdateListingInput } from '#/schemas/sell'
import { curriculumFor } from '#/data/school'
import { lookupIsbn, searchExternal } from './book-sources.server'
import { findCatalogueMatches, findOrCreateBook } from './catalog.server'
import { ownedCoverUrl } from './covers.server'
import { AppError } from './errors.server'

type Seller = typeof sellers.$inferSelect

export async function bookDescription(db: Db, bookId: string) {
  const [row] = await db.select({ description: books.description }).from(books).where(eq(books.id, bookId)).limit(1)
  return row?.description ?? null
}

/** The section and children's or school details a book has, so the sell form shows them instead of asking again. */
export async function bookSchoolDetails(db: Db, bookId: string) {
  const [row] = await db
    .select({ categorySlug: categories.slug, ageBands: books.ageBands, levels: books.levels, subject: books.subject, curriculum: books.curriculum })
    .from(books)
    .leftJoin(categories, eq(categories.id, books.categoryId))
    .where(eq(books.id, bookId))
    .limit(1)
  return row ?? null
}

/** Like descriptions: a seller fills what a book is missing, and never overwrites what another seller set. */
async function fillMissingSchoolDetails(db: Db, bookId: string, categoryId: string | null, school: SchoolDetailsInput | undefined) {
  const implied = school ? curriculumFor(school.levels) : null
  const curriculum = school?.curriculum ?? (implied === '2023' || implied === '2013' ? implied : null)
  // Postgres array literals: the values come from fixed lists, so they never hold commas or quotes.
  const pgArray = (values: readonly string[]) => `{${values.join(',')}}`
  await db
    .update(books)
    .set({
      categoryId: sql`coalesce(${books.categoryId}, ${categoryId})`,
      ...(school && {
        ageBands: sql`case when cardinality(${books.ageBands}) = 0 then ${pgArray(school.ageBands)}::text[] else ${books.ageBands} end`,
        levels: sql`case when cardinality(${books.levels}) = 0 then ${pgArray(school.levels)}::text[] else ${books.levels} end`,
        subject: sql`coalesce(${books.subject}, ${school.subject})`,
        // The curriculum goes with the grades: only set alongside them.
        curriculum: sql`case when cardinality(${books.levels}) = 0 then ${curriculum} else ${books.curriculum} end`,
      }),
    })
    .where(eq(books.id, bookId))
}

/** Sellers may add a description only where a book has none; changing one stays with its verified author. */
async function fillMissingDescription(db: Db, bookId: string, description: string | undefined) {
  if (!description) return
  await db.update(books).set({ description }).where(and(eq(books.id, bookId), isNull(books.description)))
}

// Summaries come from Claude reading the seller's back cover; the cron writes the rest.
async function fillMissingSummary(db: Db, bookId: string, summary: string | undefined) {
  if (!summary) return
  await db.update(books).set({ summary }).where(and(eq(books.id, bookId), isNull(books.summary)))
}

/** Books matching what a seller typed: ours first, then outside sources for anything we don't have. */
export async function findBooksToSell(db: Db, query: string) {
  const catalogue = await findCatalogueMatches(db, query)
  const known = new Set(catalogue.map((b) => b.isbn13).filter(Boolean))
  let external = toIsbn13(query) ? (catalogue.length ? [] : [await lookupIsbn(query)].filter((b) => b !== null)) : await searchExternal(query)
  external = external.filter((b) => !b.isbn13 || !known.has(b.isbn13))
  return { catalogue, external }
}

function offerValues(data: { acceptsOffers: boolean; offerFloorKwacha: number | null; priceKwacha: number }) {
  if (data.acceptsOffers && data.offerFloorKwacha !== null && data.offerFloorKwacha >= data.priceKwacha) {
    throw new AppError('The lowest you’ll take should be under your price')
  }
  return { acceptsOffers: data.acceptsOffers, offerFloorNgwee: data.acceptsOffers && data.offerFloorKwacha !== null ? toNgwee(data.offerFloorKwacha) : null }
}

export async function createSellerListing(db: Db, seller: Seller, input: CreateListingInput) {
  const offerSettings = offerValues(input)
  let bookId: string
  let slug: string
  const uploadedCover = input.coverKey ? await ownedCoverUrl(input.coverKey, seller.profileId) : null
  if (input.coverKey && !uploadedCover) throw new AppError('That photo didn’t upload. Add it again.')
  if (input.condition !== 'new' && !input.photoKeys.length) throw new AppError(PHOTOS_COPY.required)
  const copyPhotos = await Promise.all(input.photoKeys.map((key) => ownedCoverUrl(key, seller.profileId)))
  if (copyPhotos.some((url) => !url)) throw new AppError('A photo didn’t upload. Add it again.')

  const [category] = input.categorySlug ? await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, input.categorySlug)).limit(1) : []
  if (input.book.kind === 'existing') {
    const [book] = await db.select({ id: books.id, slug: books.slug }).from(books).where(eq(books.id, input.book.bookId)).limit(1)
    if (!book) throw new AppError('Book not found', 'not_found')
    ;({ id: bookId, slug } = book)
  } else {
    const isbn13 = input.book.candidate.isbn13 ? toIsbn13(input.book.candidate.isbn13) : null
    if (input.book.candidate.isbn13 && !isbn13) throw new AppError('That ISBN doesn’t look right')
    // Open Library search results can carry the work's title; save the picked edition's own details.
    const edition = input.book.kind === 'external' && input.book.source === 'openlibrary' && isbn13 ? await lookupIsbn(isbn13) : null
    const picked = input.book.candidate
    const candidate = edition
      ? {
          ...picked,
          ...edition,
          authors: edition.authors.length ? edition.authors : picked.authors,
          coverUrl: edition.coverUrl ?? picked.coverUrl,
          description: edition.description ?? picked.description,
        }
      : picked
    const book = await findOrCreateBook(db, {
      candidate: { ...candidate, isbn13, description: candidate.description ?? input.description ?? null, source: input.book.kind === 'manual' ? 'manual' : input.book.source },
      categoryId: category?.id ?? null,
      markZambian: input.zambianAuthor,
      createdBy: seller.profileId,
    })
    ;({ id: bookId, slug } = book)
  }

  // An ISBN already on Kuwala comes back as that book, so this runs for new and existing books alike.
  await fillMissingSchoolDetails(db, bookId, category?.id ?? null, input.school)
  await fillMissingDescription(db, bookId, input.description)
  await fillMissingSummary(db, bookId, input.summary)
  // Fills a missing cover only; replacing an existing one is for the book's verified author.
  if (uploadedCover) {
    await db.update(books).set({ coverUrl: uploadedCover }).where(and(eq(books.id, bookId), isNull(books.coverUrl)))
  }

  await db.insert(listings).values({
    bookId,
    sellerId: seller.id,
    format: input.format,
    condition: input.condition,
    priceNgwee: toNgwee(input.priceKwacha),
    quantity: input.quantity,
    notes: input.notes || null,
    photos: copyPhotos as string[],
    ...offerSettings,
  })
  return { slug }
}

export async function priceGuide(db: Db, bookId: string) {
  const [row] = await db
    .select({
      newMin: sql<number | null>`min(${listings.priceNgwee}) filter (where ${listings.condition} = 'new')`,
      usedMin: sql<number | null>`min(${listings.priceNgwee}) filter (where ${listings.condition} <> 'new')`,
      count: sql<number>`count(*)::int`,
    })
    .from(listings)
    .where(and(eq(listings.bookId, bookId), eq(listings.status, 'active')))
  return row
}

export async function listSellerListings(db: Db, sellerId: string) {
  return db
    .select({
      id: listings.id,
      format: listings.format,
      condition: listings.condition,
      priceNgwee: listings.priceNgwee,
      quantity: listings.quantity,
      status: listings.status,
      acceptsOffers: listings.acceptsOffers,
      offerFloorNgwee: listings.offerFloorNgwee,
      photos: listings.photos,
      createdAt: listings.createdAt,
      book: { slug: books.slug, title: books.title, coverUrl: books.coverUrl, isbn13: books.isbn13, hasDescription: sql<boolean>`${books.description} is not null` },
    })
    .from(listings)
    .innerJoin(books, eq(books.id, listings.bookId))
    .where(and(eq(listings.sellerId, sellerId), inArray(listings.status, ['active', 'paused', 'sold_out'])))
    .orderBy(desc(listings.createdAt))
}

export async function updateSellerListing(db: Db, seller: Seller, input: UpdateListingInput) {
  const status = input.status === 'active' && input.quantity === 0 ? 'sold_out' : input.status
  let photos: string[] | undefined
  if (input.photoKeys) {
    const [current] = await db.select({ photos: listings.photos }).from(listings).where(and(eq(listings.id, input.id), eq(listings.sellerId, seller.id))).limit(1)
    // Photos already on this copy stay; new ones must be this seller's uploads.
    const urls = await Promise.all(input.photoKeys.map(async (key) => (current?.photos.includes(`/covers/${key}`) ? `/covers/${key}` : ownedCoverUrl(key, seller.profileId))))
    if (urls.some((url) => !url)) throw new AppError('A photo didn’t upload. Add it again.')
    photos = urls as string[]
  }
  const [updated] = await db
    .update(listings)
    .set({ priceNgwee: toNgwee(input.priceKwacha), quantity: input.quantity, status, ...offerValues(input), ...(photos && { photos }) })
    .where(and(eq(listings.id, input.id), eq(listings.sellerId, seller.id)))
    .returning({ bookId: listings.bookId })
  if (!updated) throw new AppError('Listing not found', 'not_found')
  await fillMissingDescription(db, updated.bookId, input.description)
  return { ok: true }
}
