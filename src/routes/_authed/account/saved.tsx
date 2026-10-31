import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRightIcon } from '@heroicons/react/16/solid'
import { getSaved } from '#/functions/favourites.functions'
import { BookGrid } from '#/components/book'
import { CoverGridShapes, EmptyMessage, Placeholder } from '#/components/placeholder'
import { SAVED_COPY } from '#/data/saved'

export const Route = createFileRoute('/_authed/account/saved')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading saved books" shapes={<CoverGridShapes />} />,
  loader: () => getSaved(),
  component: Saved,
})

const PAGES = { author: '/authors/$slug', seller: '/sellers/$slug', publisher: '/publishers/$slug' } as const

function Saved() {
  const { books, following } = Route.useLoaderData()
  if (!books.length && !following.length) {
    return (
      <Placeholder mode="empty" label={SAVED_COPY.booksHeading} shapes={<CoverGridShapes />}>
        <EmptyMessage
          title={SAVED_COPY.empty}
          action={
            <Link to="/search" className="btn btn-primary">
              {SAVED_COPY.emptyAction}
            </Link>
          }
        />
      </Placeholder>
    )
  }
  // Unsaving here leaves things in place until the next visit, so a slip can be undone.
  return (
    <div className="space-y-12">
      {books.length > 0 && (
        <section>
          <h2 className="mb-6 text-xl">{SAVED_COPY.booksHeading}</h2>
          <BookGrid books={books} layout="beside" />
        </section>
      )}
      {following.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl">{SAVED_COPY.followingHeading}</h2>
          <ul className="max-w-xl divide-y divide-line border-y border-line">
            {following.map((f) => (
              <li key={`${f.kind}:${f.slug}`}>
                <Link to={PAGES[f.kind]} params={{ slug: f.slug }} className="group flex items-center justify-between gap-4 py-3.5 text-ink no-underline hover:text-ink">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{f.name}</span>
                    <span className="text-sm text-muted">{SAVED_COPY.kinds[f.kind]}</span>
                  </span>
                  <ChevronRightIcon className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
