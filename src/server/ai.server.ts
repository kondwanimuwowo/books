import Anthropic from '@anthropic-ai/sdk'
import type { BetaContentBlockParam, BetaMessageParam, BetaTool, BetaToolUnion, MessageCreateParams as BetaMessageCreateParams } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { env } from 'cloudflare:workers'
import { and, count, eq, gt } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '#/db/client.server'
import { aiRequests } from '#/db/schema'
import { AI_DAILY_LIMITS, AI_MODELS, AI_SEARCH_DAILY_CAP } from '#/data/ai'
import type { AiKind } from '#/data/ai'
import { CONDITIONS } from '#/data/listing-options'
import { LANGUAGES } from '#/data/zambia'
import { AppError } from './errors.server'

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
  if ((used?.n ?? 0) >= AI_DAILY_LIMITS[kind]) throw new AppError('You’ve reached today’s limit for this. Fill the details in yourself, or try again tomorrow.', 'rate_limited')
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

const bookList = z.object({
  isList: z.boolean().describe('False if this is not a list of books.'),
  school: nullableText.describe('School name if printed.'),
  grade: nullableText.describe('Grade or form the list is for, e.g. "Grade 7", if printed.'),
  items: z.array(
    z.object({
      title: z.string().describe('Book title as written on the list.'),
      searchTitle: z.string().describe('The shortest form of the title that still identifies it, for searching a catalogue: drop words like "Pupil’s Book", "New Edition" or the grade if it is not part of the title.'),
      author: nullableText,
      publisher: nullableText,
      subject: nullableText.describe('Subject if the list gives one, e.g. "Mathematics".'),
    }),
  ),
})

export type BookListReading = z.infer<typeof bookList>

const LIST_SYSTEM = `You read a Zambian school's book list (a photo of a printed or handwritten list, or text a parent typed) so a parent can find the books on Kuwala Books.

List each book once, in the order it appears. Copy titles, authors and publishers as written; never add books that are not on the list. Skip stationery and uniform items such as exercise books, pens, rulers or calculators.`

export async function readBookList(db: Db, userId: string, input: { photos: { bytes: Uint8Array; mediaType: 'image/jpeg' | 'image/webp' | 'image/png' }[]; text: string | null }) {
  const content: BetaContentBlockParam[] = input.photos.map((photo) => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: photo.mediaType, data: toBase64(photo.bytes) },
  }))
  if (input.text) content.push({ type: 'text', text: `The list as typed:\n${input.text}` })
  content.push({ type: 'text', text: 'Read the books on this list.' })
  return ask(db, { kind: 'list', userId, model: AI_MODELS.reader, system: LIST_SYSTEM, content, schema: bookList, maxTokens: 6000 })
}

const searchReading = z.object({
  query: z.string().describe('Keywords to match against titles and author names: spelling corrected, with filter words (language, condition, section, "Zambian") removed. Empty string if nothing is left.'),
  section: z.string().nullable().describe('One of the section slugs given, or null.'),
  language: z
    .string()
    .nullable()
    .describe(`Only when the reader asks for books in a language: one of ${LANGUAGES.map((l) => `${l.code} (${l.name})`).join(', ')}.`),
  condition: z.enum(['new', 'used']).nullable(),
  zambian: z.boolean().describe('True only when the reader asks for Zambian authors or Zambian books.'),
})

export type SearchReading = z.infer<typeof searchReading>

// Searches repeat a lot; each isolate remembers recent answers so the same words never cost twice.
const searchMemory = new Map<string, SearchReading | null>()
const SEARCH_MEMORY_SIZE = 500

