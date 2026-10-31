import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq, exists, inArray, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import type { Db } from '#/db/client.server'
import { authorMilestones, authors, bookAuthors, books, categories } from '#/db/schema'
import type { AuthorLinks } from '#/db/schema'
import { LANGUAGES } from '#/data/zambia'
import { requireSellerMiddleware } from '#/server/auth'
import { refreshSearchText, upsertPublisher } from '#/server/catalog.server'
import { ownedCoverUrl } from '#/server/covers.server'
import { schoolDetailsSchema } from '#/schemas/sell'
import { AppError } from '#/server/errors.server'

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
  if (!url) throw new AppError('That photo didn’t upload. Add it again.')
  return url
}

export const getMyAuthorship = createServerFn({ method: 'GET' })
  .middleware([requireSellerMiddleware])
  .handler(async ({ context }) => {
    const db = getDb()
    const [pages, bookRows, categoryRows] = await Promise.all([
      db
        .select({ id: authors.id, slug: authors.slug, name: authors.name, bio: authors.bio, photoUrl: authors.photoUrl, links: authors.links })
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
          ageBands: books.ageBands,
          levels: books.levels,
          subject: books.subject,
          curriculum: books.curriculum,
        })
        .from(books)
        .leftJoin(categories, eq(categories.id, books.categoryId))
        .where(authoredBy(db, context.seller.id))
        .orderBy(desc(books.publishedYear), asc(books.title)),
      db.select({ slug: categories.slug, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder)),
    ])
    const plaques = pages.length
      ? await db
          .select({ authorId: authorMilestones.authorId, tier: authorMilestones.tier, reachedAt: authorMilestones.reachedAt, seen: sql<boolean>`${authorMilestones.seenAt} is not null` })
          .from(authorMilestones)
          .where(inArray(authorMilestones.authorId, pages.map((p) => p.id)))
          .orderBy(asc(authorMilestones.reachedAt))
      : []
    return { pages: pages.map((p) => ({ ...p, plaques: plaques.filter((m) => m.authorId === p.id) })), books: bookRows, categories: categoryRows }
  })

/** Once the author has seen their new plaque, it stops celebrating. */
export const markPlaquesSeen = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(z.object({ authorId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const db = getDb()
    const [mine] = await db.select({ id: authors.id }).from(authors).where(and(eq(authors.id, data.authorId), eq(authors.verifiedSellerId, context.seller.id))).limit(1)
    if (!mine) return { ok: false }
    await db.update(authorMilestones).set({ seenAt: new Date() }).where(and(eq(authorMilestones.authorId, mine.id), isNull(authorMilestones.seenAt)))
    return { ok: true }
  })

// Typed without a scheme ("mwilabanda.com") is fine; anything that isn't a web address is refused.
const linkSchema = z
  .string()
  .trim()
  .max(200)
  .transform((value, ctx) => {
    if (!value) return undefined
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
      if (!url.hostname.includes('.')) throw new Error()
      return url.toString()
    } catch {
      ctx.addIssue({ code: 'custom', message: `“${value}” isn’t a web address` })
      return z.NEVER
    }
  })

export const saveAuthorProfile = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(
    z.object({
      authorId: z.string().uuid(),
      bio: z.string().trim().max(2000),
      photoKey: z.string().max(64).optional(),
      links: z.object({ website: linkSchema, facebook: linkSchema, instagram: linkSchema, x: linkSchema, tiktok: linkSchema }).partial(),
    }),
  )
  .handler(async ({ data, context }) => {
    const photoUrl = await uploadedCover(data.photoKey, context.user.id)
    const links = Object.fromEntries(Object.entries(data.links).filter(([, v]) => v)) as AuthorLinks
    const [updated] = await getDb()
      .update(authors)
      .set({ bio: data.bio || null, links, ...(photoUrl && { photoUrl }) })
      .where(and(eq(authors.id, data.authorId), eq(authors.verifiedSellerId, context.seller.id)))
      .returning({ id: authors.id })
    if (!updated) throw new AppError('Only the verified author can edit this page', 'forbidden')
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
      // A verified author may replace what sellers filled in.
      school: schoolDetailsSchema.optional(),
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
        ...(data.school && {
          ageBands: data.school.ageBands,
          levels: data.school.levels,
          subject: data.school.subject,
          curriculum: data.school.curriculum,
        }),
        ...(coverUrl && { coverUrl }),
      })
      .where(and(eq(books.id, data.bookId), authoredBy(db, context.seller.id)))
      .returning({ id: books.id, slug: books.slug })
    if (!updated) throw new AppError('Only a verified author of this book can edit it', 'forbidden')
    await refreshSearchText(db, updated.id)
    return { slug: updated.slug }
  })
