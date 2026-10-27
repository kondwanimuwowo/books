import type { Db } from '#/db/client.server'
import { SEARCH_REQUEST_WORDS } from '#/data/ai'
import { MIN_WALL_COVERS, WALL_TILES } from '#/data/home'
import { toIsbn13 } from '#/lib/isbn'
import type { SearchInput } from '#/schemas/catalog'
import { interpretSearch } from './ai.server'
import { categoriesWithCounts, listDirectory, searchBooks, shelf } from './catalog.server'
import { loadChart } from './chart.server'

export async function loadHome(db: Db) {
  const [chart, zambian, recent, bargains, categories] = await Promise.all([
    loadChart(db),
    shelf(db, 'zambian'),
    shelf(db, 'recent'),
    shelf(db, 'bargains'),
    categoriesWithCounts(db),
  ])
  // The intro band's cover background reuses covers already loaded for the shelves.
  const wall = coverWall([...new Set([...recent, ...zambian, ...bargains].map((b) => b.coverUrl).filter((c): c is string => !!c))].slice(0, 24))
  return { chart: chart.entries.slice(0, 10), zambian, recent, bargains, categories, wall }
}

function shuffle<T>(items: T[]) {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Every cover in a fresh random order each round, never the same one twice in a row. Empty when there are too few. */
function coverWall(covers: string[]) {
  if (covers.length < MIN_WALL_COVERS) return []
  const tiles: string[] = []
  while (tiles.length < WALL_TILES) {
    const round = shuffle(covers)
    if (round[0] === tiles.at(-1)) round.push(round.shift() as string)
    tiles.push(...round)
  }
  return tiles.slice(0, WALL_TILES)
}

export async function loadChartPage(db: Db) {
  const [chart, zambian] = await Promise.all([loadChart(db), shelf(db, 'zambian')])
  return { ...chart, zambian }
}

/**
 * When a search finds nothing, or reads like a request ("grade 7 maths in Bemba"), Claude rewrites it into keywords
 * and filters. The rewrite is only used if it finds books; the page then offers the exact search too.
 */
async function interpretIfUseful(db: Db, data: SearchInput, total: number, sections: { slug: string; name: string }[]) {
  const q = data.q?.trim()
  if (!q || data.exact || (data.page ?? 1) > 1 || q.length < 3 || toIsbn13(q)) return null
  if (total > 0 && !SEARCH_REQUEST_WORDS.test(q)) return null
  const reading = await interpretSearch(db, q, sections)
  if (!reading) return null
  const applied = {
    q: reading.query.trim() || undefined,
    category: data.category ?? reading.section ?? undefined,
    language: data.language ?? reading.language ?? undefined,
    condition: data.condition ?? reading.condition ?? undefined,
    zambian: data.zambian || reading.zambian || undefined,
  }
  const changed =
    applied.q?.toLowerCase() !== q.toLowerCase() ||
    applied.category !== data.category ||
    applied.language !== data.language ||
    applied.condition !== data.condition ||
    applied.zambian !== data.zambian
  if (!changed) return null
  const result = await searchBooks(db, { ...data, ...applied })
  if (result.total > 0) return { result, applied }
  // Keywords plus filters can be too narrow; the filters alone still answer "used Zambian novels".
  const hasFilters = applied.category || applied.language || applied.condition || applied.zambian
  if (!applied.q || !hasFilters) return null
  const broader = { ...applied, q: undefined }
  const fallback = await searchBooks(db, { ...data, ...broader })
  return fallback.total > 0 ? { result: fallback, applied: broader } : null
}

export async function runSearch(db: Db, data: SearchInput) {
  const [result, categories] = await Promise.all([searchBooks(db, data), categoriesWithCounts(db)])
  // A misspelt title ("eccentric thots") is found by close spelling first; that's free, Claude isn't.
  if (!result.total && data.q?.trim() && !data.exact && !toIsbn13(data.q)) {
    const close = await searchBooks(db, { ...data, fuzzy: true })
    if (close.total) return { ...close, categories, interpreted: null, closeMatches: true }
  }
  const interpreted = await interpretIfUseful(db, data, result.total, categories)
  return interpreted
    ? { ...interpreted.result, categories, interpreted: interpreted.applied, closeMatches: false }
    : { ...result, categories, interpreted: null, closeMatches: false }
}

const QUICK_BOOKS = 6
const QUICK_AUTHORS = 3

/** Results for a search box as someone types: exact words, then close spellings. No AI, it must keep up. */
export async function quickSearchBooks(db: Db, q: string) {
  const [exact, authors] = await Promise.all([searchBooks(db, { q, limit: QUICK_BOOKS }), listDirectory(db, 'authors', { query: q, limit: QUICK_AUTHORS })])
  const books = exact.total || toIsbn13(q) ? exact : await searchBooks(db, { q, limit: QUICK_BOOKS, fuzzy: true })
  return { books: books.results, total: books.total, authors }
}
