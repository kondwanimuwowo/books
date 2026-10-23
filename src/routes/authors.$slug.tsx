import { createFileRoute } from '@tanstack/react-router'
import { getAuthor } from '#/functions/catalog.functions'
import { BookGrid, VerifiedMark, ZambianMark } from '#/components/book'
import { CoverGridShapes, EmptyMessage, PageShapes, Placeholder } from '#/components/placeholder'

export const Route = createFileRoute('/authors/$slug')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading author" shapes={<PageShapes><CoverGridShapes /></PageShapes>} />,
  loader: ({ params }) => getAuthor({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: `${loaderData.name} | Kuwala Books` }] : [] }),
  component: AuthorPage,
})

function AuthorPage() {
  const author = Route.useLoaderData()
  return (
    <div className="page py-10">
      <div className="rise flex flex-col gap-6 sm:flex-row sm:items-end">
        {/* Portrait-shaped like a cover, not a round avatar: authors here are known by their books. */}
        {author.photoUrl ? (
          <img src={author.photoUrl} alt="" className="aspect-[2/3] w-24 rounded-md object-cover shadow-md sm:w-28" />
        ) : (
          <div className="band flex aspect-[2/3] w-24 items-end rounded-md p-3 text-5xl leading-none font-bold shadow-md sm:w-28" aria-hidden>
            {author.name.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="text-4xl sm:text-5xl">{author.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {author.isZambian && <ZambianMark />}
            {author.verifiedSellerId && <VerifiedMark label="Verified author" />}
          </div>
        </div>
      </div>
      {author.bio && <p className="mt-6 max-w-prose leading-relaxed whitespace-pre-line">{author.bio}</p>}
      <h2 className="mt-12 mb-6 text-xl">
        {author.books.length} {author.books.length === 1 ? 'book' : 'books'}
      </h2>
      {author.books.length ? (
        <BookGrid books={author.books} />
      ) : (
        <Placeholder mode="empty" label="Books" shapes={<CoverGridShapes count={5} />}>
          <EmptyMessage title="None for sale right now" />
        </Placeholder>
      )}
    </div>
  )
}
