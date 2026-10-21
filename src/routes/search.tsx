import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { searchBooksFn } from '#/functions/catalog.functions'
import { BookGrid } from '#/components/book'
import { LANGUAGES } from '#/data/zambia'
import { cn } from '#/lib/utils'

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

export const Route = createFileRoute('/search')({
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

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('pill shrink-0', active ? 'bg-accent-700 text-white' : 'bg-neutral-100 text-ink hover:bg-neutral-200')}
    >
      {children}
    </button>
  )
}

function SearchPage() {
  const search = Route.useSearch()
  const { results, total, page, categories } = Route.useLoaderData()
  const navigate = useNavigate({ from: '/search' })
  const set = (patch: Partial<SearchState>) => navigate({ search: (prev) => ({ ...prev, ...patch, page: undefined }) })

  const category = categories.find((c) => c.slug === search.category)
  const title = search.q ? `Results for “${search.q}”` : (category?.name ?? (search.zambian ? 'Zambian authors' : 'All books'))
  const pages = Math.ceil(total / 24)

  return (
    <div className="page py-8">
      <h1 className="text-2xl sm:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-neutral-700 tabular-nums">
        {total} {total === 1 ? 'book' : 'books'}
      </p>

      <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        <FilterPill active={!!search.zambian} onClick={() => set({ zambian: search.zambian ? undefined : true })}>
          Zambian authors
        </FilterPill>
        <FilterPill active={search.condition === 'new'} onClick={() => set({ condition: search.condition === 'new' ? undefined : 'new' })}>
          New
        </FilterPill>
        <FilterPill active={search.condition === 'used'} onClick={() => set({ condition: search.condition === 'used' ? undefined : 'used' })}>
          Used
        </FilterPill>
        <select
          value={search.category ?? ''}
          onChange={(e) => set({ category: e.target.value || undefined })}
          aria-label="Section"
          className="pill shrink-0 appearance-none bg-neutral-100 pr-4 text-ink"
        >
          <option value="">All sections</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={search.language ?? ''}
          onChange={(e) => set({ language: e.target.value || undefined })}
          aria-label="Language"
          className="pill shrink-0 appearance-none bg-neutral-100 pr-4 text-ink"
        >
          <option value="">Any language</option>
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
        <select
          value={search.sort ?? 'relevance'}
          onChange={(e) => set({ sort: e.target.value === 'relevance' ? undefined : (e.target.value as SearchState['sort']) })}
          aria-label="Sort"
          className="pill ml-auto shrink-0 appearance-none bg-neutral-100 pr-4 text-ink"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-8">
        {results.length ? (
          <BookGrid books={results} />
        ) : (
          <div className="py-16 text-center">
            <p className="text-lg font-medium">No books matched</p>
            <p className="mt-1 text-neutral-700">Check the spelling, or search by author or ISBN instead.</p>
            <Link to="/search" className="btn btn-secondary mt-5">
              Clear filters
            </Link>
          </div>
        )}
      </div>

      {pages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Pages">
          <Link to="/search" search={{ ...search, page: page - 1 }} disabled={page <= 1} className={cn('btn btn-secondary btn-sm', page <= 1 && 'pointer-events-none opacity-40')}>
            Previous
          </Link>
          <span className="text-sm text-neutral-700 tabular-nums">
            Page {page} of {pages}
          </span>
          <Link to="/search" search={{ ...search, page: page + 1 }} disabled={page >= pages} className={cn('btn btn-secondary btn-sm', page >= pages && 'pointer-events-none opacity-40')}>
            Next
          </Link>
        </nav>
      )}
    </div>
  )
}
