import { and, asc, desc, eq, gt, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { authorDrafts, authorMilestones, authors, bookAuthors, books, categories, listings, offers, profiles, publishers, reviews, sellers } from '#/db/schema'
import type { DirectoryKind } from '#/data/directory'
import { toIsbn13 } from '#/lib/isbn'
import { randomCode, slugify } from '#/lib/utils'
import type { BookCandidate } from './book-sources.server'
import { authorReaders } from './tiers.server'
import { readerStandings, shopRatings } from './reputation.server'
import { REVIEW_LIMITS } from '#/data/reputation'
import { TIERS } from '#/data/tiers'

export interface BookCard {
  id: string
  slug: string
  title: string
  coverUrl: string | null
  isZambian: boolean
  authorNames: string | null
  fromPriceNgwee: number | null
  offerCount: number
}

const authorNamesSql = sql<string | null>`(
  select string_agg(a.name, ', ' order by ba.position)
  from ${bookAuthors} ba join ${authors} a on a.id = ba.author_id
  where ba.book_id = ${books}.id
)`

// Copies held for buyers whose offers were accepted aren't for sale to anyone else.
const heldCopies = sql<number>`(select count(*)::int from ${offers} o where o.listing_id = ${listings.id} and o.status = 'accepted' and o.expires_at > now())`

export function offersSubquery(db: Db, condition?: string) {
  const where = [eq(listings.status, 'active'), gt(listings.quantity, 0)]
  if (condition === 'new') where.push(eq(listings.condition, 'new'))
  if (condition === 'used') where.push(ne(listings.condition, 'new'))
  return db
    .select({
      bookId: listings.bookId,
      fromPrice: sql<number>`min(${listings.priceNgwee})::int`.as('from_price'),
      offerCount: sql<number>`count(*)::int`.as('offer_count'),
      latestAt: sql<Date>`max(${listings.createdAt})`.as('latest_at'),
    })
    .from(listings)
    .where(and(...where))
    .groupBy(listings.bookId)
    .as('offers')
}

export function cardColumns(offers: ReturnType<typeof offersSubquery>) {
  return {
    id: books.id,
    slug: books.slug,
    title: books.title,
    coverUrl: books.coverUrl,
    isZambian: books.isZambian,
    authorNames: authorNamesSql,
    fromPriceNgwee: offers.fromPrice,
    offerCount: sql<number>`coalesce(${offers.offerCount}, 0)::int`,
  }
}

export async function shelf(db: Db, kind: 'zambian' | 'recent' | 'bargains', limit = 12): Promise<BookCard[]> {
  const offers = offersSubquery(db, kind === 'bargains' ? 'used' : undefined)
  const where: SQL[] = []
  if (kind === 'zambian') where.push(eq(books.isZambian, true))
  if (kind === 'bargains') where.push(sql`${offers.fromPrice} <= 10000`)
  return db
    .select(cardColumns(offers))
    .from(books)
    .innerJoin(offers, eq(offers.bookId, books.id))
    .where(and(...where))
    .orderBy(kind === 'bargains' ? asc(offers.fromPrice) : desc(offers.latestAt))
    .limit(limit)
}

export interface SearchParams {
  q?: string
  /** One section slug, or several separated by commas. */
  category?: string
  zambian?: boolean
  condition?: 'new' | 'used'
  /** One language code, or several separated by commas. */
  language?: string
  /** Kwacha bounds on a book's cheapest copy. */
  min?: number
  max?: number
  sort?: 'relevance' | 'price' | 'newest'
  page?: number
  /** Match misspellings by trigram similarity instead of exact words. */
  fuzzy?: boolean
  limit?: number
}

export const PAGE_SIZE = 24

// How much of the typed text must resemble some stretch of a book's title, authors and ISBNs (0 to 1).
const FUZZY_THRESHOLD = 0.45
// pg_trgm lives in Supabase's extensions schema; named in full so it doesn't depend on the search path.
const fuzzyScore = (q: string) => sql<number>`extensions.word_similarity(${q}, ${books.searchText})`

export function listParam(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

export async function searchBooks(db: Db, params: SearchParams) {
  const offers = offersSubquery(db, params.condition)
  const where: SQL[] = []
  const q = params.q?.trim()
  let rank: SQL<number> = sql`0`

  if (q) {
    const isbn = toIsbn13(q)
    if (isbn) {
      where.push(eq(books.isbn13, isbn))
    } else if (params.fuzzy) {
      where.push(sql`${fuzzyScore(q)} >= ${FUZZY_THRESHOLD}`)
      rank = fuzzyScore(q)
    } else {
      const tsQuery = sql`websearch_to_tsquery('simple', ${q})`
      const match = or(sql`${books.searchVector} @@ ${tsQuery}`, ilike(books.title, `%${q}%`))
      if (match) where.push(match)
      rank = sql<number>`ts_rank(${books.searchVector}, ${tsQuery})`
    }
  }
  const sections = listParam(params.category)
  if (sections.length) {
    where.push(inArray(books.categoryId, db.select({ id: categories.id }).from(categories).where(inArray(categories.slug, sections))))
  }
  if (params.zambian) where.push(eq(books.isZambian, true))
  const languages = listParam(params.language)
  if (languages.length) where.push(inArray(books.language, languages))
  if (params.min !== undefined) where.push(sql`${offers.fromPrice} >= ${Math.round(params.min * 100)}`)
  if (params.max !== undefined) where.push(sql`${offers.fromPrice} <= ${Math.round(params.max * 100)}`)
  // A condition filter only makes sense against books someone is actually selling.
  if (params.condition) where.push(sql`${offers.bookId} is not null`)

  const inStockFirst = sql`(${offers.bookId} is null)`
  const order =
    params.sort === 'price'
      ? [inStockFirst, asc(offers.fromPrice)]
      : params.sort === 'newest'
        ? [inStockFirst, desc(offers.latestAt)]
        : // Relevance: in stock first, then text rank, with Zambian titles nudged up.
          [inStockFirst, desc(sql`${rank} + case when ${books.isZambian} then 0.1 else 0 end`), desc(offers.latestAt)]

  const page = Math.max(1, params.page ?? 1)
  const rows = await db
    .select({ ...cardColumns(offers), total: sql<number>`count(*) over ()::int` })
    .from(books)
    .leftJoin(offers, eq(offers.bookId, books.id))
    .where(and(...where))
    .orderBy(...order)
    .limit(params.limit ?? PAGE_SIZE)
    .offset((page - 1) * (params.limit ?? PAGE_SIZE))

  return { results: rows.map(({ total: _total, ...card }) => card as BookCard), total: rows[0]?.total ?? 0, page }
}

export async function getBookBySlug(db: Db, slug: string) {
  const [book] = await db
    .select({ book: books, category: { slug: categories.slug, name: categories.name }, publisherSlug: publishers.slug })
    .from(books)
    .leftJoin(categories, eq(categories.id, books.categoryId))
    .leftJoin(publishers, eq(publishers.id, books.publisherId))
    .where(eq(books.slug, slug))
    .limit(1)
  if (!book) return null

  const [bookAuthorRows, offerRows] = await Promise.all([
    db
      .select({
        id: authors.id,
        slug: authors.slug,
        name: authors.name,
        isZambian: authors.isZambian,
        bio: authors.bio,
        photoUrl: authors.photoUrl,
        verified: sql<boolean>`${authors.verifiedSellerId} is not null`,
        // The author's own shop, so the page can mark their copies and offer them an edit link.
        shopSlug: sellers.slug,
      })
      .from(bookAuthors)
      .innerJoin(authors, eq(authors.id, bookAuthors.authorId))
      .leftJoin(sellers, eq(sellers.id, authors.verifiedSellerId))
      .where(eq(bookAuthors.bookId, book.book.id))
      .orderBy(asc(bookAuthors.position)),
    db
      .select({
        id: listings.id,
        format: listings.format,
        condition: listings.condition,
        priceNgwee: listings.priceNgwee,
        quantity: sql<number>`(${listings.quantity} - ${heldCopies})::int`,
        notes: listings.notes,
        photos: listings.photos,
        acceptsOffers: listings.acceptsOffers,
        seller: {
          id: sellers.id,
          slug: sellers.slug,
          storeName: sellers.storeName,
          kind: sellers.kind,
          town: sellers.town,
          province: sellers.province,
          verified: sql<boolean>`${sellers.verifiedAt} is not null`,
          official: sellers.official,
          deliveryMethods: sellers.deliveryMethods,
          freeDeliveryOverNgwee: sellers.freeDeliveryOverNgwee,
        },
      })
      .from(listings)
      .innerJoin(sellers, eq(sellers.id, listings.sellerId))
      .where(and(eq(listings.bookId, book.book.id), eq(listings.status, 'active'), sql`${listings.quantity} > ${heldCopies}`))
      .orderBy(asc(listings.priceNgwee)),
  ])

  let related: BookCard[] = []
  if (book.book.categoryId) {
    const offers = offersSubquery(db)
    related = await db
      .select(cardColumns(offers))
      .from(books)
      .innerJoin(offers, eq(offers.bookId, books.id))
      .where(and(eq(books.categoryId, book.book.categoryId), ne(books.id, book.book.id)))
      .orderBy(desc(books.isZambian), desc(offers.latestAt))
      .limit(6)
  }

  // The author's other books, in stock first: what a reader who liked this one looks for next.
  let moreByAuthor: BookCard[] = []
  if (bookAuthorRows.length) {
    const offers = offersSubquery(db)
    const rows = await db
      .select(cardColumns(offers))
      .from(books)
      .innerJoin(bookAuthors, eq(bookAuthors.bookId, books.id))
      .leftJoin(offers, eq(offers.bookId, books.id))
      .where(and(inArray(bookAuthors.authorId, bookAuthorRows.map((a) => a.id)), ne(books.id, book.book.id)))
      .orderBy(sql`${offers.bookId} is null`, desc(books.publishedYear))
      .limit(12)
    // A book co-written by two of these authors comes back once per author.
    moreByAuthor = [...new Map(rows.map((b) => [b.id, b])).values()].slice(0, 8)
  }

  const authorShops = new Set(bookAuthorRows.map((a) => a.shopSlug).filter(Boolean))
  const ratings = await shopRatings(db, [...new Set(offerRows.map((o) => o.seller.id))])
  const offers = offerRows.map((o) => ({ ...o, fromAuthor: authorShops.has(o.seller.slug), seller: { ...o.seller, rating: ratings.get(o.seller.id) ?? null } }))
  const bookReviews = await getBookReviews(db, book.book.id)
  return { ...book.book, category: book.category, publisherSlug: book.publisherSlug, authors: bookAuthorRows, offers, related, moreByAuthor, reviews: bookReviews }
}

/** Visible reviews, newest first, with each reviewer's first name and reader badge; plus the average over all of them. */
async function getBookReviews(db: Db, bookId: string) {
  const visible = and(eq(reviews.bookId, bookId), isNull(reviews.hiddenAt))
  const [rows, [summary]] = await Promise.all([
    db
      .select({
        id: reviews.id,
        score: reviews.score,
        body: reviews.body,
        createdAt: reviews.createdAt,
        profileId: reviews.profileId,
        name: profiles.displayName,
        verified: sql<boolean>`${reviews.sellerOrderId} is not null`,
      })
      .from(reviews)
      .leftJoin(profiles, eq(profiles.id, reviews.profileId))
      .where(visible)
      .orderBy(sql`${reviews.body} is null`, desc(reviews.createdAt))
      .limit(REVIEW_LIMITS.shown),
    db.select({ average: sql<number | null>`round(avg(${reviews.score}), 1)::float`, count: sql<number>`count(*)::int` }).from(reviews).where(visible),
  ])
  const standings = await readerStandings(db, rows.flatMap((r) => (r.profileId ? [r.profileId] : [])))
  return {
    average: summary?.count ? summary.average : null,
    count: summary?.count ?? 0,
    // A null reviewer is a deleted account; the page says so.
    items: rows.map(({ profileId, name, ...r }) => ({ ...r, reviewer: name ? name.split(' ')[0] : null, badge: profileId ? (standings.get(profileId)?.badge ?? null) : null })),
  }
}

export async function getAuthorBySlug(db: Db, slug: string) {
  const [row] = await db
    .select({ author: authors, shop: { id: sellers.id, slug: sellers.slug, storeName: sellers.storeName, town: sellers.town } })
    .from(authors)
    .leftJoin(sellers, eq(sellers.id, authors.verifiedSellerId))
    .where(eq(authors.slug, slug))
    .limit(1)
  if (!row) return null
  const { author, shop } = row
  const offers = offersSubquery(db)
  const authorBooks = await db
    .select({
      ...cardColumns(offers),
      publishedYear: books.publishedYear,
      // In stock at the author's own shop: these sell direct.
      direct: shop
        ? sql<boolean>`exists (select 1 from ${listings} l where l.book_id = ${books.id} and l.seller_id = ${shop.id} and l.status = 'active' and l.quantity > 0)`
        : sql<boolean>`false`,
    })
    .from(books)
    .innerJoin(bookAuthors, eq(bookAuthors.bookId, books.id))
    .leftJoin(offers, eq(offers.bookId, books.id))
    .where(eq(bookAuthors.authorId, author.id))
    .orderBy(sql`${offers.bookId} is null`, desc(books.publishedYear))
  const [milestones, readers, research] = await Promise.all([
    db
      .select({ tier: authorMilestones.tier, reachedAt: authorMilestones.reachedAt })
      .from(authorMilestones)
      .where(eq(authorMilestones.authorId, author.id))
      .orderBy(asc(authorMilestones.reachedAt)),
    shop ? authorReaders(db, author.id) : 0,
    // Pages Kuwala researched say so, with sources, until the author claims them.
    shop ? [] : db.select({ sources: authorDrafts.sources }).from(authorDrafts).where(eq(authorDrafts.authorId, author.id)).limit(1),
  ])
  const { verifiedSellerId: _seller, ...publicAuthor } = author
  return {
    ...publicAuthor,
    milestones,
    sources: research[0]?.sources ?? null,
    // Only shown once it's a number worth saying out loud.
    readers: readers >= TIERS[0].readers ? readers : null,
    shop: shop ? { slug: shop.slug, storeName: shop.storeName, town: shop.town } : null,
    books: authorBooks.map(({ direct: _direct, publishedYear: _year, ...card }) => card),
    direct: authorBooks.filter((b) => b.direct).map(({ direct: _direct, publishedYear: _year, ...card }) => card),
    years: yearSpan(authorBooks.map((b) => b.publishedYear)),
  }
}

export async function getPublisherBySlug(db: Db, slug: string) {
  const [row] = await db
    .select({ publisher: publishers, shop: { slug: sellers.slug, storeName: sellers.storeName, town: sellers.town } })
    .from(publishers)
    .leftJoin(sellers, eq(sellers.id, publishers.verifiedSellerId))
    .where(eq(publishers.slug, slug))
    .limit(1)
  if (!row) return null
  const offers = offersSubquery(db)
  const publisherBooks = await db
    .select({ ...cardColumns(offers), publishedYear: books.publishedYear })
    .from(books)
    .leftJoin(offers, eq(offers.bookId, books.id))
    .where(eq(books.publisherId, row.publisher.id))
    .orderBy(sql`${offers.bookId} is null`, desc(books.publishedYear))
  const { verifiedSellerId: _seller, ...publicPublisher } = row.publisher
  return {
    ...publicPublisher,
    shop: row.shop?.slug ? row.shop : null,
    books: publisherBooks.map(({ publishedYear: _year, ...card }) => card),
    years: yearSpan(publisherBooks.map((b) => b.publishedYear)),
  }
}

const directoryTables = {
  authors: {
    table: authors,
    bookCount: sql<number>`(select count(*)::int from ${bookAuthors} ba where ba.author_id = ${authors}.id)`,
    // The highest plaque: tiers are listed copper to gold, so the enum's order is the ranking.
    tier: sql<'copper' | 'emerald' | 'gold' | null>`(select max(m.tier) from ${authorMilestones} m where m.author_id = ${authors}.id)`,
  },
  publishers: {
    table: publishers,
    bookCount: sql<number>`(select count(*)::int from ${books} b where b.publisher_id = ${publishers}.id)`,
    tier: sql<null>`null`,
  },
}

/** Authors or publishers with at least one book, A–Z; `query` matches any part of the name. */
export async function listDirectory(db: Db, kind: DirectoryKind, params: { query?: string; zambian?: boolean; verified?: boolean; tier?: 'copper' | 'emerald' | 'gold'; limit?: number }) {
  const { table, bookCount, tier } = directoryTables[kind]
  const where = [sql`${bookCount} > 0`]
  if (params.query) where.push(ilike(table.name, `%${params.query}%`))
  if (params.zambian) where.push(eq(table.isZambian, true))
  if (params.verified) where.push(sql`${table.verifiedSellerId} is not null`)
  // "Emerald" means Emerald and up.
  if (params.tier && kind === 'authors') where.push(sql`exists (select 1 from ${authorMilestones} m where m.author_id = ${authors}.id and m.tier >= ${params.tier}::author_tier)`)
  return db
    .select({ slug: table.slug, name: table.name, isZambian: table.isZambian, verified: sql<boolean>`${table.verifiedSellerId} is not null`, bookCount, tier })
    .from(table)
    .where(and(...where))
    .orderBy(asc(sql`lower(${table.name})`))
    .limit(params.limit ?? 500)
}

/** Names for the listing form as a seller types: names starting with the text first, then the best-stocked. */
export async function suggestNames(db: Db, kind: DirectoryKind, query: string) {
  const { table, bookCount } = directoryTables[kind]
  return db
    .select({ name: table.name, isZambian: table.isZambian, bookCount })
    .from(table)
    .where(ilike(table.name, `%${query}%`))
    .orderBy(sql`${table.name} ilike ${`${query}%`} desc`, desc(bookCount), asc(table.name))
    .limit(6)
}

function yearSpan(years: (number | null)[]) {
  const known = years.filter((y): y is number => y !== null)
  if (!known.length) return null
  const [first, last] = [Math.min(...known), Math.max(...known)]
  return first === last ? String(first) : `${first}–${last}`
}

/** Title, subtitle, author names and ISBNs, which feed the generated search vector. */
export async function refreshSearchText(db: Db, bookId: string) {
  await db
    .update(books)
    .set({
      searchText: sql`concat_ws(' ', ${books.title}, ${books.subtitle}, (
        select string_agg(a.name, ' ' order by ba.position)
        from ${bookAuthors} ba join ${authors} a on a.id = ba.author_id
        where ba.book_id = ${books}.id
      ), ${books.isbn13}, ${books.isbn10})`,
    })
    .where(eq(books.id, bookId))
}

export async function getSellerBySlug(db: Db, slug: string) {
  const [seller] = await db
    .select({
      id: sellers.id,
      slug: sellers.slug,
      storeName: sellers.storeName,
      kind: sellers.kind,
      bio: sellers.bio,
      photoUrl: sellers.photoUrl,
      town: sellers.town,
      province: sellers.province,
      verified: sql<boolean>`${sellers.verifiedAt} is not null`,
      official: sellers.official,
      createdAt: sellers.createdAt,
    })
    .from(sellers)
    .where(eq(sellers.slug, slug))
    .limit(1)
  if (!seller) return null
  const offers = db
    .select({
      bookId: listings.bookId,
      fromPrice: sql<number>`min(${listings.priceNgwee})::int`.as('from_price'),
      offerCount: sql<number>`count(*)::int`.as('offer_count'),
      latestAt: sql<Date>`max(${listings.createdAt})`.as('latest_at'),
    })
    .from(listings)
    .where(and(eq(listings.sellerId, seller.id), eq(listings.status, 'active'), gt(listings.quantity, 0)))
    .groupBy(listings.bookId)
    .as('offers')
  const [sellerBooks, ratings] = await Promise.all([
    db.select(cardColumns(offers)).from(books).innerJoin(offers, eq(offers.bookId, books.id)).orderBy(desc(offers.latestAt)),
    shopRatings(db, [seller.id]),
  ])
  return { ...seller, rating: ratings.get(seller.id) ?? null, books: sellerBooks }
}

export async function categoriesWithCounts(db: Db) {
  return db
    .select({
      slug: categories.slug,
      name: categories.name,
      count: sql<number>`(select count(*)::int from ${books} b where b.category_id = ${categories}.id)`,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder))
}

export async function uniqueSlug(db: Db, table: typeof books | typeof authors, base: string) {
  const slug = base || 'book'
  const [taken] = await db.select({ id: table.id }).from(table).where(eq(table.slug, slug)).limit(1)
  return taken ? `${slug}-${randomCode(4)}` : slug
}

// Existing authors keep their Zambian flag as-is; a seller's claim only applies to authors new to the catalogue.
async function upsertAuthors(db: Db, names: string[], markZambian: boolean) {
  const ids: string[] = []
  for (const raw of names) {
    const name = raw.trim()
    if (!name) continue
    const slug = slugify(name)
    const [existing] = await db.select({ id: authors.id }).from(authors).where(eq(authors.slug, slug)).limit(1)
    if (existing) {
      ids.push(existing.id)
      continue
    }
    const [created] = await db.insert(authors).values({ slug, name, isZambian: markZambian }).returning({ id: authors.id })
    ids.push(created.id)
  }
  return ids
}

/** The publisher's id for a printed name, adding the publisher on first sight. Same slug, same publisher. */
export async function upsertPublisher(db: Db, raw: string | null) {
  const name = raw?.trim()
  const slug = name ? slugify(name) : ''
  if (!name || !slug) return null
  const [created] = await db.insert(publishers).values({ slug, name }).onConflictDoNothing({ target: publishers.slug }).returning({ id: publishers.id })
  if (created) return created.id
  const [existing] = await db.select({ id: publishers.id }).from(publishers).where(eq(publishers.slug, slug)).limit(1)
  return existing?.id ?? null
}

export interface NewBookInput {
  candidate: Omit<BookCandidate, 'source'> & { source: 'google' | 'openlibrary' | 'manual' }
  categoryId: string | null
  markZambian: boolean
  createdBy: string
}

/** Returns the existing book for a known ISBN, otherwise adds it to the catalogue. */
export async function findOrCreateBook(db: Db, input: NewBookInput) {
  const { candidate } = input
  if (candidate.isbn13) {
    const [existing] = await db.select({ id: books.id, slug: books.slug }).from(books).where(eq(books.isbn13, candidate.isbn13)).limit(1)
    if (existing) return existing
  }

  const authorIds = await upsertAuthors(db, candidate.authors, input.markZambian)
  const zambianAuthors = authorIds.length
    ? await db
        .select({ id: authors.id })
        .from(authors)
        .where(and(inArray(authors.id, authorIds), eq(authors.isZambian, true)))
    : []

  const publisherId = await upsertPublisher(db, candidate.publisher)
  const slug = await uniqueSlug(db, books, slugify(`${candidate.title} ${candidate.authors[0] ?? ''}`))
  const searchText = [candidate.title, candidate.subtitle, ...candidate.authors, candidate.isbn13, candidate.isbn10].filter(Boolean).join(' ')

  const [book] = await db
    .insert(books)
    .values({
      slug,
      isbn13: candidate.isbn13,
      isbn10: candidate.isbn10,
      title: candidate.title,
      subtitle: candidate.subtitle,
      description: candidate.description,
      coverUrl: candidate.coverUrl,
      publisher: candidate.publisher,
      publisherId,
      publishedYear: candidate.publishedYear,
      pageCount: candidate.pageCount,
      language: candidate.language,
      categoryId: input.categoryId,
      isZambian: zambianAuthors.length > 0,
      source: candidate.source,
      searchText,
      createdBy: input.createdBy,
    })
    .returning({ id: books.id, slug: books.slug })

  if (authorIds.length) {
    await db.insert(bookAuthors).values(authorIds.map((authorId, position) => ({ bookId: book.id, authorId, position })))
  }
  return book
}

export type CatalogueMatch = Awaited<ReturnType<typeof findCatalogueMatches>>[number]

/** The cheapest copy of each book that can be bought now. */
export async function cheapestCopies(db: Db, bookIds: string[]) {
  if (!bookIds.length) return []
  return db
    .selectDistinctOn([listings.bookId], {
      bookId: listings.bookId,
      listingId: listings.id,
      priceNgwee: listings.priceNgwee,
      condition: listings.condition,
      sellerProfileId: sellers.profileId,
    })
    .from(listings)
    .innerJoin(sellers, eq(sellers.id, listings.sellerId))
    .where(and(inArray(listings.bookId, bookIds), eq(listings.status, 'active'), sql`${listings.quantity} > ${heldCopies}`))
    .orderBy(listings.bookId, asc(listings.priceNgwee))
}

/** Books a seller can list: matches for a query (close spellings if nothing matches), or the whole catalogue A–Z. */
export async function findCatalogueMatches(db: Db, query: string | null, limit = 8) {
  const isbn = query ? toIsbn13(query) : null
  const where = !query
    ? undefined
    : isbn
      ? eq(books.isbn13, isbn)
      : or(sql`${books.searchVector} @@ websearch_to_tsquery('simple', ${query})`, ilike(books.title, `%${query}%`))
  const exact = await catalogueRows(db, where, limit, asc(books.title))
  if (exact.length || !query || isbn) return exact
  return catalogueRows(db, sql`${fuzzyScore(query)} >= ${FUZZY_THRESHOLD}`, limit, desc(fuzzyScore(query)))
}

function catalogueRows(db: Db, where: SQL | undefined, limit: number, order: SQL) {
  return db
    .select({
      id: books.id,
      slug: books.slug,
      title: books.title,
      coverUrl: books.coverUrl,
      isbn13: books.isbn13,
      publishedYear: books.publishedYear,
      authorNames: authorNamesSql,
      hasDescription: sql<boolean>`${books.description} is not null`,
    })
    .from(books)
    .where(where)
    .orderBy(order)
    .limit(limit)
}
