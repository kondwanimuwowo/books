import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import { authors, sellers, verificationRequests } from '#/db/schema'
import { requireSellerMiddleware } from '#/server/auth'
import { ownsPrivate } from '#/server/private-files.server'

const AUTHOR_MATCHES = 6

/** Catalogue author pages an author might be, so they claim theirs instead of starting a duplicate. */
export const findAuthorPages = createServerFn({ method: 'GET' })
  .middleware([requireSellerMiddleware])
  .validator(z.object({ name: z.string().trim().min(2).max(100) }))
  .handler(async ({ data, context }) => {
    const words = data.name.split(/\s+/).filter((w) => w.length > 1)
    return getDb()
      .select({
        id: authors.id,
        slug: authors.slug,
        name: authors.name,
        photoUrl: authors.photoUrl,
        books: sql<number>`(select count(*)::int from book_authors ba where ba.author_id = ${authors.id})`,
      })
      .from(authors)
      .where(
        and(
          or(isNull(authors.verifiedSellerId), eq(authors.verifiedSellerId, context.seller.id)),
          or(ilike(authors.name, `%${data.name}%`), ...words.map((w) => ilike(authors.name, `%${w}%`))),
        ),
      )
      .orderBy(sql`extensions.similarity(${authors.name}, ${data.name}) desc`)
      .limit(AUTHOR_MATCHES)
  })

export const getMyVerification = createServerFn({ method: 'GET' })
  .middleware([requireSellerMiddleware])
  .handler(async ({ context }) => {
    const [latest] = await getDb()
      .select({ status: verificationRequests.status, note: verificationRequests.note, createdAt: verificationRequests.createdAt })
      .from(verificationRequests)
      .where(eq(verificationRequests.sellerId, context.seller.id))
      .orderBy(desc(verificationRequests.createdAt))
      .limit(1)
    return { verified: context.seller.verifiedAt !== null, latest: latest ?? null }
  })

const documentSchema = z.object({ type: z.enum(['id', 'selfie', 'extra']), key: z.string().max(64) })

export const submitVerification = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(
    z.object({
      // Null: a new author page, named after the shop.
      authorId: z.string().uuid().nullable(),
      legalName: z.string().trim().min(3, 'Add your name as it is on your NRC').max(120),
      documents: z.array(documentSchema).max(4),
    }),
  )
  .handler(async ({ data, context }) => {
    const db = getDb()
    const { seller } = context
    if (seller.verifiedAt) throw new Error('You are already verified')
    if (!data.documents.some((d) => d.type === 'id')) throw new Error('Add a photo of your NRC or passport')
    if (!data.documents.some((d) => d.type === 'selfie')) throw new Error('Add a photo of you holding your book')
    for (const d of data.documents) {
      if (!(await ownsPrivate(d.key, context.user.id))) throw new Error('A photo didn’t upload. Add it again.')
    }
    if (data.authorId) {
      const [page] = await db.select({ owner: authors.verifiedSellerId }).from(authors).where(eq(authors.id, data.authorId)).limit(1)
      if (!page) throw new Error('That author page no longer exists')
      if (page.owner && page.owner !== seller.id) throw new Error('That author page is already verified to someone else')
    }
    const [open] = await db
      .select({ id: verificationRequests.id })
      .from(verificationRequests)
      .where(and(eq(verificationRequests.sellerId, seller.id), inArray(verificationRequests.status, ['pending'])))
      .limit(1)
    if (open) throw new Error('Your details are already with us')
    await db.update(sellers).set({ kind: 'author' }).where(eq(sellers.id, seller.id))
    await db.insert(verificationRequests).values({ sellerId: seller.id, authorId: data.authorId, legalName: data.legalName, documents: data.documents })
    return { ok: true }
  })
