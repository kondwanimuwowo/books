import { z } from 'zod'

// Inputs shared by the web's server functions and the apps' API, so both validate alike.

export const slugInput = z.object({ slug: z.string().max(120) })

export const searchSchema = z.object({
  q: z.string().max(200).optional(),
  category: z.string().max(400).optional(),
  zambian: z.boolean().optional(),
  condition: z.enum(['new', 'used']).optional(),
  language: z.string().max(80).optional(),
  min: z.number().min(0).max(100000).optional(),
  max: z.number().min(0).max(100000).optional(),
  sort: z.enum(['relevance', 'price', 'newest']).optional(),
  page: z.number().int().min(1).max(500).optional(),
  // Search for exactly what was typed, without AI's reading of it.
  exact: z.boolean().optional(),
})

export type SearchInput = z.infer<typeof searchSchema>

export const quickSearchSchema = z.object({ q: z.string().trim().min(2).max(100) })

export const directorySchema = z.object({
  q: z.string().trim().max(100).optional(),
  zambian: z.boolean().optional(),
  verified: z.boolean().optional(),
  tier: z.enum(['copper', 'emerald', 'gold']).optional(),
})

export const directoryInput = directorySchema.extend({ kind: z.enum(['authors', 'publishers']) })
