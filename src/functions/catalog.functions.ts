import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { getCookie, setResponseHeader } from '@tanstack/react-start/server'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import { authors, profiles, sellers } from '#/db/schema'
import { optionalUserMiddleware } from '#/server/auth'
import { categoriesWithCounts, sellerTowns, getAuthorBySlug, getBookBySlug, getPublisherBySlug, getSellerBySlug, listDirectory, searchBooks, shelf } from '#/server/catalog.server'
import { getZmwPerUsd } from '#/server/fx.server'
import { loadChart } from '#/server/chart.server'

function publicCache(seconds: number) {
  setResponseHeader('Cache-Control', `public, max-age=${seconds}`)
}

export const getSiteContext = createServerFn({ method: 'GET' })
  .middleware([optionalUserMiddleware])
  .handler(async ({ context }) => {
    const fx = await getZmwPerUsd(getDb())
    // Fetched after the fx lookup, which may have replaced a stalled connection.
    const db = getDb()
    const currency: 'ZMW' | 'USD' = getCookie('kb_currency') === 'USD' ? 'USD' : 'ZMW'
    if (!context.user) return { user: null, fx, currency }
    const [row] = await db
      .select({
        displayName: profiles.displayName,
        isAdmin: profiles.isAdmin,
        sellerSlug: sellers.slug,
        isAuthor: sql<boolean>`exists (select 1 from ${authors} where ${authors.verifiedSellerId} = ${sellers.id})`,
      })
      .from(profiles)
      .leftJoin(sellers, eq(sellers.profileId, profiles.id))
      .where(eq(profiles.id, context.user.id))
      .limit(1)
    return {
      user: {
        id: context.user.id,
        email: context.user.email,
        displayName: row?.displayName ?? context.user.email,
        isAdmin: row?.isAdmin ?? false,
        // Admin runs on its own host with its own sign-in.
        adminUrl: row?.isAdmin ? (env.ADMIN_ORIGIN ?? '/admin') : null,
        sellerSlug: row?.sellerSlug ?? null,
        isAuthor: row?.isAuthor ?? false,
      },
      fx,
      currency,
    }
  })

export const getHomeData = createServerFn({ method: 'GET' }).handler(async () => {
  const db = getDb()
  const [chart, zambian, recent, bargains, categories, towns] = await Promise.all([
    loadChart(db),
    shelf(db, 'zambian'),
    shelf(db, 'recent'),
    shelf(db, 'bargains'),
    categoriesWithCounts(db),
    sellerTowns(db),
  ])
  publicCache(60)
  // The intro band's cover background reuses covers already loaded for the shelves.
  const wall = [...new Set([...recent, ...zambian, ...bargains].map((b) => b.coverUrl).filter((c): c is string => !!c))].slice(0, 24)
  return { chart: chart.entries.slice(0, 10), zambian, recent, bargains, categories, wall, towns }
})

export const getChart = createServerFn({ method: 'GET' }).handler(async () => {
  const db = getDb()
  const [chart, zambian] = await Promise.all([loadChart(db), shelf(db, 'zambian')])
  publicCache(300)
  return { ...chart, zambian }
})

export const getCategories = createServerFn({ method: 'GET' }).handler(async () => {
  publicCache(300)
  return categoriesWithCounts(getDb())
})

export const searchSchema = z.object({
  q: z.string().max(200).optional(),
  category: z.string().max(80).optional(),
  zambian: z.boolean().optional(),
  condition: z.enum(['new', 'used']).optional(),
  language: z.string().max(8).optional(),
  sort: z.enum(['relevance', 'price', 'newest']).optional(),
  page: z.number().int().min(1).max(500).optional(),
})

export const searchBooksFn = createServerFn({ method: 'GET' })
  .validator(searchSchema)
  .handler(async ({ data }) => {
    const db = getDb()
    const [result, categories] = await Promise.all([searchBooks(db, data), categoriesWithCounts(db)])
    publicCache(30)
    return { ...result, categories }
  })

export const getBook = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().max(120) }))
  .handler(async ({ data }) => {
    const book = await getBookBySlug(getDb(), data.slug)
    if (!book) throw notFound()
    publicCache(30)
    return book
  })

export const getAuthor = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().max(120) }))
  .handler(async ({ data }) => {
    const author = await getAuthorBySlug(getDb(), data.slug)
    if (!author) throw notFound()
    publicCache(60)
    return author
  })

export const getPublisher = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().max(120) }))
  .handler(async ({ data }) => {
    const publisher = await getPublisherBySlug(getDb(), data.slug)
    if (!publisher) throw notFound()
    publicCache(60)
    return publisher
  })

export const directorySchema = z.object({
  q: z.string().trim().max(100).optional(),
  zambian: z.boolean().optional(),
})

export const getDirectory = createServerFn({ method: 'GET' })
  .validator(directorySchema.extend({ kind: z.enum(['authors', 'publishers']) }))
  .handler(async ({ data }) => {
    publicCache(120)
    return listDirectory(getDb(), data.kind, { query: data.q, zambian: data.zambian })
  })

export const getSeller = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().max(120) }))
  .handler(async ({ data }) => {
    const seller = await getSellerBySlug(getDb(), data.slug)
    if (!seller) throw notFound()
    publicCache(60)
    return seller
  })
