import { useEffect, useState } from 'react'
import { Shelf } from './book'
import type { BookCardData } from './book'

// Kept in this browser only: no account needed, nothing sent to the server.
const KEY = 'kb_recent'
const MAX = 12

function read(): BookCardData[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((b): b is BookCardData => typeof b?.slug === 'string' && typeof b?.title === 'string') : []
  } catch {
    return []
  }
}

/** Remembers a book page visit, newest first. The price shown later is from the visit. */
export function useRecordView(book: BookCardData) {
  useEffect(() => {
    try {
      const next = [book, ...read().filter((b) => b.slug !== book.slug)].slice(0, MAX)
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      // Storage blocked (private mode): nothing to remember.
    }
    // One record per book page, keyed by slug.
  }, [book.slug])
}

/** A shelf of the books this browser looked at, read after mount so cached pages stay the same for everyone. */
export function RecentlyViewed({ exclude }: { exclude?: string }) {
  const [books, setBooks] = useState<BookCardData[]>([])
  useEffect(() => setBooks(read().filter((b) => b.slug !== exclude)), [exclude])
  if (!books.length) return null
  return <Shelf title="Recently viewed" books={books} />
}
