import { z } from 'zod'
import { REPORT_REASONS } from '#/data/listing-options'
import { REVIEW_COPY, REVIEW_LIMITS } from '#/data/reputation'
import { containsLink, containsPhoneNumber } from '#/data/safety'

const reviewBody = z
  .string()
  .trim()
  .max(REVIEW_LIMITS.body)
  .refine((b) => !containsPhoneNumber(b) && !containsLink(b), REVIEW_COPY.noContact)

export const writeReviewSchema = z.object({ bookId: z.string().uuid(), score: z.number().int().min(1).max(5), body: reviewBody })

export type WriteReviewInput = z.infer<typeof writeReviewSchema>

export const rateParcelSchema = z.object({
  sellerOrderId: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  tags: z.array(z.string().max(40)).max(4),
})

export type RateParcelInput = z.infer<typeof rateParcelSchema>

const reasons = REPORT_REASONS.map((r) => r.value) as [string, ...string[]]

export const reportListingSchema = z.object({ listingId: z.string().uuid(), reason: z.enum(reasons), note: z.string().trim().max(500) })

export type ReportListingInput = z.infer<typeof reportListingSchema>
