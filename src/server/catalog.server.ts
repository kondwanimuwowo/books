import { and, asc, desc, eq, gt, ilike, inArray, ne, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { authors, bookAuthors, books, categories, listings, sellers } from '#/db/schema'
import { toIsbn13 } from '#/lib/isbn'
import { randomCode, slugify } from '#/lib/utils'
import type { BookCandidate } from './book-sources.server'

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
  where ba.book_id = ${books.id}
)`

function offersSubquery(db: Db, condition?: string) {
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

function cardColumns(offers: ReturnType<typeof offersSubquery>) {
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
  category?: string
  zambian?: boolean
  condition?: 'new' | 'used'
  language?: string
  sort?: 'relevance' | 'price' | 'newest'
  page?: number
}

export const PAGE_SIZE = 24

export async function searchBooks(db: Db, params: SearchParams) {
  const offers = offersSubquery(db, params.condition)
  const where: SQL[] = []
  const q = params.q?.trim()
  let rank: SQL<number> = sql`0`

  if (q) {
    const isbn = toIsbn13(q)
    if (isbn) {
      where.push(eq(books.isbn13, isbn))
    } else {
      const tsQuery = sql`websearch_to_tsquery('simple', ${q})`
      const match = or(sql`${books.searchVector} @@ ${tsQuery}`, ilike(books.title, `%${q}%`))
      if (match) where.push(match)
      rank = sql<number>`ts_rank(${books.searchVector}, ${tsQuery})`
    }
  }
  if (params.category) {
    where.push(sql`${books.categoryId} = (select id from ${categories} where slug = ${params.category})`)
  }
  if (params.zambian) where.push(eq(books.isZambian, true))
  if (params.language) where.push(eq(books.language, params.language))
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
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)

  return { results: rows.map(({ total: _total, ...card }) => card as BookCard), total: rows[0]?.total ?? 0, page }
}

export async function getBookBySlug(db: Db, slug: string) {
  const [book] = await db
    .select({ book: books, category: { slug: categories.slug, name: categories.name } })
    .from(books)
    .leftJoin(categories, eq(categories.id, books.categoryId))
    .where(eq(books.slug, slug))
    .limit(1)
  if (!book) return null

  const [bookAuthorRows, offerRows] = await Promise.all([
    db
      .select({ id: authors.id, slug: authors.slug, name: authors.name, isZambian: authors.isZambian, verified: sql<boolean>`${authors.verifiedSellerId} is not null` })
      .from(bookAuthors)
      .innerJoin(authors, eq(authors.id, bookAuthors.authorId))
      .where(eq(bookAuthors.bookId, book.book.id))
      .orderBy(asc(bookAuthors.position)),
    db
      .select({
        id: listings.id,
        format: listings.format,
        condition: listings.condition,
        priceNgwee: listings.priceNgwee,
        quantity: listings.quantity,
        notes: listings.notes,
        seller: {
          id: sellers.id,
          slug: sellers.slug,
          storeName: sellers.storeName,
          kind: sellers.kind,
          town: sellers.town,
          province: sellers.province,
          verified: sql<boolean>`${sellers.verifiedAt} is not null`,
        },
      })
      .from(listings)
      .innerJoin(sellers, eq(sellers.id, listings.sellerId))
      .where(and(eq(listings.bookId, book.book.id), eq(listings.status, 'active'), gt(listings.quantity, 0)))
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

  return { ...book.book, category: book.category, authors: bookAuthorRows, offers: offerRows, related }
}

export async function getAuthorBySlug(db: Db, slug: string) {
  const [author] = await db.select().from(authors).where(eq(authors.slug, slug)).limit(1)
  if (!author) return null
  const offers = offersSubquery(db)
  const authorBooks = await db
    .select(cardColumns(offers))
    .from(books)
    .innerJoin(bookAuthors, eq(bookAuthors.bookId, books.id))
    .leftJoin(offers, eq(offers.bookId, books.id))
    .where(eq(bookAuthors.authorId, author.id))
    .orderBy(desc(books.publishedYear))
  return { ...author, books: authorBooks }
}

export async function getSellerBySlug(db: Db, slug: string) {
  const [seller] = await db
    .select({
      id: sellers.id,
      slug: sellers.slug,
      storeName: sellers.storeName,
      kind: sellers.kind,
      bio: sellers.bio,
      town: sellers.town,
      province: sellers.province,
      verified: sql<boolean>`${sellers.verifiedAt} is not null`,
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
  const sellerBooks = await db
    .select(cardColumns(offers))
    .from(books)
    .innerJoin(offers, eq(offers.bookId, books.id))
    .orderBy(desc(offers.latestAt))
  return { ...seller, books: sellerBooks }
}

// Towns that currently have books on sale, most stocked first: shows how far the shelves reach.
export async function sellerTowns(db: Db, limit = 8) {
  const rows = await db
    .select({ town: sellers.town, n: sql<number>`count(*)::int` })
    .from(listings)
    .innerJoin(sellers, eq(sellers.id, listings.sellerId))
    .where(and(eq(listings.status, 'active'), gt(listings.quantity, 0)))
    .groupBy(sellers.town)
    .orderBy(sql`count(*) desc`)
    .limit(limit)
  return rows.map((r) => r.town)
}

export async function categoriesWithCounts(db: Db) {
  return db
    .select({
      slug: categories.slug,
      name: categories.name,
      count: sql<number>`(select count(*)::int from ${books} b where b.category_id = ${categories.id})`,
    })
    .from(categories)
    .orderBy(asc(categories.sortOrder))
}

async function uniqueSlug(db: Db, table: typeof books | typeof authors, base: string) {
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
    ? await db.select({ id: authors.id }).from(authors).where(and(inArray(authors.id, authorIds), eq(authors.isZambian, true)))
    : []

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

export async function findCatalogueMatches(db: Db, query: string) {
  const isbn = toIsbn13(query)
  const where = isbn ? eq(books.isbn13, isbn) : or(sql`${books.searchVector} @@ websearch_to_tsquery('simple', ${query})`, ilike(books.title, `%${query}%`))
  return db
    .select({ id: books.id, slug: books.slug, title: books.title, coverUrl: books.coverUrl, isbn13: books.isbn13, publishedYear: books.publishedYear, authorNames: authorNamesSql })
    .from(books)
    .where(where)
    .limit(8)
}
