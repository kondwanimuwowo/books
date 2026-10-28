import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCookie, getRequest, setResponseHeader } from '@tanstack/react-start/server'
import { getDb } from '#/db/client.server'
import { optionalUserMiddleware } from '#/server/auth'
import { categoriesWithCounts, getAuthorBySlug, getBookBySlug, getPublisherBySlug, getSellerBySlug, listDirectory } from '#/server/catalog.server'
import { getZmwPerUsd } from '#/server/fx.server'
import { loadDeliveryRates } from '#/server/orders.server'
import { loadChartPage, loadCoverWall, loadHome, quickSearchBooks, runSearch } from '#/server/browse.server'
import { loadMember } from '#/server/members.server'
import { directoryInput, quickSearchSchema, searchSchema, slugInput } from '#/schemas/catalog'

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
    return { user: await loadMember(db, context.user), fx, currency }
  })

export const getHomeData = createServerFn({ method: 'GET' }).handler(async () => {
  const home = await loadHome(getDb())
  publicCache(60)
  return home
})

export const getCoverWall = createServerFn({ method: 'GET' }).handler(async () => {
  const wall = await loadCoverWall(getDb())
  publicCache(300)
  return wall
})

export const getChart = createServerFn({ method: 'GET' }).handler(async () => {
  const chart = await loadChartPage(getDb())
  publicCache(300)
  return chart
})

export const getCategories = createServerFn({ method: 'GET' }).handler(async () => {
  publicCache(300)
  return categoriesWithCounts(getDb())
})

export const searchBooksFn = createServerFn({ method: 'GET' })
  .validator(searchSchema)
  .handler(async ({ data }) => {
    const result = await runSearch(getDb(), data)
    publicCache(30)
    return result
  })

export const getBook = createServerFn({ method: 'GET' })
  .validator(slugInput)
  .handler(async ({ data }) => {
    const db = getDb()
    const [book, deliveryRates] = await Promise.all([getBookBySlug(db, data.slug), loadDeliveryRates(db)])
    if (!book) throw notFound()
    publicCache(30)
    // Each reader's own town is only known in the browser, which works out the delivery line from these.
    return { ...book, deliveryRates }
  })

export const getAuthor = createServerFn({ method: 'GET' })
  .validator(slugInput)
  .handler(async ({ data }) => {
    const author = await getAuthorBySlug(getDb(), data.slug)
    if (!author) throw notFound()
    publicCache(60)
    return author
  })

/** Results for the header search box as someone types. */
export const quickSearch = createServerFn({ method: 'GET' })
  .validator(quickSearchSchema)
  .handler(async ({ data }) => {
    const result = await quickSearchBooks(getDb(), data.q)
    publicCache(60)
    return result
  })

export const getPublisher = createServerFn({ method: 'GET' })
  .validator(slugInput)
  .handler(async ({ data }) => {
    const publisher = await getPublisherBySlug(getDb(), data.slug)
    if (!publisher) throw notFound()
    publicCache(60)
    return publisher
  })

export const getDirectory = createServerFn({ method: 'GET' })
  .validator(directoryInput)
  .handler(async ({ data }) => {
    publicCache(120)
    return listDirectory(getDb(), data.kind, { query: data.q, zambian: data.zambian, verified: data.verified, tier: data.tier })
  })

export const getSeller = createServerFn({ method: 'GET' })
  .validator(slugInput)
  .handler(async ({ data }) => {
    const seller = await getSellerBySlug(getDb(), data.slug)
    if (!seller) throw notFound()
    publicCache(60)
    return seller
  })
