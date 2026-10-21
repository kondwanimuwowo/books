import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { getHomeData } from '#/functions/catalog.functions'
import { Shelf } from '#/components/book'

export const Route = createFileRoute('/')({
  loader: () => getHomeData(),
  component: Home,
})

const QUICK_SEARCHES = [
  { label: 'Zambian authors', search: { zambian: true } },
  { label: 'School textbooks', search: { category: 'textbooks' } },
  { label: 'Used books', search: { condition: 'used' as const } },
  { label: 'Bemba', search: { language: 'bem' } },
  { label: 'Nyanja', search: { language: 'nya' } },
]

function Home() {
  const { zambian, recent, bargains, categories } = Route.useLoaderData()
  const isEmpty = !zambian.length && !recent.length

  return (
    <div className="page">
      <section className="rise py-10 sm:py-14">
        <h1 className="max-w-2xl text-4xl leading-[1.05] sm:text-5xl">Books from every corner of Zambia</h1>
        <p className="mt-4 max-w-xl text-lg text-neutral-700">
          New and used copies from local authors, readers and bookshops. Pay with mobile money, and your money is held until the books reach you.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {QUICK_SEARCHES.map((s) => (
            <Link key={s.label} to="/search" search={s.search} className="pill bg-neutral-100 text-ink hover:bg-neutral-200 hover:text-ink">
              {s.label}
            </Link>
          ))}
        </div>
      </section>

      {isEmpty && (
        <section className="card p-8 text-center">
          <h2 className="text-xl">The shelves are being stocked</h2>
          <p className="mt-2 text-neutral-700">Be one of the first sellers on Kuwala Books.</p>
          <Link to="/sell" className="btn btn-primary mt-5">
            List a book
          </Link>
        </section>
      )}

      <Shelf
        title="By Zambian authors"
        note="Stories, history and knowledge written here at home"
        books={zambian}
        more={<MoreLink search={{ zambian: true }} />}
      />
      <Shelf title="Just listed" note="Fresh copies from sellers across the country" books={recent} more={<MoreLink search={{ sort: 'newest' }} />} />
      <Shelf title="Used, under K100" note="Pre-loved books at reader-friendly prices" books={bargains} more={<MoreLink search={{ condition: 'used', sort: 'price' }} />} />

      {categories.length > 0 && (
        <section className="py-8">
          <h2 className="mb-5 text-xl sm:text-2xl">Browse by section</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((c) => (
              <Link
                key={c.slug}
                to="/search"
                search={{ category: c.slug }}
                className="flex items-center justify-between rounded-xl bg-neutral-100 px-4 py-4 text-ink no-underline transition-colors hover:bg-accent-100 hover:text-ink"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-sm text-neutral-600 tabular-nums">{c.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="my-8 flex flex-col items-start justify-between gap-5 rounded-2xl bg-accent-900 px-6 py-8 text-white sm:flex-row sm:items-center sm:px-10">
        <div>
          <h2 className="text-2xl">Have books to sell?</h2>
          <p className="mt-1 max-w-lg text-accent-200">
            Authors, bookshops and readers list in minutes. Scan the ISBN, set your price, and get paid to your mobile money when the buyer receives the book.
          </p>
        </div>
        <Link to="/sell" className="btn bg-white text-accent-900 hover:bg-accent-100 hover:text-accent-900">
          Start selling <ArrowRight size={16} aria-hidden />
        </Link>
      </section>
    </div>
  )
}

function MoreLink({ search }: { search: Record<string, string | boolean> }) {
  return (
    <Link to="/search" search={search} className="shrink-0 text-sm font-medium text-accent-700">
      See all
    </Link>
  )
}
