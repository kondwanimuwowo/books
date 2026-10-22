import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { getHomeData } from '#/functions/catalog.functions'
import { SectionCard, Shelf } from '#/components/book'
import { MIN_WALL_COVERS, QUICK_SEARCHES } from '#/data/home'

export const Route = createFileRoute('/')({
  loader: () => getHomeData(),
  component: Home,
})

function Home() {
  const { zambian, recent, bargains, categories, wall } = Route.useLoaderData()
  const isEmpty = !zambian.length && !recent.length

  return (
    <>
      <Intro wall={wall} />

      <div className="page">
        {isEmpty && (
          <section className="card mt-10 p-8 text-center">
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
          <section className="py-10">
            <h2 className="mb-6 text-xl sm:text-2xl">Browse by section</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((c) => (
                <SectionCard key={c.slug} section={c} />
              ))}
            </div>
          </section>
        )}

        <section className="my-10 flex flex-col items-start justify-between gap-5 rounded-2xl bg-accent-900 px-6 py-8 text-white shadow-lg sm:flex-row sm:items-center sm:px-10">
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
    </>
  )
}

// Short band so the shelves stay above the fold; covers from the catalogue sit behind it once there are enough.
function Intro({ wall }: { wall: string[] }) {
  const tiles = wall.length >= MIN_WALL_COVERS ? Array.from({ length: 32 }, (_, i) => wall[i % wall.length]) : []

  return (
    <section className="relative overflow-hidden bg-accent-900">
      {tiles.length > 0 && (
        <>
          <div aria-hidden className="absolute -inset-6 grid -rotate-[4deg] grid-cols-[repeat(auto-fill,minmax(96px,1fr))] content-start gap-3 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
            {tiles.map((src, i) => (
              <img key={i} src={src} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-md bg-accent-800 object-cover" />
            ))}
          </div>
          <div aria-hidden className="absolute inset-0 bg-accent-900/80" />
        </>
      )}
      <div className="page rise relative py-8 sm:py-10">
        <h1 className="max-w-2xl text-3xl leading-[1.1] text-white sm:text-4xl">Books from every corner of Zambia</h1>
        <p className="mt-2 max-w-xl text-accent-200">New and used copies from local authors, readers and bookshops. Your money is held until the books reach you.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {QUICK_SEARCHES.map((s) => (
            <Link key={s.label} to="/search" search={s.search} className="pill h-8 bg-white/10 text-white no-underline hover:bg-white/20 hover:text-white">
              {s.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function MoreLink({ search }: { search: Record<string, string | boolean> }) {
  return (
    <Link to="/search" search={search} className="shrink-0 text-sm font-medium text-accent-700">
      See all
    </Link>
  )
}
