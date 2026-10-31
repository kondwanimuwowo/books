import { z } from 'zod'
import { EMAIL_LISTS, NEWSLETTER_SOURCES } from '#/data/emails'

export const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter an email address').max(254),
  source: z.enum(NEWSLETTER_SOURCES),
  // A field people never see. Bots fill it in.
  website: z.string().max(200).optional(),
})
export type SubscribeInput = z.infer<typeof subscribeSchema>

export const emailTokenSchema = z.object({ token: z.string().min(16).max(100) })

export const unsubscribeSchema = emailTokenSchema.extend({ list: z.enum(EMAIL_LISTS) })
export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>

export const emailPrefSchema = z.object({ list: z.enum(EMAIL_LISTS), on: z.boolean() })
export type EmailPrefInput = z.infer<typeof emailPrefSchema>
