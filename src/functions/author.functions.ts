import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq, exists, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import type { Db } from '#/db/client.server'
import { authors, bookAuthors, books, categories } from '#/db/schema'
import { LANGUAGES } from '#/data/zambia'
import { requireSellerMiddleware } from '#/server/auth'
import { refreshSearchText, upsertPublisher } from '#/server/catalog.server'
import { ownedCoverUrl } from '#/server/covers.server'

const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as [string, ...string[]]

/** Books with at least one author verified as this shop. */
function authoredBy(db: Db, sellerId: string) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(bookAuthors)
      .innerJoin(authors, eq(authors.id, bookAuthors.authorId))
      .where(and(eq(bookAuthors.bookId, books.id), eq(authors.verifiedSellerId, sellerId))),
  )
}

async function uploadedCover(key: string | undefined, userId: string) {
  if (!key) return undefined
  const url = await ownedCoverUrl(key, userId)
  if (!url) throw new Error('That photo didn’t upload. Add it again.')
  return url
}

export const getMyAuthorship = createServerFn({ method: 'GET' })
  .middleware([requireSellerMiddleware])
  .handler(async ({ context }) => {
    const db = getDb()
    const [pages, bookRows, categoryRows] = await Promise.all([
      db
        .select({ id: authors.id, slug: authors.slug, name: authors.name, bio: authors.bio, photoUrl: authors.photoUrl })
        .from(authors)
        .where(eq(authors.verifiedSellerId, context.seller.id))
        .orderBy(asc(authors.name)),
      db
        .select({
          id: books.id,
          slug: books.slug,
          title: books.title,
          subtitle: books.subtitle,
          description: books.description,
          coverUrl: books.coverUrl,
          publisher: books.publisher,
          publishedYear: books.publishedYear,
          pageCount: books.pageCount,
          language: books.language,
          categorySlug: categories.slug,
        })
        .from(books)
        .leftJoin(categories, eq(categories.id, books.categoryId))
        .where(authoredBy(db, context.seller.id))
        .orderBy(desc(books.publishedYear), asc(books.title)),
      db.select({ slug: categories.slug, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder)),
    ])
    return { pages, books: bookRows, categories: categoryRows }
  })

export const saveAuthorProfile = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(
    z.object({
      authorId: z.string().uuid(),
      bio: z.string().trim().max(2000),
      photoKey: z.string().max(64).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const photoUrl = await uploadedCover(data.photoKey, context.user.id)
    const [updated] = await getDb()
      .update(authors)
      .set({ bio: data.bio || null, ...(photoUrl && { photoUrl }) })
      .where(and(eq(authors.id, data.authorId), eq(authors.verifiedSellerId, context.seller.id)))
      .returning({ id: authors.id })
    if (!updated) throw new Error('Only the verified author can edit this page')
    return { ok: true }
  })

export const saveAuthoredBook = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(
    z.object({
      bookId: z.string().uuid(),
      title: z.string().trim().min(1, 'Add a title').max(300),
      subtitle: z.string().trim().max(300),
      description: z.string().trim().max(8000),
      publisher: z.string().trim().max(200),
      publishedYear: z.number().int().min(1450).max(2100).nullable(),
      pageCount: z.number().int().min(1).max(10000).nullable(),
      language: z.enum(LANGUAGE_CODES),
      categorySlug: z.string().max(80).nullable(),
      coverKey: z.string().max(64).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const db = getDb()
    const coverUrl = await uploadedCover(data.coverKey, context.user.id)
    const [category] = data.categorySlug ? await db.select({ id: categories.id }).from(categories).where(eq(categories.slug, data.categorySlug)).limit(1) : []
    const [updated] = await db
      .update(books)
      .set({
        title: data.title,
        subtitle: data.subtitle || null,
        description: data.description || null,
        publisher: data.publisher || null,
        publisherId: await upsertPublisher(db, data.publisher),
        publishedYear: data.publishedYear,
        pageCount: data.pageCount,
        language: data.language,
        categoryId: category?.id ?? null,
        ...(coverUrl && { coverUrl }),
      })
      .where(and(eq(books.id, data.bookId), authoredBy(db, context.seller.id)))
      .returning({ id: books.id, slug: books.slug })
    if (!updated) throw new Error('Only a verified author of this book can edit it')
    await refreshSearchText(db, updated.id)
    return { slug: updated.slug }
  })
