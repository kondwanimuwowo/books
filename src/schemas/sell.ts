import { z } from 'zod'
import { MAX_LISTING_PHOTOS } from '#/data/listing-options'
import { SHIPPING_METHODS } from '#/data/shipping'
import { PROVINCES } from '#/data/zambia'
import { normalizeLocalPhone } from '#/lib/phone'

export const phoneSchema = z.string().transform((value, ctx) => {
  const local = normalizeLocalPhone(value)
  if (!local) {
    ctx.addIssue({ code: 'custom', message: 'Enter a Zambian mobile number, e.g. 0971234567' })
    return z.NEVER
  }
  return local
})

export const sellerProfileSchema = z.object({
  storeName: z.string().trim().min(2).max(60),
  kind: z.enum(['individual', 'author', 'bookshop', 'publisher']),
  bio: z.string().trim().max(600).optional(),
  phone: phoneSchema,
  town: z.string().trim().min(2).max(60),
  province: z.enum(PROVINCES),
  photoKey: z.string().max(64).optional(),
})

export type SellerProfileFormInput = z.infer<typeof sellerProfileSchema>

export const deliverySettingsSchema = z.object({
  methods: z.array(z.enum(SHIPPING_METHODS)).min(1, 'Choose at least one way to send books'),
  freeOverKwacha: z.number().min(0).max(100000).nullable(),
})

export type DeliverySettingsInput = z.infer<typeof deliverySettingsSchema>

export const suggestNamesSchema = z.object({ kind: z.enum(['authors', 'publishers']), query: z.string().trim().min(1).max(100) })

export const titleQuery = z.object({ query: z.string().trim().min(2).max(200) })

export const isbnInput = z.object({ isbn: z.string().max(20) })

export const bookIdInput = z.object({ bookId: z.string().uuid() })

const descriptionField = z.string().trim().max(8000).optional()

const offerFields = {
  acceptsOffers: z.boolean(),
  offerFloorKwacha: z.number().min(5).max(100000).nullable(),
}

const candidateSchema = z.object({
  isbn13: z.string().nullable(),
  isbn10: z.string().nullable(),
  title: z.string().trim().min(1).max(300),
  subtitle: z.string().max(300).nullable(),
  authors: z.array(z.string().trim().min(1).max(120)).max(10),
  description: z.string().max(8000).nullable(),
  coverUrl: z.string().url().nullable(),
  publisher: z.string().max(200).nullable(),
  publishedYear: z.number().int().min(1450).max(2100).nullable(),
  pageCount: z.number().int().min(1).max(10000).nullable(),
  language: z.string().max(8),
})

export const createListingSchema = z.object({
  book: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('existing'), bookId: z.string().uuid() }),
    z.object({ kind: z.literal('external'), source: z.enum(['google', 'openlibrary']), candidate: candidateSchema }),
    z.object({ kind: z.literal('manual'), candidate: candidateSchema }),
  ]),
  categorySlug: z.string().max(80).optional(),
  zambianAuthor: z.boolean(),
  format: z.enum(['paperback', 'hardcover']),
  condition: z.enum(['new', 'like_new', 'very_good', 'good', 'acceptable']),
  priceKwacha: z.number().min(5).max(100000),
  quantity: z.number().int().min(1).max(10000),
  notes: z.string().trim().max(500).optional(),
  ...offerFields,
  description: descriptionField,
  summary: z.string().trim().max(400).optional(),
  // A photo the seller uploaded through uploadCover.
  coverKey: z.string().max(64).optional(),
  // Photos of this copy, also uploaded through uploadCover.
  photoKeys: z.array(z.string().max(64)).max(MAX_LISTING_PHOTOS).default([]),
})

export type CreateListingInput = z.infer<typeof createListingSchema>

export const updateListingSchema = z.object({
  id: z.string().uuid(),
  priceKwacha: z.number().min(5).max(100000),
  quantity: z.number().int().min(0).max(10000),
  status: z.enum(['active', 'paused', 'removed']),
  ...offerFields,
  description: descriptionField,
  // Omitted: photos unchanged.
  photoKeys: z.array(z.string().max(64)).max(MAX_LISTING_PHOTOS).optional(),
})

export type UpdateListingInput = z.infer<typeof updateListingSchema>

export const payoutDetailsSchema = z.object({ phone: phoneSchema, operator: z.enum(['mtn', 'airtel', 'zamtel']) })

export type PayoutDetailsInput = z.infer<typeof payoutDetailsSchema>
