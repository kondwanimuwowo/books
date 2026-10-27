import { ChevronRightIcon } from '@heroicons/react/16/solid'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useRef } from 'react'
import { getHomeData } from '#/functions/catalog.functions'
import { SectionShelf, Shelf } from '#/components/book'
import { RecentlyViewed } from '#/components/recently-viewed'
import { QUICK_SEARCHES } from '#/data/home'
import { EmptyMessage, PageShapes, Placeholder, ShelfShapes } from '#/components/placeholder'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading" shapes={<PageShapes><ShelfShapes /></PageShapes>} />,
  loader: () => getHomeData(),
  component: Home,
})

function Home() {
  const { chart, zambian, recent, bargains, categories, wall } = Route.useLoaderData()
  const isEmpty = !zambian.length && !recent.length

  return (
    <>
      <Intro wall={wall} />

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

        <Shelf
          title="Zambia Top 20"
          ranked
          books={chart.map((e) => e.book)}
          more={
            <Link to="/top-20" className="shrink-0 btn btn-secondary btn-sm">
              Full chart
            </Link>
          }
        />
        <Shelf title="New from Zambian authors" books={zambian} more={<MoreLink search={{ zambian: true }} />} />
        <Shelf title="Just listed" books={recent} more={<MoreLink search={{ sort: 'newest' }} />} />
        <Shelf title="Used, under K100" books={bargains} more={<MoreLink search={{ condition: 'used', sort: 'price' }} />} />
        <RecentlyViewed />

        {categories.length > 0 && (
          <section className="py-10" aria-labelledby="sections-heading">
            <h2 id="sections-heading" className="mb-6 text-xl sm:text-2xl">
              Pick a shelf
            </h2>
            <SectionShelf sections={categories} />
          </section>
        )}

        <section className="mt-10 flex flex-col items-start justify-between gap-5 rounded-2xl bg-sunken px-6 py-8 sm:flex-row sm:items-center sm:px-10">
          <div>
            <h2 className="text-xl sm:text-2xl">Got the school book list?</h2>
            <p className="mt-1 text-muted">Take a photo. We find every book on it.</p>
          </div>
          <Link to="/school-list" className="btn btn-secondary">
            Find the books
          </Link>
        </section>

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


// Short band so the shelves stay above the fold; covers from the catalogue sit behind it once there are enough.
function Intro({ wall }: { wall: string[] }) {
  // Shuffled on the server, so the page and its hydration agree on the order.
  const tiles = wall
  const reveal = useRef<HTMLDivElement>(null)

  // The clear spot follows the pointer through CSS variables, so moving the mouse never re-renders React.
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const el = reveal.current
    if (!el || e.pointerType !== 'mouse') return
    const box = e.currentTarget.getBoundingClientRect()
    el.style.setProperty('--x', `${e.clientX - box.left}px`)
    el.style.setProperty('--y', `${e.clientY - box.top}px`)
    el.dataset.active = 'true'
  }
  const leave = () => {
    if (reveal.current) reveal.current.dataset.active = 'false'
  }

  return (
    <section className="band relative overflow-hidden" onPointerMove={tiles.length ? move : undefined} onPointerLeave={tiles.length ? leave : undefined}>
      {tiles.length > 0 && (
        <>
          {/* Blurred so the words lead; phones keep it light so the books still show through. */}
          <CoverWall tiles={tiles} className="blur-[2px] sm:blur-[7px]" />
          <div aria-hidden className="absolute inset-0 bg-deep/75" />
          {/* Mouse only: a small clear spot where the pointer is, to look at a book by hovering over it. */}
          <div ref={reveal} aria-hidden data-active="false" className="hero-reveal absolute inset-0">
            <CoverWall tiles={tiles} />
            <div className="absolute inset-0 bg-deep/30" />
          </div>
        </>
      )}
      <div className="page rise relative py-8 sm:py-12">
        {/* Over the cover wall the words sit on frosted glass so they read; on the plain band they don't need it. */}
        <div className={cn(tiles.length > 0 && 'frost -mx-1 w-fit max-w-2xl rounded-2xl px-5 py-5 sm:mx-0 sm:px-7 sm:py-6')}>
          <h1 className="max-w-2xl text-[2rem] leading-[1.08] font-normal sm:text-5xl">
            Books across <span className="block font-bold">Zambia &amp; Beyond</span>
          </h1>
          <p className="mt-3 max-w-xl text-on-deep-muted">New and used, from local authors, readers and bookshops.</p>
        </div>
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Quick searches">
          {QUICK_SEARCHES.map((s) => (
            <li key={s.label}>
              <Link to="/search" search={s.search} className="pill frost-pill h-8 text-on-accent no-underline hover:text-on-accent">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function CoverWall({ tiles, className }: { tiles: string[]; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'absolute -inset-6 grid -rotate-[4deg] grid-cols-[repeat(auto-fill,minmax(116px,1fr))] content-start gap-3 sm:grid-cols-[repeat(auto-fill,minmax(152px,1fr))]',
        className,
      )}
    >
      {tiles.map((src, i) => (
        <img key={i} src={src} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-md object-cover" />
      ))}
    </div>
  )
}

function MoreLink({ search }: { search: Record<string, string | boolean> }) {
  return (
    <Link to="/search" search={search} className="shrink-0 btn btn-secondary btn-sm gap-1 pr-3">
      See all
      <ChevronRightIcon className="size-4" aria-hidden />
    </Link>
  )
}
