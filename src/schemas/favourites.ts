import { z } from 'zod'

// Saving says what the heart should be, so a repeated tap or a retried request lands in the same place.
export const setFavouriteSchema = z.object({ slug: z.string().min(1).max(120), saved: z.boolean() })

export type SetFavouriteInput = z.infer<typeof setFavouriteSchema>
