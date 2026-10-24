import { env } from 'cloudflare:workers'
import { cleanIsbn, toIsbn13 } from '#/lib/isbn'

// Lookup cascade for book metadata: our own catalogue first (see catalog.server.ts),
// then Google Books (best descriptions), then Open Library (no key, good covers, and
// descriptions on its work records). Google has refused requests for long stretches,
// so every path also works on Open Library alone.

// Open Library asks callers to identify themselves.
const OPEN_LIBRARY = { headers: { 'User-Agent': 'KuwalaBooks/1.0 (https://kuwalabooks.com)' } }

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
    const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn13}&format=json&jscmd=data`, OPEN_LIBRARY)
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
    const response = await fetch(`${url}?default=false`, { method: 'HEAD', ...OPEN_LIBRARY })
    return response.ok ? url : null
  } catch {
    return null
  }
}

type OpenLibraryText = string | { value?: string } | undefined

function olText(value: OpenLibraryText) {
  const text = typeof value === 'string' ? value : value?.value
  return text?.trim() || null
}

/** The edition's own description, or else its work's (where Open Library usually keeps it). */
async function openLibraryDescription(isbn13: string) {
  try {
    const edition = await fetch(`https://openlibrary.org/isbn/${isbn13}.json`, OPEN_LIBRARY)
    if (!edition.ok) return null
    const book = (await edition.json()) as { description?: OpenLibraryText; works?: { key: string }[] }
    const own = olText(book.description)
    if (own || !book.works?.[0]) return own
    const work = await fetch(`https://openlibrary.org${book.works[0].key}.json`, OPEN_LIBRARY)
    if (!work.ok) return null
    return olText(((await work.json()) as { description?: OpenLibraryText }).description)
  } catch {
    return null
  }
}

/** For a book saved without one: Google's blurb if it answers, otherwise Open Library's. */
export async function findDescription(input: string) {
  const isbn13 = toIsbn13(input)
  if (!isbn13) return null
  const [google] = await googleQuery(`isbn:${cleanIsbn(input)}`, 1)
  return google?.description ?? (await openLibraryDescription(isbn13))
}

/** Google first for metadata; Open Library fills gaps, and usually has the sharper cover. */
export async function lookupIsbn(input: string): Promise<BookCandidate | null> {
  const isbn13 = toIsbn13(input)
  if (!isbn13) return null
  const [google] = await googleQuery(`isbn:${cleanIsbn(input)}`, 1)
  const [openLibrary, olCover, olDescription] = await Promise.all([
    google ? Promise.resolve(null) : openLibraryByIsbn(isbn13),
    openLibraryCover(isbn13),
    google?.description ? Promise.resolve(null) : openLibraryDescription(isbn13),
  ])
  const base = google ?? openLibrary
  if (!base) return null
  return {
    ...base,
    isbn13,
    description: base.description ?? olDescription,
    coverUrl: olCover ?? base.coverUrl ?? openLibrary?.coverUrl ?? null,
  }
}

interface OpenLibraryDoc {
  title?: string
  subtitle?: string
  author_name?: string[]
  first_publish_year?: number
  number_of_pages_median?: number
  isbn?: string[]
  cover_i?: number
  publisher?: string[]
  editions?: { docs?: { title?: string; isbn?: string[]; publisher?: string[]; cover_i?: number; number_of_pages?: number; publish_date?: string[] }[] }
}

// ISBN groups 0 and 1 are English-language publishers.
function preferEnglish(isbns: string[] | undefined) {
  const valid = (isbns ?? []).map((i) => toIsbn13(i)).filter((i): i is string => i !== null)
  return valid.find((i) => i.startsWith('9780') || i.startsWith('9781')) ?? valid[0] ?? null
}

// Each result is a work. `lang=en` makes Open Library attach its best English edition, but only when an
// edition's own title matches the query; otherwise we fall back to the work's ISBNs.
async function openLibrarySearch(query: string, limit: number): Promise<BookCandidate[]> {
  const fields =
    'title,subtitle,author_name,first_publish_year,number_of_pages_median,isbn,cover_i,publisher,editions,editions.title,editions.isbn,editions.publisher,editions.cover_i,editions.number_of_pages,editions.publish_date'
  const params = new URLSearchParams({ q: query, limit: String(limit), lang: 'en', fields })
  try {
    const response = await fetch(`https://openlibrary.org/search.json?${params}`, OPEN_LIBRARY)
    if (!response.ok) return []
    const json = (await response.json()) as { docs?: OpenLibraryDoc[] }
    return (json.docs ?? []).flatMap((doc): BookCandidate[] => {
      const edition = doc.editions?.docs?.[0]
      const isbn13 = preferEnglish(edition?.isbn) ?? preferEnglish(doc.isbn)
      const title = edition?.title ?? doc.title
      const coverId = edition?.cover_i ?? doc.cover_i
      if (!title || !isbn13) return []
      return [
        {
          isbn13,
          isbn10: edition?.isbn?.find((i) => i.length === 10) ?? null,
          title,
          subtitle: doc.subtitle ?? null,
          authors: doc.author_name ?? [],
          // Fetched once the seller picks it, so a search costs one request.
          description: null,
          coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null,
          publisher: edition?.publisher?.[0] ?? doc.publisher?.[0] ?? null,
          publishedYear: year(edition?.publish_date?.[0]) ?? doc.first_publish_year ?? null,
          pageCount: edition?.number_of_pages ?? doc.number_of_pages_median ?? null,
          language: 'en',
          source: 'openlibrary',
        },
      ]
    })
  } catch {
    return []
  }
}

export async function searchExternal(query: string): Promise<BookCandidate[]> {
  // Only offer results we can identify by ISBN; anything else should go through manual entry.
  const google = (await googleQuery(query, 12)).filter((r) => r.isbn13)
  return google.length ? google : openLibrarySearch(query, 12)
}
