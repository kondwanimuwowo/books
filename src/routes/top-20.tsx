import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowDownIcon, ArrowUpIcon } from '@heroicons/react/16/solid'
import { getChart } from '#/functions/catalog.functions'
import { BookCover, BookGrid } from '#/components/book'
import { Price } from '#/components/providers'
import { CHART_MIN_BUYERS, CHART_RULES, CHART_SIZE } from '#/data/chart'
import { formatDate } from '#/lib/utils'
import { CoverGridShapes, PageShapes, Placeholder } from '#/components/placeholder'

export const Route = createFileRoute('/top-20')({
  pendingComponent: () => (
    <Placeholder
      mode="loading"
      label="Loading the chart"
      shapes={
        <PageShapes>
          <CoverGridShapes />
        </PageShapes>
      }
    />
  ),
  loader: () => getChart(),
  head: () => ({
    meta: [
      { title: 'Zambia Top 20 | Kuwala Books' },
      { name: 'description', content: 'The weekly chart of books by Zambian authors, ranked by how many different readers bought them.' },
    ],
  }),
  component: ChartPage,
})

type Entry = Awaited<ReturnType<typeof getChart>>['entries'][number]

function ChartPage() {
  const { week, entries, qualifying, zambian } = Route.useLoaderData()
  const live = entries.length > 0

  return (
    <div className="page py-8 sm:py-12">
      <p className="eyebrow">Week of {formatDate(week)}</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">Zambia Top 20</h1>
      <p className="mt-3 max-w-2xl text-muted">Books by Zambian authors, ranked by how many different readers bought them in the last 30 days.</p>

      {live ? (
        <ol className="mt-8 divide-y divide-line border-y border-line">
          {entries.map((e) => (
            <ChartRow key={e.rank} entry={e} />
          ))}
        </ol>
      ) : (
        <section className="mt-8 max-w-2xl rounded-2xl bg-sunken p-6 sm:p-8" aria-labelledby="not-yet">
          <h2 id="not-yet" className="text-xl sm:text-2xl">
            Not enough sales for a chart yet
          </h2>
          <p className="mt-2 text-muted">
            It starts once {CHART_SIZE} books by Zambian authors have each been bought by at least {CHART_MIN_BUYERS} different readers. We won’t publish a shorter
            list and call it a Top 20.
          </p>
          <p className="mt-4 text-sm font-medium">
            This week: <span className="tabular-nums">{qualifying}</span> of {CHART_SIZE}
          </p>
        </section>
      )}

      {!live && zambian.length > 0 && (
        <section className="mt-12" aria-labelledby="new-zambian">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 id="new-zambian" className="text-xl sm:text-2xl">
              New from Zambian authors
            </h2>
            <Link to="/search" search={{ zambian: true }} className="shrink-0 btn btn-secondary btn-sm">
              See all
            </Link>
          </div>
          <BookGrid books={zambian} />
        </section>
      )}

      <section className="mt-12 max-w-2xl" aria-labelledby="how-counted">
        <h2 id="how-counted" className="text-lg">
          How it’s counted
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-muted">
          {CHART_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Movement({ rank, lastRank }: { rank: number; lastRank: number | null }) {
  if (lastRank === null) return <span className="text-xs font-medium text-accent-ink">New</span>
  if (lastRank === rank) return <span className="text-xs text-subtle" aria-label="No change">–</span>
  const up = lastRank > rank
  const Icon = up ? ArrowUpIcon : ArrowDownIcon
  return (
    <span className={up ? 'inline-flex items-center text-xs font-medium text-success' : 'inline-flex items-center text-xs text-subtle'} aria-label={`${up ? 'Up' : 'Down'} from ${lastRank}`}>
      <Icon className="size-3" aria-hidden />
      <span className="tabular-nums">{Math.abs(lastRank - rank)}</span>
    </span>
  )
}

function ChartRow({ entry: e }: { entry: Entry }) {
  return (
    <li>
      <Link to="/books/$slug" params={{ slug: e.book.slug }} className="flex items-center gap-4 py-4 text-ink no-underline hover:text-ink sm:gap-6">
        <div className="flex w-10 shrink-0 flex-col items-center gap-0.5 sm:w-12">
          <span className="text-2xl font-bold tracking-[-0.03em] tabular-nums sm:text-3xl">{e.rank}</span>
          <Movement rank={e.rank} lastRank={e.lastRank} />
        </div>
        <div className="w-12 shrink-0 sm:w-14">
          <BookCover src={e.book.coverUrl} title={e.book.title} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-medium">{e.book.title}</p>
          {e.book.authorNames && <p className="line-clamp-1 text-sm text-muted">{e.book.authorNames}</p>}
          <p className="mt-0.5 text-xs text-subtle">
            <span className="tabular-nums">{e.buyers}</span> readers
          </p>
        </div>
        <div className="shrink-0 text-right text-sm">
          {e.book.fromPriceNgwee !== null ? (
            <Price ngwee={e.book.fromPriceNgwee} className="font-medium tabular-nums" />
          ) : (
            <span className="text-subtle">Sold out</span>
          )}
        </div>
      </Link>
    </li>
  )
}
