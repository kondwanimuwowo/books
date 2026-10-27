import { z } from 'zod'
import { SAFETY, containsPhoneNumber } from '#/data/safety'

export const makeOfferSchema = z.object({
  listingId: z.string().uuid(),
  amountKwacha: z.number().min(5).max(100000),
  message: z
    .string()
    .trim()
    .max(300)
    .refine((m) => !containsPhoneNumber(m), SAFETY.phoneInMessage)
    .optional(),
})

export type MakeOfferInput = z.infer<typeof makeOfferSchema>

export const answerOfferSchema = z.object({
  offerId: z.string().uuid(),
  move: z.enum(['accept', 'decline', 'counter']),
  counterKwacha: z.number().min(5).max(100000).optional(),
})

export type AnswerOfferInput = z.infer<typeof answerOfferSchema>

export const offerIdInput = z.object({ offerId: z.string().uuid() })
