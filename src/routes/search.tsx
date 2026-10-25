import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { AdjustmentsHorizontalIcon } from '@heroicons/react/16/solid'
import { useCallback, useRef, useState } from 'react'
import { z } from 'zod'
import { searchBooksFn } from '#/functions/catalog.functions'
import { BookGrid } from '#/components/book'
import { FilterPanel, FilterSheet, activeFilterCount } from '#/components/search-filters'
import { LANGUAGES } from '#/data/zambia'
import { cn } from '#/lib/utils'
import { CoverGridShapes, PageShapes, Placeholder } from '#/components/placeholder'
import { LoadingLine } from '#/components/loading-line'
import { Select } from '#/components/select'

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
  pendingComponent: SearchPending,
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

function SearchPending() {
  return (
    <div className="relative">
      <Placeholder mode="loading" label="Searching" shapes={<PageShapes><CoverGridShapes /></PageShapes>} />
      <div className="page pointer-events-none absolute inset-x-0 top-[5.5rem] lg:top-[6.25rem]">
        <LoadingLine kind="find" className="w-fit rounded-full bg-surface py-1.5 pr-4 pl-3 shadow-md" />
      </div>
    </div>
  )
}

// Blurs the grid for a beat as its columns change, so cards re-flowing into a new count read as one move.
const REFLOW: Keyframe[] = [
  { opacity: 0.35, filter: 'blur(4px)' },
  { opacity: 1, filter: 'blur(0px)' },
]

function SearchPage() {
  const search = Route.useSearch()
  const { results, total, page, categories, interpreted, closeMatches } = Route.useLoaderData()
  const set = useSetSearch()
  // New filters keep this page up while the next results load; it dims and says it's working.
  const fetching = Route.useMatch({ select: (m) => !!m.isFetching })
  const results$ = useRef<HTMLDivElement>(null)
  // Desktop starts with filters showing; phones open them in a sheet.
  const [panel, setPanel] = useState(true)
  const togglePanel = () => {
    setPanel(!panel)
    results$.current?.animate(REFLOW, { duration: 450, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' })
  }
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
          <div className="mt-1 h-5 text-sm text-subtle tabular-nums">
            {fetching ? (
              <LoadingLine kind="find" />
            ) : (
              <p>
                {total} {total === 1 ? 'book' : 'books'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm gap-1.5 lg:hidden" onClick={() => setSheet(true)}>
            <AdjustmentsHorizontalIcon className="size-4" aria-hidden />
            Filters{active > 0 && ` (${active})`}
          </button>
          <button type="button" className="btn btn-secondary btn-sm hidden gap-1.5 lg:inline-flex" aria-expanded={panel} aria-controls="filter-panel" onClick={togglePanel}>
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

      {/* The panel's column slides shut rather than vanishing; the results widen into the space. */}
      <div
        className={cn(
          'mt-8 lg:grid lg:transition-[grid-template-columns,column-gap] lg:duration-[450ms] lg:ease-in-out motion-reduce:transition-none',
          panel ? 'lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-x-10' : 'lg:grid-cols-[0rem_minmax(0,1fr)] lg:gap-x-0',
        )}
      >
        <aside id="filter-panel" className="hidden overflow-x-clip lg:block" aria-label="Filters" inert={!panel}>
          <div
            className={cn(
              'sticky top-28 max-h-[calc(100dvh-8rem)] w-60 overflow-y-auto pr-2 pb-6 transition-[opacity,translate] duration-300 ease-out motion-reduce:translate-none',
              panel ? 'opacity-100' : '-translate-x-3 opacity-0',
            )}
          >
            {panelContent}
          </div>
        </aside>
        <div ref={results$} className={cn('min-w-0 transition-opacity duration-300', fetching && 'opacity-55')}>
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
    <Select variant="pill" aria-label="Sort" value={value ?? 'relevance'} options={[...SORTS]} onChange={(v) => set({ sort: v === 'relevance' ? undefined : v })} />
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
