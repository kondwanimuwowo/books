import { env } from 'cloudflare:workers'
import { cleanIsbn, toIsbn13 } from '#/lib/isbn'

// Lookup cascade for book metadata: our own catalogue first (see catalog.server.ts),
// then Google Books (best descriptions), then Open Library (no key, good covers).

export interface BookCandidate {
  isbn13: string | null
  isbn10: string | null
  title: string
  subtitle: string | null
  authors: string[]
  description: string | null
  coverUrl: string | null
  publisher: string | null
  publishedYear: number | null
  pageCount: number | null
  language: string
  source: 'google' | 'openlibrary'
}

interface GoogleVolume {
  volumeInfo: {
    title?: string
    subtitle?: string
    authors?: string[]
    publisher?: string
    publishedDate?: string
    description?: string
    pageCount?: number
    language?: string
    industryIdentifiers?: { type: string; identifier: string }[]
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
  }
}

function year(value: string | undefined) {
  const match = value?.match(/\d{4}/)
  return match ? Number(match[0]) : null
}

function stripHtml(value: string | undefined) {
  return value ? value.replace(/<[^>]+>/g, '').trim() : null
}

function googleCover(links: GoogleVolume['volumeInfo']['imageLinks']) {
  const url = links?.thumbnail ?? links?.smallThumbnail
  return url ? url.replace('http://', 'https://').replace('&edge=curl', '') : null
}

function fromGoogle(volume: GoogleVolume): BookCandidate | null {
  const info = volume.volumeInfo
  if (!info.title) return null
  const ids = info.industryIdentifiers ?? []
  const isbn13 = ids.find((i) => i.type === 'ISBN_13')?.identifier ?? null
  const isbn10 = ids.find((i) => i.type === 'ISBN_10')?.identifier ?? null
  return {
    isbn13: isbn13 ?? (isbn10 ? toIsbn13(isbn10) : null),
    isbn10,
    title: info.title,
    subtitle: info.subtitle ?? null,
    authors: info.authors ?? [],
    description: stripHtml(info.description),
    coverUrl: googleCover(info.imageLinks),
    publisher: info.publisher ?? null,
    publishedYear: year(info.publishedDate),
    pageCount: info.pageCount ?? null,
    language: info.language ?? 'en',
    source: 'google',
  }
}

async function googleQuery(q: string, maxResults: number) {
  const params = new URLSearchParams({ q, maxResults: String(maxResults), printType: 'books' })
  if (env.GOOGLE_BOOKS_API_KEY) params.set('key', env.GOOGLE_BOOKS_API_KEY)
  try {
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`)
    if (!response.ok) return []
    const json = (await response.json()) as { items?: GoogleVolume[] }
    return (json.items ?? []).map(fromGoogle).filter((b): b is BookCandidate => b !== null)
  } catch {
    return []
  }
}

interface OpenLibraryBook {
  title?: string
  subtitle?: string
  authors?: { name: string }[]
  publishers?: { name: string }[]
  publish_date?: string
  number_of_pages?: number
  cover?: { large?: string; medium?: string }
  identifiers?: { isbn_13?: string[]; isbn_10?: string[] }
}

async function openLibraryByIsbn(isbn13: string): Promise<BookCandidate | null> {
  try {
    const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn13}&format=json&jscmd=data`)
    if (!response.ok) return null
    const json = (await response.json()) as Record<string, OpenLibraryBook | undefined>
    const book = json[`ISBN:${isbn13}`]
    if (!book?.title) return null
    return {
      isbn13,
      isbn10: book.identifiers?.isbn_10?.[0] ?? null,
      title: book.title,
      subtitle: book.subtitle ?? null,
      authors: (book.authors ?? []).map((a) => a.name),
      description: null,
      coverUrl: book.cover?.large ?? book.cover?.medium ?? null,
      publisher: book.publishers?.[0]?.name ?? null,
      publishedYear: year(book.publish_date),
      pageCount: book.number_of_pages ?? null,
      language: 'en',
      source: 'openlibrary',
    }
  } catch {
    return null
  }
}

async function openLibraryCover(isbn13: string) {
  const url = `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`
  try {
    const response = await fetch(`${url}?default=false`, { method: 'HEAD' })
    return response.ok ? url : null
  } catch {
    return null
  }
}

/** Google first for metadata; Open Library fills gaps, and usually has the sharper cover. */
export async function lookupIsbn(input: string): Promise<BookCandidate | null> {
  const isbn13 = toIsbn13(input)
  if (!isbn13) return null
  const [google] = await googleQuery(`isbn:${cleanIsbn(input)}`, 1)
  const [openLibrary, olCover] = await Promise.all([google?.description ? Promise.resolve(null) : openLibraryByIsbn(isbn13), openLibraryCover(isbn13)])
  const base = google ?? openLibrary
  if (!base) return null
  return {
    ...base,
    isbn13,
    description: base.description ?? openLibrary?.description ?? null,
    coverUrl: olCover ?? base.coverUrl ?? openLibrary?.coverUrl ?? null,
  }
}

export async function searchExternal(query: string): Promise<BookCandidate[]> {
  const results = await googleQuery(query, 12)
  // Only offer results we can identify by ISBN; anything else should go through manual entry.
  return results.filter((r) => r.isbn13)
}
