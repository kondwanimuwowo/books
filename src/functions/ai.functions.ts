import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import { PHOTO_SLOTS } from '#/data/ai'
import type { PhotoSlot } from '#/data/ai'
import { CONDITIONS } from '#/data/listing-options'
import type { Condition } from '#/data/listing-options'
import { toIsbn13 } from '#/lib/isbn'
import { checkAiLimit, readBookPhotos, tidyBookName } from '#/server/ai.server'
import { requireSellerMiddleware } from '#/server/auth'
import { lookupIsbn, sameBook } from '#/server/book-sources.server'
import type { BookCandidate } from '#/server/book-sources.server'
import { findCatalogueMatches } from '#/server/catalog.server'
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