/** Turns a free-text search into corrected keywords and filters. Null when AI is off, over budget or unsure. */
export async function interpretSearch(db: Db, query: string, sections: { slug: string; name: string }[]) {
  const key = query.trim().toLowerCase()
  if (searchMemory.has(key)) return searchMemory.get(key) ?? null
  const since = new Date(Date.now() - 24 * 60 * 60_000)
  const [used] = await db
    .select({ n: count() })
    .from(aiRequests)
    .where(and(eq(aiRequests.kind, 'search'), gt(aiRequests.createdAt, since)))
  if ((used?.n ?? 0) >= AI_SEARCH_DAILY_CAP) return null

  const reading = await ask(db, {
    kind: 'search',
    userId: null,
    model: AI_MODELS.light,
    system: `You turn what someone typed into a Zambian bookshop's search box into keywords and filters. Correct obvious misspellings of titles and author names you recognise; never swap in a different book. Keep local names and words in Zambian languages as typed.

Keywords must be words a book title or author name would contain: write "mathematics" for "maths". Leave out words that only name a kind of book a section already covers, such as "novels" when you choose fiction.

Sections (slug: name): ${sections.map((s) => `${s.slug}: ${s.name}`).join('; ')}`,
    content: [{ type: 'text', text: query }],
    schema: searchReading,
    maxTokens: 500,
  })
  // Anything outside the known sections and languages is dropped rather than trusted.
  const valid = reading && {
    ...reading,
    section: sections.some((s) => s.slug === reading.section) ? reading.section : null,
    language: LANGUAGES.some((l) => l.code === reading.language) ? reading.language : null,
  }
  if (searchMemory.size >= SEARCH_MEMORY_SIZE) searchMemory.delete(searchMemory.keys().next().value ?? '')
  searchMemory.set(key, valid)
  return valid
}

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

const authorDraft = z.object({
  found: z.boolean().describe('False if no real author by this name could be identified with confidence.'),
  name: z.string().describe('The name as printed on their books.'),
  isZambian: z.boolean().describe('True only if sources say the author is Zambian or Zambia-based.'),
  bio: z
    .string()
    .describe('Third person, warm and plain, 100 to 200 words, only facts the sources support: background, what they write, notable work, and initiatives they run. Empty if found is false.'),
  books: z
    .array(
      z.object({
        title: z.string(),
        year: z.number().int().nullable(),
        publisher: z.string().nullable(),
        isbn: z.string().nullable().describe('ISBN-10 or ISBN-13 exactly as a source gives it; null if no source gives one.'),
      }),
    )
    .describe('Every book the author wrote or co-wrote that a source lists, most recent first. Authors often have many titles; list them all, including ebooks and small-press editions.'),
  initiatives: z
    .array(z.object({ name: z.string(), url: nullableText, note: z.string().describe('One sentence: what it is and anything current, like an upcoming event.') }))
    .describe('Projects, networks, ministries, podcasts or events the author runs or founded.'),
  photoUrl: nullableText.describe(
    'Direct URL of a JPEG, PNG or WebP portrait of the author published on a site they run (their own website or their publisher’s page about them). Null if there is none there; never from news sites, social media or image searches.',
  ),
  photoSource: nullableText.describe('URL of the page that shows photoUrl.'),
  links: z
    .object({ website: nullableText, facebook: nullableText, instagram: nullableText, x: nullableText, tiktok: nullableText })
    .describe('Profiles that are clearly the author’s own, as full URLs.'),
  contactEmail: nullableText.describe('An email the author publishes for enquiries on their own site, publisher page or official profile. Never a guess.'),
  contactEmailSource: nullableText.describe('URL of the page that shows contactEmail.'),
  contactPhone: nullableText.describe('A phone or WhatsApp number the author publishes for bookings or enquiries on their own site or official profile, in international format.'),
  contactPhoneSource: nullableText.describe('URL of the page that shows contactPhone.'),
  sources: z.array(z.object({ url: z.string(), title: z.string() })).describe('Every page a fact above came from.'),
  inviteSubject: z.string().describe('Email subject line inviting them to claim their page, under 70 characters.'),
  inviteBody: z
    .string()
    .describe(
      'Plain-text email, 90 to 140 words, from "The Kuwala Books team". Mention one of their books by name, say we made them a free author page on Kuwala Books (Zambia’s book marketplace), and that claiming it lets them add their photo and story, get verified, and sell copies directly. A button to claim the page follows the message, so end by pointing to it ("use the button below"); never ask them to reply for a link. No URLs or placeholders.',
    ),
  inviteWhatsapp: z.string().describe('The same invite as a short, friendly WhatsApp message under 60 words. The claim link is added straight after it, so end by pointing to it ("tap the link below"); never ask them to reply for it. No URLs.'),
})

