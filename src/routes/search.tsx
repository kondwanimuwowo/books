import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronDownIcon } from '@heroicons/react/16/solid'
import type { ReactNode } from 'react'
import { z } from 'zod'
import { searchBooksFn } from '#/functions/catalog.functions'
import { BookGrid } from '#/components/book'
import { LANGUAGES } from '#/data/zambia'
import { cn } from '#/lib/utils'
import { CoverGridShapes, PageShapes, Placeholder } from '#/components/placeholder'

const searchParams = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  zambian: z.boolean().optional(),
  condition: z.enum(['new', 'used']).optional(),
  language: z.string().optional(),
  sort: z.enum(['relevance', 'price', 'newest']).optional(),
  page: z.number().int().min(1).optional(),
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

const CONDITION_OPTIONS = [
  { value: undefined, label: 'Any' },
  { value: 'new', label: 'New' },
  { value: 'used', label: 'Used' },
] as const

function useSetSearch() {
  const navigate = useNavigate({ from: '/search' })
  return (patch: Partial<SearchState>) => navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }) })
}

function SearchPage() {
  const search = Route.useSearch()
  const { results, total, page, categories } = Route.useLoaderData()
  const category = categories.find((c) => c.slug === search.category)
  const title = search.q ? `“${search.q}”` : (category?.name ?? (search.zambian ? 'Zambian authors' : 'All books'))
  const pages = Math.ceil(total / 24)
  const filtered = !!(search.zambian || search.condition || search.category || search.language)

  return (
    <div className="page py-8 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h1 className="truncate text-3xl sm:text-4xl">{title}</h1>
          <p className="mt-1 text-sm text-subtle tabular-nums">
            {total} {total === 1 ? 'book' : 'books'}
          </p>
        </div>
        <SortSelect value={search.sort} />
      </header>

      {/* Phones: one scrolling row of chips. Desktop: a rail beside the results. */}
      <MobileFilters search={search} categories={categories} />

      <div className="mt-8 lg:grid lg:grid-cols-[13rem_1fr] lg:gap-10">
        <FilterRail search={search} categories={categories} />
        <div className="min-w-0">
          {results.length ? (
            <BookGrid books={results} />
          ) : (
            <NoResults query={search.q} filtered={filtered} />
          )}
          {pages > 1 && <Pager search={search} page={page} pages={pages} />}
        </div>
      </div>
    </div>
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

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('pill shrink-0', active ? 'bg-accent-soft text-accent-soft-ink shadow-[inset_0_0_0_1px_var(--color-accent-ink)]' : 'bg-sunken text-ink hover:bg-sunken-strong')}
    >
      {children}
    </button>
  )
}

function MobileFilters({ search, categories }: { search: SearchState; categories: Data['categories'] }) {
  const set = useSetSearch()
  return (
    <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:hidden">
      <Chip active={!!search.zambian} onClick={() => set({ zambian: search.zambian ? undefined : true })}>
        Zambian authors
      </Chip>
      <Chip active={search.condition === 'new'} onClick={() => set({ condition: search.condition === 'new' ? undefined : 'new' })}>
        New
      </Chip>
      <Chip active={search.condition === 'used'} onClick={() => set({ condition: search.condition === 'used' ? undefined : 'used' })}>
        Used
      </Chip>
      <SelectPill label="Section" value={search.category ?? ''} onChange={(v) => set({ category: v || undefined })}>
        <option value="">All sections</option>
        {categories.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </SelectPill>
      <SelectPill label="Language" value={search.language ?? ''} onChange={(v) => set({ language: v || undefined })}>
        <option value="">Any language</option>
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.name}
          </option>
        ))}
      </SelectPill>
    </div>
  )
}

function RailGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-0.5">
      <legend className="eyebrow mb-2">{title}</legend>
      {children}
    </fieldset>
  )
}

function RailOption({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: ReactNode; count?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
        active ? 'bg-accent-soft font-medium text-accent-soft-ink' : 'text-muted hover:bg-sunken hover:text-ink',
      )}
    >
      <span className="truncate">{children}</span>
      {count ? <span className="text-xs text-subtle tabular-nums">{count}</span> : null}
    </button>
  )
}

function FilterRail({ search, categories }: { search: SearchState; categories: Data['categories'] }) {
  const set = useSetSearch()
  return (
    <aside className="hidden space-y-8 lg:block" aria-label="Filters">
      <RailGroup title="Show">
        <RailOption active={!!search.zambian} onClick={() => set({ zambian: search.zambian ? undefined : true })}>
          Zambian authors only
        </RailOption>
      </RailGroup>
      <RailGroup title="Condition">
        {CONDITION_OPTIONS.map((c) => (
          <RailOption key={c.label} active={search.condition === c.value} onClick={() => set({ condition: c.value })}>
            {c.label}
          </RailOption>
        ))}
      </RailGroup>
      <RailGroup title="Section">
        <RailOption active={!search.category} onClick={() => set({ category: undefined })}>
          All
        </RailOption>
        {categories.map((c) => (
          <RailOption key={c.slug} active={search.category === c.slug} onClick={() => set({ category: c.slug })} count={c.count}>
            {c.name}
          </RailOption>
        ))}
      </RailGroup>
      <RailGroup title="Language">
        <RailOption active={!search.language} onClick={() => set({ language: undefined })}>
          Any
        </RailOption>
        {LANGUAGES.slice(0, 8).map((l) => (
          <RailOption key={l.code} active={search.language === l.code} onClick={() => set({ language: l.code })}>
            {l.name}
          </RailOption>
        ))}
      </RailGroup>
    </aside>
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
          <Link to="/sell" className="btn btn-ghost">
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
