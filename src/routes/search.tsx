import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { AdjustmentsHorizontalIcon, ChevronDownIcon } from '@heroicons/react/16/solid'
import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { z } from 'zod'
import { searchBooksFn } from '#/functions/catalog.functions'
import { BookGrid } from '#/components/book'
import { FilterPanel, FilterSheet, activeFilterCount } from '#/components/search-filters'
import { LANGUAGES } from '#/data/zambia'
import { cn } from '#/lib/utils'
import { CoverGridShapes, PageShapes, Placeholder } from '#/components/placeholder'

const searchParams = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  zambian: z.boolean().optional(),
  condition: z.enum(['new', 'used']).optional(),
  language: z.string().optional(),
  min: z.number().min(0).optional(),
  max: z.number().min(0).optional(),
  sort: z.enum(['relevance', 'price', 'newest']).optional(),
  page: z.number().int().min(1).optional(),
  exact: z.boolean().optional(),
})

type SearchState = z.infer<typeof searchParams>
type Data = Awaited<ReturnType<typeof searchBooksFn>>

export const Route = createFileRoute('/search')({
  pendingComponent: () => <Placeholder mode="loading" label="Searching" shapes={<PageShapes><CoverGridShapes /></PageShapes>} />,
  validateSearch: searchParams,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => searchBooksFn({ data: deps }),
  head: ({ match }) => ({ meta: [{ title: match.search.q ? `${match.search.q} | Kuwala Books` : 'Browse books | Kuwala Books' }] }),
  component: SearchPage,
})

const SORTS = [
  { value: 'relevance', label: 'Best match' },
  { value: 'price', label: 'Lowest price' },
  { value: 'newest', label: 'Newest' },
] as const

function useSetSearch() {
  const navigate = useNavigate({ from: '/search' })
  return (patch: Partial<SearchState>) => navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined, exact: undefined }) })
}

function SearchPage() {
  const search = Route.useSearch()
  const { results, total, page, categories, interpreted, closeMatches } = Route.useLoaderData()
  const set = useSetSearch()
  // Desktop starts with filters showing; phones open them in a sheet.
  const [panel, setPanel] = useState(true)
  const [sheet, setSheet] = useState(false)
  const closeSheet = useCallback(() => setSheet(false), [])
  const sections = categories.filter((c) => c.count > 0)
  const only = search.category && !search.category.includes(',') ? categories.find((c) => c.slug === search.category) : undefined
  const title = search.q ? `“${search.q}”` : (only?.name ?? (search.zambian ? 'Zambian authors' : 'All books'))
  const pages = Math.ceil(total / 24)
  const active = activeFilterCount(search)
  const panelContent = <FilterPanel filters={search} sections={sections} onChange={set} />

  return (
    <div className="page py-8 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="truncate text-3xl sm:text-4xl">{title}</h1>
          <p className="mt-1 text-sm text-subtle tabular-nums">
            {total} {total === 1 ? 'book' : 'books'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm gap-1.5 lg:hidden" onClick={() => setSheet(true)}>
            <AdjustmentsHorizontalIcon className="size-4" aria-hidden />
            Filters{active > 0 && ` (${active})`}
          </button>
          <button type="button" className="btn btn-secondary btn-sm hidden gap-1.5 lg:inline-flex" aria-expanded={panel} onClick={() => setPanel(!panel)}>
            <AdjustmentsHorizontalIcon className="size-4" aria-hidden />
            {panel ? 'Hide filters' : `Filters${active > 0 ? ` (${active})` : ''}`}
          </button>
          <SortSelect value={search.sort} />
        </div>
      </header>

      {interpreted && search.q && <Interpreted applied={interpreted} typed={search.q} categories={categories} />}
      {closeMatches && <p className="mt-3 text-sm text-muted">No exact match, so these are the closest spellings.</p>}

      <FilterSheet open={sheet} onClose={closeSheet} total={total}>
        {panelContent}
      </FilterSheet>

      <div className={cn('mt-8', panel && 'lg:grid lg:grid-cols-[15rem_1fr] lg:gap-10')}>
        {panel && (
          <aside className="hidden lg:block" aria-label="Filters">
            <div className="sticky top-28 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2 pb-6">{panelContent}</div>
          </aside>
        )}
        <div className="min-w-0">
          {results.length ? <BookGrid books={results} layout={panel ? 'beside' : 'full'} /> : <NoResults query={search.q} filtered={active > 0} />}
          {pages > 1 && <Pager search={search} page={page} pages={pages} />}
        </div>
      </div>
    </div>
  )
}

/** Says how the search was read, and offers the exact words instead. */
function Interpreted({ applied, typed, categories }: { applied: NonNullable<Data['interpreted']>; typed: string; categories: Data['categories'] }) {
  const navigate = useNavigate({ from: '/search' })
  const filters = [
    applied.category && categories.find((c) => c.slug === applied.category)?.name,
    applied.language && `in ${LANGUAGES.find((l) => l.code === applied.language)?.name ?? applied.language}`,
    applied.condition,
    applied.zambian && 'Zambian authors',
  ].filter(Boolean)
  return (
    <p className="mt-3 text-sm text-muted">
      Showing {applied.q ? <span className="font-medium text-ink">{applied.q}</span> : 'books'}
      {filters.length > 0 && ` · ${filters.join(' · ')}`}.{' '}
      <button type="button" className="font-medium text-accent-ink" onClick={() => void navigate({ search: (prev) => ({ ...prev, exact: true, page: undefined }) })}>
        Search for “{typed}” instead
      </button>
    </p>
  )
}

function SortSelect({ value }: { value: SearchState['sort'] }) {
  const set = useSetSearch()
  return (
    <SelectPill label="Sort" value={value ?? 'relevance'} onChange={(v) => set({ sort: v === 'relevance' ? undefined : (v as SearchState['sort']) })}>
      {SORTS.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </SelectPill>
  )
}

function SelectPill({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <span className="relative inline-flex shrink-0">
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="pill appearance-none bg-sunken pr-8 text-ink hover:bg-sunken-strong">
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
    </span>
  )
}

function NoResults({ query, filtered }: { query?: string; filtered: boolean }) {
  return (
    <Placeholder mode="empty" label="Results" shapes={<CoverGridShapes count={5} />}>
      <p className="text-xl font-bold tracking-[-0.02em]">{query ? `No copies of “${query}” yet` : 'No books match'}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {filtered || query ? (
          <Link to="/search" className="btn btn-primary">
            Clear filters
          </Link>
        ) : null}
        {/* An empty search is a gap in the catalogue: invite the copy in. */}
        {query && (
          <Link to="/sell" className="btn btn-secondary">
            Have one? Sell it
          </Link>
        )}
      </div>
    </Placeholder>
  )
}

function Pager({ search, page, pages }: { search: SearchState; page: number; pages: number }) {
  return (
    <nav className="mt-12 flex items-center justify-center gap-3" aria-label="Pages">
      <Link to="/search" search={{ ...search, page: page - 1 }} disabled={page <= 1} className={cn('btn btn-secondary btn-sm', page <= 1 && 'pointer-events-none opacity-40')}>
        Previous
      </Link>
      <span className="text-sm text-subtle tabular-nums">
        {page} / {pages}
      </span>
      <Link to="/search" search={{ ...search, page: page + 1 }} disabled={page >= pages} className={cn('btn btn-secondary btn-sm', page >= pages && 'pointer-events-none opacity-40')}>
        Next
      </Link>
    </nav>
  )
}