export type AuthorDraftReading = z.infer<typeof authorDraft>

const AUTHOR_SYSTEM = `You research an author for Kuwala Books, a Zambian book marketplace, so the team can prepare a free author page and invite the author to claim it. Be thorough: the page should feel complete.
Work through this, reading pages rather than relying on search snippets:
1. Find the author's own website and read it: the home, about, books and contact pages.
2. Find every title: their Amazon author page, Goodreads, Google Books, their publishers and bookshops. Authors here often self-publish many books; list each one, with its ISBN when a source gives it.
3. Find their profiles (Facebook, Instagram, X, TikTok) and any initiatives they run: a network, ministry, podcast, festival or event, and what is coming up next. Facebook usually needs a login, so rely on search results for it.
4. Look for a portrait on a page they run, and for contact details they publish.
Only record facts that a source states; when sources disagree or you are unsure, leave it out. Never invent books, ISBNs, links or contact details.
Contact details: record an email or phone number only when the author (or their publisher, for them) publishes it for enquiries or bookings on a page they control. Never take personal numbers from news stories, comments, directories or other people's posts.
Do not describe the author's appearance, family or private life. When done, call record_author once.`

const RECORD_TOOL = 'record_author'
const AUTHOR_ROUNDS = 8

/** Researches an author on the web and drafts their page and invite. Admin reviews everything before it goes anywhere. */
export async function draftAuthor(db: Db, userId: string, input: { name: string; hints: string }) {
  const anthropic = claude()
  if (!anthropic) return null
  const tools: BetaToolUnion[] = [
    // No user_location: web search doesn't support Zambia as a country; the prompt carries the context.
    { type: 'web_search_20260209', name: 'web_search', max_uses: 12 },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 12 },
    { name: RECORD_TOOL, description: 'Record what you found about the author. Call once, at the end.', input_schema: z.toJSONSchema(authorDraft) as BetaTool.InputSchema },
  ]
  const messages: BetaMessageParam[] = [{ role: 'user', content: `Author: ${input.name}${input.hints ? `\nWhat we know: ${input.hints}` : ''}` }]
  let usage = { input_tokens: 0, output_tokens: 0 }
  let result: AuthorDraftReading | null = null
  try {
    for (let round = 0; round < AUTHOR_ROUNDS && !result; round++) {
      // If Claude stopped without recording, the last round makes it record what it has.
      const force = round === AUTHOR_ROUNDS - 1 || (messages.length > 1 && messages[messages.length - 1].role === 'user')
      const response = await anthropic.beta.messages.create(
        {
          model: AI_MODELS.reader,
          max_tokens: 16000,
          system: AUTHOR_SYSTEM,
          tools,
          messages,
          ...(force && { tool_choice: { type: 'tool', name: RECORD_TOOL } }),
        },
        { timeout: 240_000 },
      )
      usage = { input_tokens: usage.input_tokens + response.usage.input_tokens, output_tokens: usage.output_tokens + response.usage.output_tokens }
      const recorded = response.content.find((b) => b.type === 'tool_use' && b.name === RECORD_TOOL)
      if (recorded && recorded.type === 'tool_use') {
        const parsed = authorDraft.safeParse(recorded.input)
        if (parsed.success) result = parsed.data
        break
      }
      if (response.stop_reason === 'refusal') break
      messages.push({ role: 'assistant', content: response.content })
      // A paused server-side search resumes on its own; anything else gets a nudge to record.
      if (response.stop_reason !== 'pause_turn') messages.push({ role: 'user', content: `Record what you found with ${RECORD_TOOL}.` })
    }
  } catch (error) {
    console.error('[ai] author failed', error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error)
  }
  await db
    .insert(aiRequests)
    .values({ userId, kind: 'author', model: AI_MODELS.reader, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, ok: result !== null })
    .catch((error: unknown) => console.error('[ai] usage log failed', error))
  return result
}
