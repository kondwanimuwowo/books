import { createServerFn } from '@tanstack/react-start'
import { getDb } from '#/db/client.server'
import { requireSellerMiddleware, requireUserMiddleware } from '#/server/auth'
import { findDescription } from '#/server/book-sources.server'
import { findCatalogueMatches, suggestNames } from '#/server/catalog.server'
import { bookDescription, bookSchoolDetails, createSellerListing, findBooksToSell, listSellerListings, priceGuide, updateSellerListing } from '#/server/listings.server'
import { loadBalance, payNow } from '#/server/payouts.server'
import { loadSellerSetup, savePayoutDestination, saveSellerProfileFor, updateDeliverySettings } from '#/server/sellers.server'
import {
  bookIdInput,
  createListingSchema,
  deliverySettingsSchema,
  isbnInput,
  payoutDetailsSchema,
  sellerProfileSchema,
  suggestNamesSchema,
  titleQuery,
  updateListingSchema,
} from '#/schemas/sell'

export const getMySeller = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .handler(({ context }) => loadSellerSetup(getDb(), context.user.id))

export const saveSellerProfile = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(sellerProfileSchema)
  .handler(({ data, context }) => saveSellerProfileFor(getDb(), context.user.id, data))

export const saveDeliverySettings = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(deliverySettingsSchema)
  .handler(({ data, context }) => updateDeliverySettings(getDb(), context.seller.id, data))

export const browseCatalogue = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .handler(async () => findCatalogueMatches(getDb(), null, 60))

export const suggestBookNames = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .validator(suggestNamesSchema)
  .handler(async ({ data }) => suggestNames(getDb(), data.kind, data.query))

export const suggestTitles = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .validator(titleQuery)
  .handler(async ({ data }) => findCatalogueMatches(getDb(), data.query, 5))

export const getBookDescription = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .validator(isbnInput)
  .handler(async ({ data }) => ({ description: await findDescription(data.isbn) }))

/** A catalogue book's own description, shown read-only on the sell form. */
export const getCatalogueDescription = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .validator(bookIdInput)
  .handler(async ({ data }) => ({ description: await bookDescription(getDb(), data.bookId) }))

export const getBookSchoolDetails = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .validator(bookIdInput)
  .handler(({ data }) => bookSchoolDetails(getDb(), data.bookId))

export const findBookForSale = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .validator(titleQuery)
  .handler(({ data }) => findBooksToSell(getDb(), data.query))

export const createListing = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(createListingSchema)
  .handler(({ data, context }) => createSellerListing(getDb(), context.seller, data))

export const getPriceGuide = createServerFn({ method: 'GET' })
  .validator(bookIdInput)
  .handler(({ data }) => priceGuide(getDb(), data.bookId))

export const getMyListings = createServerFn({ method: 'GET' })
  .middleware([requireSellerMiddleware])
  .handler(({ context }) => listSellerListings(getDb(), context.seller.id))

export const updateListing = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(updateListingSchema)
  .handler(({ data, context }) => updateSellerListing(getDb(), context.seller, data))

export const savePayoutDetails = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(payoutDetailsSchema)
  .handler(({ data, context }) => savePayoutDestination(getDb(), context.seller.id, data))

/** "Pay me now": the whole balance at once, Lenco's transfer fee taken from it. */
export const payMeNow = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .handler(({ context }) => payNow(getDb(), context.seller.id))

export const getMyBalance = createServerFn({ method: 'GET' })
  .middleware([requireSellerMiddleware])
  .handler(({ context }) => loadBalance(getDb(), context.seller))
