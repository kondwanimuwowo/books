import { Link, createFileRoute } from '@tanstack/react-router'
import { MapPinIcon } from '@heroicons/react/16/solid'
import { getAuthor } from '#/functions/catalog.functions'
import { ogMeta } from '#/lib/og'
import { BookGrid, Shelf, VerifiedMark, ZambianMark } from '#/components/book'
import { CoverGridShapes, EmptyMessage, PageShapes, Placeholder } from '#/components/placeholder'

export const Route = createFileRoute('/authors/$slug')({
  pendingComponent: () => (
    <Placeholder
      mode="loading"
      label="Loading author"
      shapes={
        <PageShapes>
          <CoverGridShapes />
        </PageShapes>
      }
    />
  ),
  loader: ({ params }) => getAuthor({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} | Kuwala Books` },
          { name: 'description', content: loaderData.bio?.slice(0, 160) ?? `Books by ${loaderData.name}` },
          ...ogMeta({ title: loaderData.name, description: loaderData.bio?.slice(0, 160) ?? `Books by ${loaderData.name} on Kuwala Books`, path: `/authors/${loaderData.slug}`, image: loaderData.photoUrl }),
        ]
      : [],
  }),
  component: AuthorPage,
})

function AuthorPage() {
  const author = Route.useLoaderData()
  const inStock = author.books.filter((b) => b.offerCount > 0).length
  const facts = [`${author.books.length} ${author.books.length === 1 ? 'book' : 'books'}`, author.years, inStock ? `${inStock} for sale` : null].filter(Boolean)

  return (
    <div className="page py-10">
      <div className="rise flex flex-col gap-6 sm:flex-row sm:items-end">
        {/* Portrait-shaped like a cover, not a round avatar: authors here are known by their books. */}
        {author.photoUrl ? (
          <img src={author.photoUrl} alt="" className="aspect-[2/3] w-28 rounded-md object-cover shadow-md sm:w-36" />
        ) : (
          <div className="band flex aspect-[2/3] w-28 items-end rounded-md p-3 text-5xl leading-none font-bold shadow-md sm:w-36" aria-hidden>
            {author.name.charAt(0)}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-4xl sm:text-5xl">{author.name}</h1>
          <p className="mt-2 text-sm text-muted">{facts.join(' · ')}</p>
          {(author.isZambian || author.shop) && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {author.isZambian && <ZambianMark />}
              {author.shop && <VerifiedMark label="Verified author" />}
            </div>
          )}
        </div>
      </div>

      {author.bio && <p className="mt-8 max-w-prose leading-relaxed whitespace-pre-line">{author.bio}</p>}

      {author.shop && (
        <div className="card mt-8 flex max-w-xl flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="font-medium">Buy direct from {author.name.split(' ')[0]}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-subtle">
              <MapPinIcon className="size-3.5" aria-hidden />
              {author.shop.storeName}, {author.shop.town}
            </p>
          </div>
          <Link to="/sellers/$slug" params={{ slug: author.shop.slug }} className="btn btn-primary btn-sm">
            Visit shop
          </Link>
        </div>
      )}

      {author.direct.length > 0 && <Shelf title="From the author" books={author.direct} />}

      <h2 className="mt-12 mb-6 text-xl">All books</h2>
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
