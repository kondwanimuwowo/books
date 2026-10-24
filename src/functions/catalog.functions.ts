import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { getCookie, getRequest, setResponseHeader } from '@tanstack/react-start/server'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import { authors, profiles, sellers } from '#/db/schema'
import { optionalUserMiddleware } from '#/server/auth'
import { categoriesWithCounts, sellerTowns, getAuthorBySlug, getBookBySlug, getPublisherBySlug, getSellerBySlug, listDirectory, searchBooks, shelf } from '#/server/catalog.server'
import { getZmwPerUsd } from '#/server/fx.server'
import { interpretSearch } from '#/server/ai.server'
import { SEARCH_REQUEST_WORDS } from '#/data/ai'
import { toIsbn13 } from '#/lib/isbn'
import { loadDeliveryRates } from '#/server/orders.server'
import { loadChart } from '#/server/chart.server'

// Only the data a browser fetches for a page is shared and cacheable. During a full page load these functions
// run inside the HTML response, which also carries who is signed in, so that response must never be cached.
function publicCache(seconds: number) {
  if (!new URL(getRequest().url).pathname.startsWith('/_serverFn/')) return
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
        town: profiles.town,
        province: profiles.province,
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
        // Where they usually receive books, for delivery estimates on book pages.
        place: row?.town && row.province ? { town: row.town, province: row.province } : null,
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
  // Search for exactly what was typed, without AI's reading of it.
  exact: z.boolean().optional(),
})

type SearchInput = z.infer<typeof searchSchema>

/**
 * When a search finds nothing, or reads like a request ("grade 7 maths in Bemba"), Claude rewrites it into keywords
 * and filters. The rewrite is only used if it finds books; the page then offers the exact search too.
 */
async function interpretIfUseful(db: ReturnType<typeof getDb>, data: SearchInput, total: number, sections: { slug: string; name: string }[]) {
  const q = data.q?.trim()
  if (!q || data.exact || (data.page ?? 1) > 1 || q.length < 3 || toIsbn13(q)) return null
  if (total > 0 && !SEARCH_REQUEST_WORDS.test(q)) return null
  const reading = await interpretSearch(db, q, sections)
  if (!reading) return null
  const applied = {
    q: reading.query.trim() || undefined,
    category: data.category ?? reading.section ?? undefined,
    language: data.language ?? reading.language ?? undefined,
    condition: data.condition ?? reading.condition ?? undefined,
    zambian: data.zambian || reading.zambian || undefined,
  }
  const changed =
    applied.q?.toLowerCase() !== q.toLowerCase() ||
    applied.category !== data.category ||
    applied.language !== data.language ||
    applied.condition !== data.condition ||
    applied.zambian !== data.zambian
  if (!changed) return null
  const result = await searchBooks(db, { ...data, ...applied })
  if (result.total > 0) return { result, applied }
  // Keywords plus filters can be too narrow; the filters alone still answer "used Zambian novels".
  const hasFilters = applied.category || applied.language || applied.condition || applied.zambian
  if (!applied.q || !hasFilters) return null
  const broader = { ...applied, q: undefined }
  const fallback = await searchBooks(db, { ...data, ...broader })
  return fallback.total > 0 ? { result: fallback, applied: broader } : null
}

export const searchBooksFn = createServerFn({ method: 'GET' })
  .validator(searchSchema)
  .handler(async ({ data }) => {
    const db = getDb()
    const [result, categories] = await Promise.all([searchBooks(db, data), categoriesWithCounts(db)])
    publicCache(30)
    // A misspelt title ("eccentric thots") is found by close spelling first; that's free, Claude isn't.
    if (!result.total && data.q?.trim() && !data.exact && !toIsbn13(data.q)) {
      const close = await searchBooks(db, { ...data, fuzzy: true })
      if (close.total) return { ...close, categories, interpreted: null, closeMatches: true }
    }
    const interpreted = await interpretIfUseful(db, data, result.total, categories)
    return interpreted
      ? { ...interpreted.result, categories, interpreted: interpreted.applied, closeMatches: false }
      : { ...result, categories, interpreted: null, closeMatches: false }
  })

export const getBook = createServerFn({ method: 'GET' })
  .validator(z.object({ slug: z.string().max(120) }))
  .handler(async ({ data }) => {
    const db = getDb()
    const [book, deliveryRates] = await Promise.all([getBookBySlug(db, data.slug), loadDeliveryRates(db)])
    if (!book) throw notFound()
    publicCache(30)
    // Each reader's own town is only known in the browser, which works out the delivery line from these.
    return { ...book, deliveryRates }
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
