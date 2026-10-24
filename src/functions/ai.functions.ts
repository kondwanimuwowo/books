import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import { PHOTO_SLOTS } from '#/data/ai'
import { MAX_LIST_PHOTOS } from '#/data/school-list'
import type { PhotoSlot } from '#/data/ai'
import { CONDITIONS } from '#/data/listing-options'
import type { Condition } from '#/data/listing-options'
import { toIsbn13 } from '#/lib/isbn'
import { checkAiLimit, readBookList, readBookPhotos, tidyBookName } from '#/server/ai.server'
import { requireSellerMiddleware, requireUserMiddleware } from '#/server/auth'
import { lookupIsbn, sameBook, sameSurname } from '#/server/book-sources.server'
import type { BookCandidate } from '#/server/book-sources.server'
import { cheapestCopies, findCatalogueMatches } from '#/server/catalog.server'
import type { CatalogueMatch } from '#/server/catalog.server'
import { detectImage, storeCover } from '#/server/covers.server'

// Photos are shrunk on the phone first (see readPhotos in sell.tsx); this only stops abuse.
const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const MEDIA_TYPES = { jpg: 'image/jpeg', webp: 'image/webp', png: 'image/png' } as const

export interface PhotoPrefill {
  title: string
  subtitle: string
  authors: string
  isbn: string
  publisher: string
  year: string
  language: string
  description: string
}

export type PhotoResult = {
  book: { kind: 'existing'; book: CatalogueMatch } | { kind: 'external'; candidate: BookCandidate } | { kind: 'manual'; prefill: PhotoPrefill }
  condition: Condition | null
  conditionNotes: string | null
  description: string | null
  summary: string | null
  /** The front photo, kept as the cover in case the book has none. */
  cover: { key: string; url: string } | null
}

/** Reads the seller's photos with Claude, then finds the book on Kuwala or online, or prefills the form. */
export const readPhotos = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error('Expected photos')
    const photos = PHOTO_SLOTS.flatMap(({ key }) => {
      const file = data.get(key)
      return file instanceof File ? [{ slot: key as PhotoSlot, file }] : []
    })
    if (!photos.some((p) => p.slot === 'front')) throw new Error('Add a photo of the front cover')
    if (photos.some((p) => p.file.size > MAX_PHOTO_BYTES)) throw new Error('That photo is too large')
    return photos
  })
  .handler(async ({ data, context }): Promise<PhotoResult> => {
    const db = getDb()
    await checkAiLimit(db, context.user.id, 'photos')
    const photos = await Promise.all(
      data.map(async ({ slot, file }) => {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const type = detectImage(bytes)
        if (!type) throw new Error('Use JPEG, WebP or PNG photos')
        return { slot, bytes, mediaType: MEDIA_TYPES[type] }
      }),
    )
    const reading = await readBookPhotos(db, context.user.id, photos)
    if (!reading) throw new Error('Couldn’t read those photos just now. Fill the details in yourself.')
    if (!reading.isBook || !reading.title) throw new Error('We couldn’t make out a book in those photos. Try a sharper photo of the front cover.')

    const front = photos.find((p) => p.slot === 'front')
    const condition = CONDITIONS.some((c) => c.value === reading.condition) ? (reading.condition as Condition) : null
    const suggestions = {
      condition,
      // Without a grade, any note is the model talking about the photos, not wear a buyer should read about.
      conditionNotes: condition ? reading.conditionNotes : null,
      description: reading.backCoverText,
      summary: reading.summary,
    }
    // The front photo becomes the cover only for a book that has none; too large a photo is simply skipped.
    const finish = async (book: PhotoResult['book'], coverUrl: string | null): Promise<PhotoResult> => {
      const cover = !coverUrl && front ? await storeCover(front.bytes, context.user.id).then((key) => ({ key, url: `/covers/${key}` }), () => null) : null
      return { book, ...suggestions, cover }
    }

    const isbn13 = reading.isbn ? toIsbn13(reading.isbn) : null
    const printed = { title: reading.title, authors: reading.authors }
    if (isbn13) {
      const [existing] = await findCatalogueMatches(db, isbn13, 1)
      if (existing) return finish({ kind: 'existing', book: existing }, existing.coverUrl)
      const online = await lookupIsbn(isbn13)
      // A misread digit can land on another book; only trust the lookup if it agrees with the cover.
      if (online && sameBook(online, printed)) {
        return finish({ kind: 'external', candidate: { ...online, description: online.description ?? reading.backCoverText } }, online.coverUrl)
      }
    }
    const matches = await findCatalogueMatches(db, reading.title, 5)
    const existing = matches.find((b) => sameBook({ title: b.title, authors: b.authorNames?.split(', ') ?? [] }, printed))
    if (existing) return finish({ kind: 'existing', book: existing }, existing.coverUrl)

    return finish(
      {
        kind: 'manual',
        prefill: {
          title: reading.title,
          subtitle: reading.subtitle ?? '',
          authors: reading.authors.join(', '),
          isbn: isbn13 ?? reading.isbn ?? '',
          publisher: reading.publisher ?? '',
          year: reading.publishedYear?.toString() ?? '',
          language: reading.language,
          description: reading.backCoverText ?? '',
        },
      },
      null,
    )
  })

