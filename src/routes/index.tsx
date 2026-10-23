import { Link, createFileRoute } from '@tanstack/react-router'
import { getHomeData } from '#/functions/catalog.functions'
import { SectionShelf, Shelf } from '#/components/book'
import { MIN_WALL_COVERS, QUICK_SEARCHES } from '#/data/home'
import { EmptyMessage, PageShapes, Placeholder, ShelfShapes } from '#/components/placeholder'

export const Route = createFileRoute('/')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading" shapes={<PageShapes><ShelfShapes /></PageShapes>} />,
  loader: () => getHomeData(),
  component: Home,
})

function Home() {
  const { zambian, recent, bargains, categories, wall, towns } = Route.useLoaderData()
  const isEmpty = !zambian.length && !recent.length

  return (
    <>
      <Intro wall={wall} towns={towns} />

      <div className="page">
        {isEmpty && (
          <Placeholder
            mode="empty"
            label="Shelves"
            className="mt-10"
            shapes={<ShelfShapes />}
          >
            <EmptyMessage
              title="The shelves are still empty"
              action={
                <Link to="/sell" className="btn btn-primary">
                  List a book
                </Link>
              }
            />
          </Placeholder>
        )}

        <Shelf title="By Zambian authors" books={zambian} more={<MoreLink search={{ zambian: true }} />} />
        <Shelf title="Just listed" books={recent} more={<MoreLink search={{ sort: 'newest' }} />} />
        <Shelf title="Used, under K100" books={bargains} more={<MoreLink search={{ condition: 'used', sort: 'price' }} />} />

        {categories.length > 0 && (
          <section className="py-10" aria-labelledby="sections-heading">
            <h2 id="sections-heading" className="mb-6 text-xl sm:text-2xl">
              Pick a shelf
            </h2>
            <SectionShelf sections={categories} />
          </section>
        )}

        <section className="my-10 flex flex-col items-start justify-between gap-5 rounded-2xl bg-sunken px-6 py-8 sm:flex-row sm:items-center sm:px-10">
          <div>
            <h2 className="text-xl sm:text-2xl">Books gathering dust?</h2>
            <p className="mt-1 text-muted">Sell them here. Get paid by mobile money.</p>
          </div>
          <Link to="/sell" className="btn btn-secondary">
            Sell your books
          </Link>
        </section>
      </div>
    </>
  )
}

function townList(towns: string[]) {
  if (towns.length <= 1) return towns.join('')
  return `${towns.slice(0, -1).join(', ')} and ${towns.at(-1)}`
}

// Short band so the shelves stay above the fold; covers from the catalogue sit behind it once there are enough.
function Intro({ wall, towns }: { wall: string[]; towns: string[] }) {
  const tiles = wall.length >= MIN_WALL_COVERS ? Array.from({ length: 32 }, (_, i) => wall[i % wall.length]) : []

  return (
    <section className="band relative overflow-hidden">
      {tiles.length > 0 && (
        <>
          <div aria-hidden className="absolute -inset-6 grid -rotate-[4deg] grid-cols-[repeat(auto-fill,minmax(96px,1fr))] content-start gap-3 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
            {tiles.map((src, i) => (
              <img key={i} src={src} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-md object-cover" />
            ))}
          </div>
          <div aria-hidden className="absolute inset-0 bg-deep/85" />
        </>
      )}
      <div className="page rise relative py-8 sm:py-12">
        <h1 className="max-w-2xl text-[2rem] leading-[1.08] font-normal sm:text-5xl">
          Books from every corner of <span className="font-bold">Zambia</span>
        </h1>
        <p className="mt-3 max-w-xl text-on-deep-muted">New and used, from local authors, readers and bookshops.</p>
        {towns.length > 0 && <p className="mt-2 text-sm text-on-deep-muted">On the shelves now from {townList(towns)}.</p>}
        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Quick searches">
          {QUICK_SEARCHES.map((s) => (
            <li key={s.label}>
              <Link to="/search" search={s.search} className="pill h-8 bg-on-accent/10 text-on-accent no-underline hover:bg-on-accent/20 hover:text-on-accent">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function MoreLink({ search }: { search: Record<string, string | boolean> }) {
  return (
    <Link to="/search" search={search} className="shrink-0 text-sm font-medium text-accent-ink">
      See all
    </Link>
  )
}
