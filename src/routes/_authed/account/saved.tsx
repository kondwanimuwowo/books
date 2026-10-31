import { Link, createFileRoute } from '@tanstack/react-router'
import { getSavedBooks } from '#/functions/favourites.functions'
import { BookGrid } from '#/components/book'
import { CoverGridShapes, EmptyMessage, Placeholder } from '#/components/placeholder'
import { SAVED_COPY } from '#/data/saved'

export const Route = createFileRoute('/_authed/account/saved')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading saved books" shapes={<CoverGridShapes />} />,
  loader: () => getSavedBooks(),
  component: Saved,
})

function Saved() {
  const books = Route.useLoaderData()
  if (!books.length) {
    return (
      <Placeholder mode="empty" label={SAVED_COPY.heading} shapes={<CoverGridShapes />}>
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
  // Unsaving here leaves the card in place with an empty heart, so a slip can be undone.
  return <BookGrid books={books} layout="beside" />
}