/** A tidier title and author line when a seller types in capitals or puts "by …" or "hardcover" in the title. */
export const suggestTidyName = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(z.object({ title: z.string().trim().min(2).max(300), authors: z.string().trim().max(300) }))
  .handler(async ({ data, context }) => {
    const db = getDb()
    await checkAiLimit(db, context.user.id, 'tidy')
    const tidy = await tidyBookName(db, context.user.id, data)
    if (!tidy) return null
    const authors = tidy.authors.join(', ')
    if (tidy.title === data.title && authors === data.authors) return null
    return { title: tidy.title, subtitle: tidy.subtitle, authors }
  })

const MAX_LIST_TEXT = 4000

export type ListLine = {
  title: string
  author: string | null
  subject: string | null
  book: { slug: string; title: string; authorNames: string | null; coverUrl: string | null } | null
  /** The cheapest copy for sale now; null when the book is on Kuwala but sold out. */
  copy: { listingId: string; priceNgwee: number; condition: Condition } | null
}

// Words school lists add that catalogue titles leave out. Every search word must match, so fewer is safer.
const LIST_NOISE = /\b(pupils?['’]?s?|learners?['’]?s?|teachers?['’]?s?|book|new|revised|edition|ed)\b|[()\[\].,:;-]/gi

function listQuery(text: string, item: { author: string | null; publisher: string | null }) {
  let query = text
  for (const name of [item.author, item.publisher]) if (name) query = query.split(name).join(' ')
  return query.replace(LIST_NOISE, ' ').replace(/\s+/g, ' ').trim()
}

/** Reads a school book list (photos and/or typed text) and finds each book on Kuwala with its cheapest copy. */
export const readSchoolList = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error('Expected a list')
    const photos = data.getAll('photo').filter((f): f is File => f instanceof File)
    const text = String(data.get('text') ?? '').trim().slice(0, MAX_LIST_TEXT) || null
    if (!photos.length && !text) throw new Error('Add a photo of the list, or type it in')
    if (photos.length > MAX_LIST_PHOTOS) throw new Error(`Up to ${MAX_LIST_PHOTOS} photos`)
    if (photos.some((p) => p.size > MAX_PHOTO_BYTES)) throw new Error('That photo is too large')
    return { photos, text }
  })
  .handler(async ({ data, context }) => {
    const db = getDb()
    await checkAiLimit(db, context.user.id, 'list')
    const photos = await Promise.all(
      data.photos.map(async (file) => {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const type = detectImage(bytes)
        if (!type) throw new Error('Use JPEG, WebP or PNG photos')
        return { bytes, mediaType: MEDIA_TYPES[type] }
      }),
    )
    const reading = await readBookList(db, context.user.id, { photos, text: data.text })
    if (!reading) throw new Error('Couldn’t read the list just now. Try again in a moment.')
    if (!reading.isList || !reading.items.length) throw new Error('We couldn’t find any books on that list. Try a sharper photo.')

    const found = await Promise.all(
      reading.items.map(async (item) => {
        let matches: Awaited<ReturnType<typeof findCatalogueMatches>> = []
        for (const query of new Set([listQuery(item.searchTitle, item), listQuery(item.title, item)])) {
          if (query.length >= 2) matches = await findCatalogueMatches(db, query, 5)
          if (matches.length) break
        }
        // Prefer the same author when the list names one; school lists often shorten titles.
        const author = item.author
        return (author && matches.find((m) => sameSurname(m.authorNames, author))) || matches[0] || null
      }),
    )
    const copies = await cheapestCopies(
      db,
      found.flatMap((b) => (b ? [b.id] : [])),
    )
    const lines: ListLine[] = reading.items.map((item, i) => {
      const book = found[i]
      const copy = book ? copies.find((c) => c.bookId === book.id && c.sellerProfileId !== context.user.id) : undefined
      return {
        title: item.title,
        author: item.author,
        subject: item.subject,
        book: book ? { slug: book.slug, title: book.title, authorNames: book.authorNames, coverUrl: book.coverUrl } : null,
        copy: copy ? { listingId: copy.listingId, priceNgwee: copy.priceNgwee, condition: copy.condition as Condition } : null,
      }
    })
    return { school: reading.school, grade: reading.grade, lines }
  })
