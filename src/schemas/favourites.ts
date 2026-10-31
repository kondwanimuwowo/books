import { z } from 'zod'

// Books are saved with the heart; authors, shops and publishers are followed.
export const SAVE_KINDS = ['book', 'author', 'seller', 'publisher'] as const
export type SaveKind = (typeof SAVE_KINDS)[number]

// Saving says what the button should be, so a repeated tap or a retried request lands in the same place.
export const setSavedSchema = z.object({ kind: z.enum(SAVE_KINDS), slug: z.string().min(1).max(120), saved: z.boolean() })

export type SetSavedInput = z.infer<typeof setSavedSchema>

/** How the client keys what's saved: "book:some-slug", "author:some-slug". */
export const savedKey = (kind: SaveKind, slug: string) => `${kind}:${slug}`
