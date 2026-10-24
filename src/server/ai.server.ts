import Anthropic from '@anthropic-ai/sdk'
import type { BetaContentBlockParam, MessageCreateParams as BetaMessageCreateParams } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { env } from 'cloudflare:workers'
import { and, count, eq, gt } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '#/db/client.server'
import { aiRequests } from '#/db/schema'
import { AI_DAILY_LIMITS, AI_MODELS } from '#/data/ai'
import type { AiKind } from '#/data/ai'
import { CONDITIONS } from '#/data/listing-options'
import { LANGUAGES } from '#/data/zambia'

// Everything here is a suggestion a person confirms. When Claude is down, slow or out of budget the
// callers carry on without it, so every failure comes back as null rather than an error.

let client: Anthropic | null = null

function claude() {
  if (!env.ANTHROPIC_API_KEY) return null
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 60_000 })
  return client
}

export async function checkAiLimit(db: Db, userId: string, kind: keyof typeof AI_DAILY_LIMITS) {
  const since = new Date(Date.now() - 24 * 60 * 60_000)
  const [used] = await db
    .select({ n: count() })
    .from(aiRequests)
    .where(and(eq(aiRequests.userId, userId), eq(aiRequests.kind, kind), gt(aiRequests.createdAt, since)))
  // A plain Error, so the message reaches the seller (see src/start.ts).
  if ((used?.n ?? 0) >= AI_DAILY_LIMITS[kind]) throw new Error('You’ve reached today’s limit for this. Fill the details in yourself, or try again tomorrow.')
}

async function ask<T>(
  db: Db,
  request: { kind: AiKind; userId: string | null; model: string; system: string; content: BetaContentBlockParam[]; schema: z.ZodType<T>; maxTokens: number },
): Promise<T | null> {
  const anthropic = claude()
  if (!anthropic) return null
  // Server-side fallback re-runs a declined request on another model; Sonnet 5.5 supports it, Haiku doesn't.
  const fallback: Pick<BetaMessageCreateParams, 'betas' | 'fallbacks'> =
    request.model === AI_MODELS.reader ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}
  let usage = { input_tokens: 0, output_tokens: 0 }
  let result: T | null = null
  try {
    const response = await anthropic.beta.messages.parse({
      model: request.model,
      max_tokens: request.maxTokens,
      system: request.system,
      output_config: { effort: 'low', format: betaZodOutputFormat(request.schema) },
      messages: [{ role: 'user', content: request.content }],
      ...fallback,
    })
    usage = response.usage
    if (response.stop_reason !== 'refusal') result = response.parsed_output ?? null
  } catch (error) {
    console.error(`[ai] ${request.kind} failed`, error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error)
  }
  await db
    .insert(aiRequests)
    .values({ userId: request.userId, kind: request.kind, model: request.model, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, ok: result !== null })
    .catch((error: unknown) => console.error('[ai] usage log failed', error))
  return result
}

const nullableText = z.string().nullable()

const photoReading = z.object({
  isBook: z.boolean().describe('False if the photos do not show a book.'),
  title: nullableText.describe('Main title as printed on the cover, in normal title case, without subtitle, author or format.'),
  subtitle: nullableText,
  authors: z.array(z.string()).describe('Author names as printed, in normal case. Empty if none visible.'),
  isbn: nullableText.describe('ISBN exactly as printed (by the barcode or on the copyright page), digits and X only. Null if not clearly legible.'),
  publisher: nullableText.describe('Publisher name, usually on the spine or copyright page.'),
  publishedYear: z.number().int().nullable().describe('Year of this edition or printing from the copyright page.'),
  language: z.enum(LANGUAGES.map((l) => l.code) as [string, ...string[]]).describe('Language the book is written in.'),
  backCoverText: nullableText.describe('The blurb from the back cover, transcribed word for word. Leave out review quotes, prices, barcodes and publisher addresses. Null if no back cover photo.'),
  summary: nullableText.describe('One or two plain sentences saying what the book is about, using only facts in backCoverText. Null if backCoverText is null.'),
  condition: z.enum(CONDITIONS.map((c) => c.value) as [string, ...string[]]).nullable().describe('Grade of this physical copy from visible wear. Null if the photos look like stock images or show too little.'),
  conditionNotes: nullableText.describe(
    'Up to two short sentences addressed to buyers about visible wear on this copy, e.g. "Light creasing on the spine. Corners slightly bumped." Never comment on the photos themselves. Null if condition is null or no wear is visible.',
  ),
})

export type PhotoReading = z.infer<typeof photoReading>

const PHOTO_SYSTEM = `You read photos of a book that someone in Zambia wants to sell on Kuwala Books, and fill in its listing.

Read only what is printed and visible. Never guess or add anything from memory: if a field isn't legible in the photos, return null. A wrong ISBN or author is worse than a blank one, because the seller may not notice.

Many books are Zambian or African, self-published, or school textbooks; some are in Bemba, Nyanja, Tonga, Lozi, Kaonde, Lunda or Luvale. Copy names exactly, including local spellings.

For condition, judge only the physical copy in the photos: creases, torn or bumped corners, fading, stains, writing. Grades: new (unread), like_new (read once, no marks), very_good (light wear), good (visible wear, some notes), acceptable (heavy wear, complete).`

export async function readBookPhotos(db: Db, userId: string, photos: { slot: string; bytes: Uint8Array; mediaType: 'image/jpeg' | 'image/webp' | 'image/png' }[]) {
  const content: BetaContentBlockParam[] = photos.flatMap((photo) => [
    { type: 'text' as const, text: `Photo: ${photo.slot}` },
    { type: 'image' as const, source: { type: 'base64' as const, media_type: photo.mediaType, data: toBase64(photo.bytes) } },
  ])
  content.push({ type: 'text', text: 'Fill in the listing from these photos.' })
  return ask(db, { kind: 'photos', userId, model: AI_MODELS.reader, system: PHOTO_SYSTEM, content, schema: photoReading, maxTokens: 4000 })
}

const tidied = z.object({
  title: z.string().describe('Main title in title case, without subtitle, author, format or edition words.'),
  subtitle: nullableText,
  authors: z.array(z.string()).describe('Author names in normal case, as they would appear on the cover.'),
})

export async function tidyBookName(db: Db, userId: string, typed: { title: string; authors: string }) {
  return ask(db, {
    kind: 'tidy',
    userId,
    model: AI_MODELS.light,
    system:
      'A seller typed a book title and author into a listing form. Return them tidied: title case, no shouting capitals, and move words like "hardcover", "paperback" or "by <author>" out of the title. Keep the words otherwise unchanged. Never correct to a different book or add words that were not typed.',
    content: [{ type: 'text', text: `Title: ${typed.title}\nAuthors: ${typed.authors}` }],
    schema: tidied,
    maxTokens: 1000,
  })
}

const summarised = z.object({
  summary: z.string().describe('One or two plain sentences, at most 40 words, saying what the book is about.'),
})

/** A short summary of a description we already hold. Never adds facts or praise the description doesn't contain. */
export async function summariseDescription(db: Db, description: string) {
  const result = await ask(db, {
    kind: 'summary',
    userId: null,
    model: AI_MODELS.light,
    system:
      'Condense a book description into one or two plain sentences for a product page. Use only facts in the description. No praise, no claims about popularity or acclaim, no marketing words.',
    content: [{ type: 'text', text: description.slice(0, 6000) }],
    schema: summarised,
    maxTokens: 600,
  })
  return result?.summary.trim() || null
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
